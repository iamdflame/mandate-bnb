/**
 * Calling a URL a stranger put in a registry.
 *
 * Every endpoint this product dials comes out of an ERC-8004 card, which is
 * to say out of a string anybody could write for the price of a registration.
 * That makes every one of them a request the caller did not choose, aimed at
 * a host the caller did not pick, issued from inside our own network. The
 * classic way to lose is an agent whose card points at 169.254.169.254 or at
 * a service on the private network that answers happily to anything local.
 *
 * The relay already refused those. The census probe did not: it called any
 * `http:` or `https:` URL with redirects followed without limit. Same class
 * of input, two opinions about it, so there is one opinion here and both
 * callers use it.
 *
 * What is refused, and why:
 *
 *   - Anything but https. Plain http leaks whatever it carries and can be
 *     answered by whoever is between us and the host.
 *   - Loopback, link-local, and every RFC 1918 range, in both v4 and v6.
 *     169.254.169.254 is the cloud metadata endpoint and is the reason this
 *     file exists at all.
 *   - Redirects to any of the above, checked at every hop rather than only on
 *     the URL we were given. A public host that 302s to localhost defeats a
 *     check made once at the start, which is exactly how this is usually
 *     bypassed.
 *   - Bodies past a cap, so one endpoint cannot exhaust the process by
 *     answering forever.
 *   - A name that resolves to any of the above. Checking the text of the URL
 *     alone lets `metadata.example.com` point at 169.254.169.254 and walk
 *     straight past it, so every hostname is resolved first and each address
 *     it returns is held to the same rule. (The request resolves the name
 *     again, so a name that changes its answer in the milliseconds between
 *     is not caught; that needs a pinned connection, and none of our callers
 *     can reach anything worth taking from a serverless function if it is.)
 */

import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";

export class RefusedUrl extends Error {
  constructor(readonly url: string, readonly why: string) {
    super(`refused ${url}: ${why}`);
    this.name = "RefusedUrl";
  }
}

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./, // link-local, and cloud metadata
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // carrier grade NAT
  /^198\.(1[89])\./, // benchmarking
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^2(2[4-9]|3\d)\./, // multicast and reserved
];

/** True for an address on a private, loopback, link-local or reserved network, v4 or v6. */
export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (PRIVATE_V4.some((re) => re.test(a))) return true;
  if (a === "::1" || a === "::" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a)) return true;
  // An IPv4 address mapped into v6 still points where it points. The URL
  // parser rewrites ::ffff:10.0.0.1 as ::ffff:a00:1, so both forms are read.
  const dotted = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  const v4 = dotted ?? (hex ? [parseInt(hex[1]!, 16) >> 8, parseInt(hex[1]!, 16) & 255, parseInt(hex[2]!, 16) >> 8, parseInt(hex[2]!, 16) & 255].join(".") : null);
  return Boolean(v4 && PRIVATE_V4.some((re) => re.test(v4)));
}

const resolved = new Map<string, { at: number; why: Promise<string | null> }>();

/**
 * Why a hostname may not be called once it is resolved, or null when it may.
 *
 * An address literal was already judged by `whyUnsafe`; a name is resolved
 * and every A and AAAA record must be public. It asks the DNS servers
 * directly rather than through the system resolver, which runs on the same
 * small thread pool as every request's own lookup: a census calling a dozen
 * hosts at once used to queue behind itself and report seconds of latency
 * that were ours. Concurrent callers for one host share one answer, kept ten
 * minutes.
 */
export function whyUnsafeHost(hostname: string): Promise<string | null> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIP(host)) return Promise.resolve(null);
  const seen = resolved.get(host);
  if (seen && Date.now() - seen.at < 10 * 60_000) return seen.why;
  const why = (async () => {
    const [v4, v6] = await Promise.allSettled([resolve4(host), resolve6(host)]);
    const addresses = [...(v4.status === "fulfilled" ? v4.value : []), ...(v6.status === "fulfilled" ? v6.value : [])];
    // A name that does not resolve is not refused here; the request fails on its own and says so.
    return addresses.some(isPrivateAddress) ? "that name resolves to a private or reserved address" : null;
  })();
  resolved.set(host, { at: Date.now(), why });
  return why;
}

/** Why this host may not be called, or null when it may. */
export function whyUnsafe(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "that is not a URL";
  }
  if (u.protocol !== "https:") return `we only call https, and that is ${u.protocol.replace(":", "")}`;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "that name resolves inside our own network";
  }
  // v4, and v6 loopback, unique local (fc00::/7), link local (fe80::/10) and mapped v4.
  if (isPrivateAddress(host)) return "that address is on a private or reserved network";
  return null;
}

export const isSafeUrl = (raw: string): boolean => whyUnsafe(raw) === null;

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** Bytes to read before giving up on a body that will not end. */
  maxBytes?: number;
  /** Hops to follow. Each one is checked like the first. */
  maxRedirects?: number;
}

export interface SafeResponse {
  status: number;
  headers: Headers;
  /** Decoded body, truncated at the cap. */
  text: string;
  /** True when the body hit the cap and there was more. */
  truncated: boolean;
  bytes: number;
  /** Where we ended up, which is not always where we were sent. */
  finalUrl: string;
  redirects: number;
}

/**
 * Reads at most `maxBytes`, then stops pulling.
 *
 * `res.text()` on a body with no end is a process that never returns.
 */
async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean; bytes: number }> {
  const reader = res.body?.getReader();
  if (!reader) return { text: "", truncated: false, bytes: 0 };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      chunks.push(value.slice(0, Math.max(0, value.byteLength - (bytes - maxBytes))));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const joined = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    joined.set(c, at);
    at += c.byteLength;
  }
  return { text: new TextDecoder().decode(joined), truncated, bytes };
}

/**
 * Fetches a stranger's URL, refusing anything aimed at our own network, and
 * checking every redirect the same way.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const { method = "GET", headers = {}, body, timeoutMs = 8_000, maxBytes = 256 * 1024, maxRedirects = 3 } = opts;

  let url = raw;
  const deadline = Date.now() + timeoutMs;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const why = whyUnsafe(url) ?? (await whyUnsafeHost(new URL(url).hostname));
    if (why) throw new RefusedUrl(url, why);

    const left = deadline - Date.now();
    if (left <= 0) throw new Error(`no answer in ${Math.round(timeoutMs / 1000)}s`);

    const res = await fetch(url, {
      method,
      headers,
      body,
      // Handled by hand so each hop gets the same check as the first.
      redirect: "manual",
      signal: AbortSignal.timeout(left),
    });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      if (hop === maxRedirects) throw new RefusedUrl(url, `it redirected more than ${maxRedirects} times`);
      url = new URL(location, url).toString();
      continue;
    }

    const { text, truncated, bytes } = await readCapped(res, maxBytes);
    return { status: res.status, headers: res.headers, text, truncated, bytes, finalUrl: url, redirects: hop };
  }

  throw new RefusedUrl(url, "it redirected too many times");
}
