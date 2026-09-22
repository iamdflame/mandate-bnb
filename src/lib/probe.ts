/**
 * Calling an endpoint, so rung 2 is a call we made rather than a claim we read.
 *
 * Rung 2 says "its endpoint answered a call we made". That number used to come
 * from 8004scan's `is_endpoint_verified` flag: somebody else's probe, at a
 * time they do not publish, with a method they do not describe.
 *
 * This makes it ours. What changed in v2, and why each change matters:
 *
 *   1. It speaks the protocols. A single GET tells you a server exists. It
 *      does not tell you whether the thing behind it is an agent. So this
 *      does an MCP `initialize` followed by `tools/list`, and an A2A agent
 *      card followed by the specification's no-effect JSON-RPC call. What
 *      comes back is what the agent can actually do, which is the only
 *      version of "capable" that is not a claim copied off a card.
 *
 *   2. Answered means protocol-correct. It used to mean any HTTP response at
 *      all, so a 404 from a parked domain counted as an agent answering, and
 *      those agents could pass the hire law. Fixing this lowers the live
 *      count. The lower number is the true one.
 *
 *   3. It refuses to call our own network. Endpoints come out of strings
 *      strangers wrote into a registry, and the old probe would follow one to
 *      169.254.169.254 without complaint. See `lib/net/safe-fetch`.
 *
 *   4. It keeps the bytes. A grade nobody can check is an opinion.
 *
 * A non-200 is recorded with its status rather than dropped. Half the value of
 * a census is knowing which agents are failing and how: an endpoint that
 * answers 402 is a very different finding from one that times out.
 */

import { createHash } from "node:crypto";
import { safeFetch, RefusedUrl, whyUnsafe } from "@/lib/net/safe-fetch";

/** What the endpoint turned out to be, once we spoke to it. */
export type Protocol = "mcp" | "a2a" | "x402" | "http" | null;

export interface ProbeTool {
  name: string;
  description?: string;
}

export interface ProbeResult {
  tokenId: string;
  /** The URL called. Null when the card advertised none. */
  endpoint: string | null;
  /**
   * True only when the endpoint answered in a protocol we recognise.
   *
   * A 402 counts: it is the x402 rail working exactly as specified, and an
   * agent that quotes a price for its answer is more alive than one that
   * returns 200 and nothing. A 404 does not count, and used to.
   */
  answered: boolean;
  status: number | null;
  latencyMs: number | null;
  /**
   * Which handshake succeeded. Null when none did, absent on readings taken
   * before the probe learned to speak anything but HTTP.
   */
  protocol?: Protocol;
  /** What `tools/list` or the agent card actually offered. */
  tools?: ProbeTool[];
  /** Identity of the backend, for spotting one server behind many tokens. */
  fingerprint?: string;
  error: string | null;
  /**
   * When we last tried, whether or not a reading came of it.
   *
   * When a card fails to resolve the old reading is kept, and for a week the
   * census ordered its slices by that old time: eighty-one unresolvable cards
   * stayed the oldest, every slice went to them, and nothing else was called
   * again. Slices order by this instead, so a failed attempt goes to the back.
   */
  attemptedAt?: string;
  at: string;
  /** The exchange, for the reader who wants to check the grade. */
  transcript?: { request: string; status: number | null; body: string; truncated: boolean; sha256: string }[];
}

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 256 * 1024;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Server-sent events carry the JSON payload on `data:` lines. */
function parseMaybeSse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const data = trimmed
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/** A JSON-RPC 2.0 envelope, whether it carries a result or an error. */
const isJsonRpc = (v: unknown): v is { jsonrpc: string; result?: unknown; error?: unknown } =>
  typeof v === "object" && v !== null && (v as { jsonrpc?: string }).jsonrpc === "2.0";

function classifyFailure(e: unknown): string {
  if (e instanceof RefusedUrl) return e.why;
  const message = String(e);
  if (/timeout|abort|TimeoutError/i.test(message)) return `no answer in ${TIMEOUT_MS / 1000}s`;
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return "the host does not resolve";
  if (/ECONNREFUSED/i.test(message)) return "the host refused the connection";
  if (/certificate|TLS|SSL|self-signed/i.test(message)) return "the certificate would not verify";
  if (/ECONNRESET|socket hang up/i.test(message)) return "the host dropped the connection";
  return "the request failed";
}

type Step = NonNullable<ProbeResult["transcript"]>[number];

const step = (request: string, status: number | null, body: string, truncated = false): Step => ({
  request,
  status,
  body: body.slice(0, 4_000),
  truncated,
  sha256: sha256(body),
});

/**
 * MCP: `initialize`, then `tools/list` carrying whatever session id came back.
 *
 * A server that answers `initialize` with a JSON-RPC result is an MCP server,
 * and that is a fact about the software rather than about its card.
 */
async function tryMcp(url: string, transcript: Step[]): Promise<{ tools: ProbeTool[]; status: number } | null> {
  const init = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mandate-probe", version: "2" },
    },
  });

  const res = await safeFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: init,
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
  });
  transcript.push(step("POST initialize", res.status, res.text, res.truncated));

  const parsed = parseMaybeSse(res.text);
  if (!isJsonRpc(parsed) || !("result" in parsed)) return null;

  // The session id has to be carried or the next call is a stranger again.
  const session = res.headers.get("mcp-session-id");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(session ? { "mcp-session-id": session } : {}),
  };

  await safeFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    timeoutMs: 4_000,
    maxBytes: 8 * 1024,
  }).catch(() => undefined);

  const listed = await safeFetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
  }).catch(() => null);

  if (!listed) return { tools: [], status: res.status };
  transcript.push(step("POST tools/list", listed.status, listed.text, listed.truncated));

  const body = parseMaybeSse(listed.text);
  const raw = isJsonRpc(body) ? ((body.result as { tools?: unknown[] } | undefined)?.tools ?? []) : [];
  const tools = (Array.isArray(raw) ? raw : [])
    .map((t) => t as { name?: unknown; description?: unknown })
    .filter((t) => typeof t.name === "string")
    .map((t) => ({ name: String(t.name), description: typeof t.description === "string" ? t.description.slice(0, 300) : undefined }));

  return { tools, status: res.status };
}

/**
 * A2A: the agent card, then the specification's no-effect call.
 *
 * `tasks/get` on an id that cannot exist is the politest thing you can ask an
 * A2A server. A result or a JSON-RPC error both prove it speaks the protocol;
 * only silence or HTML does not.
 */
async function tryA2a(url: string, transcript: Step[]): Promise<{ tools: ProbeTool[]; status: number } | null> {
  const base = url.replace(/\/+$/, "");
  const cardUrls = [`${base}/.well-known/agent-card.json`, `${base}/.well-known/agent.json`];

  let skills: ProbeTool[] = [];
  let cardStatus: number | null = null;
  for (const c of cardUrls) {
    if (whyUnsafe(c)) continue;
    const res = await safeFetch(c, { headers: { accept: "application/json" }, timeoutMs: 6_000, maxBytes: MAX_BYTES }).catch(() => null);
    if (!res) continue;
    transcript.push(step(`GET ${c.replace(base, "")}`, res.status, res.text, res.truncated));
    cardStatus = res.status;
    if (res.status !== 200) continue;
    const card = parseMaybeSse(res.text) as { skills?: { id?: string; name?: string; description?: string }[] } | null;
    if (!card || typeof card !== "object") continue;
    skills = (card.skills ?? [])
      .filter((s) => s && (s.name || s.id))
      .map((s) => ({ name: String(s.name ?? s.id), description: s.description?.slice(0, 300) }));
    break;
  }

  const rpc = await safeFetch(base, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tasks/get", params: { id: "mandate-probe-does-not-exist" } }),
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
  }).catch(() => null);

  if (rpc) {
    transcript.push(step("POST tasks/get", rpc.status, rpc.text, rpc.truncated));
    const body = parseMaybeSse(rpc.text);
    // An error is as good as a result: both are the protocol answering.
    if (isJsonRpc(body)) return { tools: skills, status: rpc.status };
  }

  // A card alone still proves an A2A agent is published there.
  if (skills.length && cardStatus === 200) return { tools: skills, status: 200 };
  return null;
}

/** The plain call, which is still how an x402 seller quotes a price. */
async function tryHttp(url: string, transcript: Step[]): Promise<{ status: number; x402: boolean } | null> {
  const res = await safeFetch(url, {
    headers: { accept: "application/json, */*" },
    timeoutMs: TIMEOUT_MS,
    maxBytes: MAX_BYTES,
  });
  transcript.push(step("GET", res.status, res.text, res.truncated));
  const quoted = res.status === 402 || Boolean(res.headers.get("payment-required")) || /x402Version/.test(res.text.slice(0, 2_000));
  return { status: res.status, x402: quoted };
}

/**
 * One endpoint, asked three ways, in the order that costs the least.
 *
 * The plain GET goes first because it is one request and it settles the x402
 * case outright. The handshakes follow only when the GET has not already
 * proved the thing is an agent.
 */
export async function probe(tokenId: string, endpoint: string | null): Promise<ProbeResult> {
  const at = new Date().toISOString();
  const base = { tokenId, endpoint, attemptedAt: at, at };

  if (!endpoint) {
    return { ...base, answered: false, status: null, latencyMs: null, protocol: null, error: "the card advertises no endpoint" };
  }
  const unsafe = whyUnsafe(endpoint);
  if (unsafe) {
    return { ...base, answered: false, status: null, latencyMs: null, protocol: null, error: unsafe };
  }

  const transcript: Step[] = [];
  const started = Date.now();

  try {
    const plain = await tryHttp(endpoint, transcript).catch(() => null);

    if (plain?.x402) {
      return {
        ...base,
        answered: true,
        status: plain.status,
        latencyMs: Date.now() - started,
        protocol: "x402",
        error: null,
        fingerprint: transcript[0] ? sha256(`x402:${transcript[0].sha256}`) : undefined,
        transcript,
      };
    }

    const mcp = await tryMcp(endpoint, transcript).catch(() => null);
    if (mcp) {
      return {
        ...base,
        answered: true,
        status: mcp.status,
        latencyMs: Date.now() - started,
        protocol: "mcp",
        tools: mcp.tools,
        // Two tokens whose servers offer exactly the same tools are one
        // product registered twice, which is worth saying out loud.
        fingerprint: sha256(`mcp:${mcp.tools.map((t) => t.name).sort().join(",")}`),
        error: null,
        transcript,
      };
    }

    const a2a = await tryA2a(endpoint, transcript).catch(() => null);
    if (a2a) {
      return {
        ...base,
        answered: true,
        status: a2a.status,
        latencyMs: Date.now() - started,
        protocol: "a2a",
        tools: a2a.tools,
        fingerprint: sha256(`a2a:${a2a.tools.map((t) => t.name).sort().join(",")}`),
        error: null,
        transcript,
      };
    }

    /*
      Something answered, and it was not an agent.

      This is the case that used to count as live. A parked domain, an HTML
      error page and a 404 all answer, and none of them can be hired. The
      status is kept because "answered 404" and "did not answer" are different
      findings, and only one of them means somebody should fix a card.
    */
    if (plain) {
      const ok = plain.status === 200 || plain.status === 401;
      return {
        ...base,
        answered: false,
        status: plain.status,
        latencyMs: Date.now() - started,
        protocol: ok ? "http" : null,
        error: ok
          ? "it answered, but not in MCP, A2A or x402, so there is nothing here we know how to hire"
          : `answered ${plain.status}`,
        transcript,
      };
    }

    return { ...base, answered: false, status: null, latencyMs: Date.now() - started, protocol: null, error: "the request failed", transcript };
  } catch (e) {
    return {
      ...base,
      answered: false,
      status: null,
      latencyMs: Date.now() - started,
      protocol: null,
      error: classifyFailure(e),
      transcript,
    };
  }
}

/**
 * Probes many, politely.
 *
 * Bounded concurrency rather than a flood: these are other people's servers
 * and a census that knocks them over has measured its own effect.
 */
export async function probeAll(
  targets: { tokenId: string; endpoint: string | null }[],
  concurrency = 6,
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= targets.length) return;
      const t = targets[i]!;
      out.push(await probe(t.tokenId, t.endpoint));
    }
  });
  await Promise.all(workers);
  return out;
}
