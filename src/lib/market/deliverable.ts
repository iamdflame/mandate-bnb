/**
 * Checking a provider's deliverable against what it committed on chain.
 *
 * An ERC-8183 job carries a 32-byte commitment. The work is only worth what
 * that commitment says it is, so before anyone is paid the bytes are fetched
 * and hashed, and the hash has to be the one on chain.
 *
 * Providers disagree about what exactly they hash: ChainHelix commits to the
 * keccak of the whole response body, others to a field inside it, and either
 * hash function is in use. So every reasonable reading is tried and the one
 * that matched is named. If none match, that is a finding about the provider,
 * published as such, and the job is not settled: paying for a deliverable
 * nobody can reproduce is the thing this marketplace exists to refuse.
 */

import { keccak256, sha256, toBytes, type Hex } from "viem";
import { safeFetch } from "@/lib/net/safe-fetch";

export interface DeliverableCheck {
  url: string | null;
  bytes: number;
  committed: string;
  /** Which reading reproduced the commitment, or null when none did. */
  matchedAs: string | null;
  candidates: { reading: string; keccak256: Hex; sha256: Hex }[];
  body: string | null;
  readAt: string;
  error?: string;
}

function readings(text: string): { reading: string; value: string }[] {
  const out = [{ reading: "the whole response", value: text }];
  try {
    const doc = JSON.parse(text) as Record<string, unknown>;
    const inner = doc.response;
    if (typeof inner === "string") out.push({ reading: "its response field", value: inner });
    else if (inner && typeof inner === "object") {
      const content = (inner as { content?: unknown }).content;
      if (typeof content === "string") out.push({ reading: "its response.content field", value: content });
      out.push({ reading: "its response object", value: JSON.stringify(inner) });
    }
    for (const key of ["content", "deliverable", "result"]) {
      const v = doc[key];
      if (typeof v === "string") out.push({ reading: `its ${key} field`, value: v });
    }
  } catch {
    /* not JSON: the whole body is the only reading */
  }
  return out;
}

export async function verifyDeliverable(url: string | null, committed: string, timeoutMs = 20_000): Promise<DeliverableCheck> {
  const base: DeliverableCheck = { url, bytes: 0, committed, matchedAs: null, candidates: [], body: null, readAt: new Date().toISOString() };
  if (!url) return { ...base, error: "the job names no deliverable url" };
  try {
    // A URL the provider wrote into the job, so it is called through the guard like any other.
    const res = await safeFetch(url, { timeoutMs, maxBytes: 2 * 1024 * 1024 });
    const text = res.text;
    const candidates = readings(text).map((r) => ({ reading: r.reading, keccak256: keccak256(toBytes(r.value)), sha256: sha256(toBytes(r.value)) }));
    const hit = candidates.find((c) => c.keccak256.toLowerCase() === committed.toLowerCase() || c.sha256.toLowerCase() === committed.toLowerCase());
    return {
      ...base,
      bytes: text.length,
      candidates,
      matchedAs: hit ? `${hit.reading}, ${hit.keccak256.toLowerCase() === committed.toLowerCase() ? "keccak256" : "sha256"}` : null,
      body: text.slice(0, 40_000),
      ...(res.status >= 200 && res.status < 300 ? {} : { error: `the provider answered ${res.status}` }),
    };
  } catch (e) {
    return { ...base, error: (e as Error).message.split("\n")[0].slice(0, 160) };
  }
}
