/**
 * The self-check: what is failing on our side, found by us before a builder
 * writes in.
 *
 * On 25 Oct both IPFS gateways we read cards through had stopped serving
 * programs, and 71 agents sat unread without a single error anywhere; a
 * builder's email found the unread-card row and an old answer graded against
 * a changed account. Both were visible in our own numbers. This reads them
 * every hour:
 *
 * - the services we depend on, each provider on its own (mainnet RPCs, the
 *   log providers, testnet, every IPFS gateway), so one dying is seen while
 *   the others still carry the load;
 * - every scheduled job: failing, stalled past three of its own cadences, or
 *   reporting a problem in its own words;
 * - the failure counts that tell our mistakes from the market's, against the
 *   same counts a day earlier.
 *
 * A new problem is sent to the operator's Telegram chat (OPS_CHAT_ID) at most
 * once in twelve hours, and turns the status page's ninth beat red, so smoke
 * fails on it too. A read the self-check itself could not make is a problem,
 * never a pass.
 */

import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { loadedLive, snapshot, store, warm } from "@/lib/data/snapshots";
import { IDENTITY_REGISTRY, RPC_FALLBACKS, RPC_URL } from "@/lib/config";
import { LOG_RPCS } from "@/lib/chain/market";
import { testnetPublic } from "@/lib/chain/testnet";
import { IPFS_GATEWAYS } from "@/lib/sources/registry";
import { safeFetch } from "@/lib/net/safe-fetch";
import { getProbes } from "@/lib/data/probes";
import { listings } from "@/lib/market/listing";
import { hirePath, warmOutcomes } from "@/lib/market/hire-law";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { latestConformance } from "@/lib/conformance/run";
import { testnetListings } from "@/lib/testnet/sellers";
import { warmRegistry } from "@/lib/registry/tail";
import { alertsOn, send } from "@/lib/alerts/telegram";

export interface Dependency {
  group: "mainnet RPC" | "log provider" | "testnet RPC" | "IPFS gateway";
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
  /** Ours to keep up (the configured RPC and log provider): flagged on its own when it fails, not only when its whole group does. */
  primary?: boolean;
}

export interface Reading {
  at: string;
  hireableMainnet: number;
  hireableTestnet: number;
  answering: number;
  /** Agents whose card our census could not read on its last call. */
  cardsUnread: number;
  /** Registry rows waiting on a card read. */
  registryUnread: number;
  paidCalls24h: number;
  paidOurFault24h: number;
  conformanceFail: number;
}

export interface Flag {
  /** Stable across runs, so the same problem is sent once, not every hour. */
  key: string;
  what: string;
}

export interface SelfCheck {
  at: string;
  dependencies: Dependency[];
  reading: Reading | null;
  flags: Flag[];
  /** The last day of readings, oldest first, for the day-over-day comparisons. */
  history: Reading[];
  /** When each flag was last sent. */
  sent: Record<string, string>;
}

/*
  Two cards known to sit on IPFS, read today through filebase, ipfs-lens and
  Pinata, and IPFS's own hello-world: a gateway is up when it serves any one
  of them, so a single card losing its pin is not mistaken for an outage.
*/
const IPFS_CANARIES = ["QmdpjJy31gmp9V98FMSpYTyzkK4mgGZgV3rJeeWLDrFYtU", "QmRjC1vVdSRRtcvTDtqq3WUXb71tXE7RnPxoN8t1bVxX2J", "QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o"];
const RESEND_MS = 12 * 3_600_000;
const DAY_MS = 24 * 3_600_000;

const hex = (n: bigint) => `0x${n.toString(16)}`;
const ms = (t: number) => Date.now() - t;
const brief = (e: unknown) => ((e as Error)?.message ?? String(e)).split("\n")[0]!.replace(/https?:\/\/\S+/g, "<url>").slice(0, 120);

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(10_000) });
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error || body.result === undefined) throw new Error(body.error?.message ?? `answered ${res.status}`);
  return body.result;
}

const label = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "configured provider";
  }
};

/** Each service on its own: a pass is a real answer, timed. */
export async function checkDependencies(): Promise<Dependency[]> {
  const out: Dependency[] = [];
  const probe = async (group: Dependency["group"], name: string, fn: () => Promise<string>, primary = false) => {
    const t = Date.now();
    try {
      out.push({ group, name, ok: true, detail: await fn(), ms: ms(t), ...(primary ? { primary } : {}) });
    } catch (e) {
      out.push({ group, name, ok: false, detail: brief(e), ms: ms(t), ...(primary ? { primary } : {}) });
    }
  };
  let head: bigint | null = null;
  await Promise.all(
    [RPC_URL, ...RPC_FALLBACKS].map((url, i) =>
      probe(
        "mainnet RPC",
        label(url),
        async () => {
          const n = BigInt(String(await rpcCall(url, "eth_blockNumber", [])));
          head = head && head > n ? head : n;
          return `block ${n}`;
        },
        i === 0,
      ),
    ),
  );
  // The registry's last 500 blocks, the read the registry tail makes: at least one provider must serve it.
  await Promise.all(
    LOG_RPCS.map((url, i) =>
      probe(
        "log provider",
        i === 0 && process.env.LOG_RPC_URL ? "LOG_RPC_URL" : label(url),
        async () => {
          if (head === null) throw new Error("no mainnet head to read up to");
          const logs = (await rpcCall(url, "eth_getLogs", [{ address: IDENTITY_REGISTRY, fromBlock: hex(head - 500n), toBlock: hex(head) }])) as unknown[];
          return `${logs.length} registry logs in 500 blocks`;
        },
        i === 0 && Boolean(process.env.LOG_RPC_URL),
      ),
    ),
  );
  await probe("testnet RPC", "testnet reader", async () => `block ${await testnetPublic().getBlockNumber()}`);
  await Promise.all(
    IPFS_GATEWAYS.map((g) =>
      probe("IPFS gateway", label(g), async () => {
        let last = "nothing served";
        for (const cid of IPFS_CANARIES) {
          const res = await safeFetch(g + cid, { timeoutMs: 8_000, maxBytes: 64 * 1024 }).catch((e: unknown) => ({ status: 0, text: brief(e) }));
          if (res.status >= 200 && res.status < 300) return `served ${cid.slice(0, 8)}…`;
          last = res.status ? `answered ${res.status}` : res.text;
        }
        throw new Error(last);
      }),
    ),
  );
  return out;
}

/** Our numbers now. Throws when a number cannot be read: a reading is complete or it is not a reading. */
async function readNumbers(): Promise<Reading> {
  await Promise.all([warm(), warmRegistry(), warmOutcomes(), warm(["testnet-sellers"])]);
  const probes = getProbes();
  const calls = await listPaidCalls();
  const day = Date.now() - DAY_MS;
  const recent = calls.filter((c) => Date.parse(c.at) > day);
  const conformance = await latestConformance();
  const [unread] = (await pg!`select count(*)::int as n from registry_agents where coalesce((record->>'resolved')::boolean, false) = false`) as { n: number }[];
  return {
    at: new Date().toISOString(),
    hireableMainnet: listings().filter((l) => l.category && hirePath(l).ok).length,
    hireableTestnet: testnetListings().filter((s) => s.hireable).length,
    answering: probes.answered,
    cardsUnread: probes.results.filter((r) => /card did not resolve/.test(r.error ?? "")).length,
    registryUnread: unread?.n ?? 0,
    paidCalls24h: recent.length,
    paidOurFault24h: recent.filter((c) => c.fault === "ours").length,
    conformanceFail: [...conformance.values()].filter((c) => c.verdict === "fail").length,
  };
}

/** Problems with a scheduled job: failing, stalled past three of its cadences, or saying so in its own words. */
async function jobProblems(cadence: Record<string, number>): Promise<Flag[]> {
  const rows = (await pg!`select name, last_run_at, last_ok, last_detail::text as detail from schedules`) as { name: string; last_run_at: Date | string | null; last_ok: boolean | null; detail: string | null }[];
  const seen = new Map(rows.map((r) => [r.name, r]));
  const out: Flag[] = [];
  for (const [name, every] of Object.entries(cadence)) {
    const r = seen.get(name);
    if (!r?.last_run_at) {
      out.push({ key: `job:${name}:never`, what: `${name} has never run` });
      continue;
    }
    const age = Date.now() - new Date(r.last_run_at).getTime();
    if (age > Math.max(3 * every, 30) * 60_000) out.push({ key: `job:${name}:stalled`, what: `${name} last ran ${Math.round(age / 60_000)} min ago; it runs every ${every} min` });
    if (r.last_ok === false) out.push({ key: `job:${name}:failing`, what: `${name} failed: ${(r.detail ?? "").replace(/^"|"$/g, "").slice(0, 160)}` });
    else if (/could not be read|holds less than|scan failed|settle failed|no provider served|not loaded on this instance|nothing spent/i.test(r.detail ?? "")) {
      out.push({ key: `job:${name}:reports`, what: `${name} reports: ${(r.detail ?? "").replace(/^"|"$/g, "").slice(0, 200)}` });
    }
  }
  return out;
}

/** What in a reading, against the one a day earlier, is a problem of ours to look at. Pure, for tests. */
export function compare(now: Reading, dayAgo: Reading | null, deps: Dependency[]): Flag[] {
  const out: Flag[] = [];
  const groups = [...new Set(deps.map((d) => d.group))];
  for (const g of groups) {
    const all = deps.filter((d) => d.group === g);
    const up = all.filter((d) => d.ok);
    if (!up.length) out.push({ key: `dep:${g}:down`, what: `Every ${g} is down: ${all.map((d) => `${d.name} (${d.detail})`).join("; ")}` });
    else if (g === "IPFS gateway" && up.length < 2) out.push({ key: `dep:${g}:one`, what: `Only one IPFS gateway serves cards (${up[0]!.name}); the others: ${all.filter((d) => !d.ok).map((d) => `${d.name} ${d.detail}`).join("; ")}` });
  }
  for (const d of deps.filter((x) => !x.ok && x.primary)) out.push({ key: `dep:${d.name}:down`, what: `${d.group} ${d.name}, the one we configured, is down: ${d.detail}` });
  if (now.paidOurFault24h > 0) out.push({ key: "paid:ours", what: `${now.paidOurFault24h} paid call${now.paidOurFault24h === 1 ? "" : "s"} in the last day failed on our side` });
  if (now.hireableMainnet < 25) out.push({ key: "hireable:low", what: `Only ${now.hireableMainnet} agents are hireable on mainnet` });
  if (dayAgo) {
    if (now.hireableMainnet < dayAgo.hireableMainnet * 0.85) out.push({ key: "hireable:drop", what: `Hireable on mainnet fell from ${dayAgo.hireableMainnet} to ${now.hireableMainnet} in a day` });
    if (dayAgo.hireableTestnet >= 5 && now.hireableTestnet < dayAgo.hireableTestnet * 0.7) out.push({ key: "testnet:drop", what: `Hireable on testnet fell from ${dayAgo.hireableTestnet} to ${now.hireableTestnet} in a day` });
    if (now.answering < dayAgo.answering * 0.8) out.push({ key: "answering:drop", what: `Agents answering our call fell from ${dayAgo.answering} to ${now.answering} in a day` });
    if (now.cardsUnread > dayAgo.cardsUnread + 20) out.push({ key: "cards:unread", what: `Cards our census could not read rose from ${dayAgo.cardsUnread} to ${now.cardsUnread} in a day` });
    if (now.conformanceFail >= dayAgo.conformanceFail + 3) out.push({ key: "conformance:fail", what: `Failed answer checks rose from ${dayAgo.conformanceFail} to ${now.conformanceFail} in a day; check our grading before the agents` });
  }
  return out;
}

/** One hourly pass: read, compare, keep, and send what is new. */
export async function runSelfCheck(opts: { cadence: Record<string, number> }): Promise<string> {
  if (!pg) return "no database";
  await ensureTables();
  await warm(["self-check"]);
  if (!(await loadedLive("self-check"))) return "the stored self-check is not loaded on this instance; not saving over it";
  const prev = snapshot<SelfCheck>("self-check")?.payload ?? null;

  const deps = await checkDependencies();
  const reading = await readNumbers().catch((e: unknown) => {
    deps.push({ group: "mainnet RPC", name: "our own records", ok: false, detail: `the self-check could not read our numbers: ${brief(e)}`, ms: 0 });
    return null;
  });
  const jobs = await jobProblems(opts.cadence).catch((e: unknown): Flag[] => [{ key: "job:records", what: `the run history could not be read: ${brief(e)}` }]);
  const history = [...(prev?.history ?? []), ...(reading ? [reading] : [])].filter((r) => Date.now() - Date.parse(r.at) <= DAY_MS + 3_600_000);
  const dayAgo = history.find((r) => Date.now() - Date.parse(r.at) >= DAY_MS - 3_600_000) ?? null;
  const flags = [...(reading ? compare(reading, dayAgo, deps) : [{ key: "self:unread", what: "the self-check could not read our numbers" }]), ...jobs];

  // New problems to the operator, each at most once in twelve hours.
  const sent: Record<string, string> = { ...(prev?.sent ?? {}) };
  const due = flags.filter((f) => !sent[f.key] || Date.now() - Date.parse(sent[f.key]!) > RESEND_MS);
  const chat = process.env.OPS_CHAT_ID;
  if (due.length && chat && alertsOn()) {
    const r = await send(chat, `MANDATE self-check, ${due.length} new:\n${due.map((f) => `• ${f.what}`).join("\n")}`).catch(() => "failed" as const);
    if (r === "sent") for (const f of due) sent[f.key] = new Date().toISOString();
  }
  // A problem that cleared is sent again if it comes back.
  for (const k of Object.keys(sent)) if (!flags.some((f) => f.key === k)) delete sent[k];

  const out: SelfCheck = { at: new Date().toISOString(), dependencies: deps, reading, flags, history, sent };
  await store("self-check", out, out.at);
  const down = deps.filter((d) => !d.ok).length;
  return flags.length ? `${flags.length} problem${flags.length === 1 ? "" : "s"}: ${flags.map((f) => f.what).join("; ").slice(0, 400)}` : `all clear: ${deps.length - down} of ${deps.length} services up, ${reading?.hireableMainnet} hireable on mainnet, ${reading?.hireableTestnet} on testnet`;
}

/** The latest self-check, for the status page and smoke. */
export function latestSelfCheck(): SelfCheck | null {
  return snapshot<SelfCheck>("self-check")?.payload ?? null;
}

