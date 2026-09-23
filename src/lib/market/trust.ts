/**
 * What we actually know about an agent, in four honest states.
 *
 * The six checks are the product's differentiator, and the first thing a
 * redesign does to a verification system is collapse it into "pass" and
 * "fail". That would be a lie in both directions. An agent whose wallet we did
 * not see touch PancakeSwap in the last 30,000 blocks has not failed anything:
 * it may simply act rarely. An endpoint that was silent when we called it has.
 * And an agent we have never called is neither.
 *
 * So there are four states, and every surface uses these words:
 *
 *   proven     ✓  a check ran and passed
 *   unproven   ?  a check ran and did not see it, which is not the same as no
 *   failed     ×  we observed a negative fact
 *   nodata     —  never checked, never called, nothing published, no history
 *
 * Each proof carries a one-line meaning written for a buyer, and the full
 * finding and evidence behind a disclosure for anyone who wants it. There is
 * deliberately no aggregate score anywhere: "3 proven, 2 not yet proven" names
 * what it counts, and a single number would hide which three.
 */

import type { AssayReport, AssayResult } from "@/lib/assay/types";
import type { Listing } from "@/lib/market/listing";

export type ProofState = "proven" | "unproven" | "failed" | "nodata";

export const STATE_WORD: Record<ProofState, string> = {
  proven: "Proven",
  unproven: "Not yet proven",
  failed: "Failed check",
  nodata: "Not enough data",
};

export interface Proof {
  key: "registered" | "reachable" | "active" | "capability" | "custody" | "reputation" | "assayed" | "settled" | "performance";
  label: string;
  state: ProofState;
  /** One short line: what we saw. */
  headline: string;
  /** What this state means for a buyer, when it is not a plain pass. */
  meaning?: string;
  /** When the fact was established, if we know. */
  at?: string | null;
  /** The full finding and its evidence, for the reader who opens the row. */
  evidence?: { finding: string; items: { label: string; value: string; url?: string }[] } | null;
}

export interface Trust {
  /** The rows a buyer reads first, in the order they matter. */
  proofs: Proof[];
  /** Registered → Reachable → Active → Capability → Assayed → Settled. */
  timeline: Proof[];
  counts: Record<ProofState, number>;
  /** Short proven statements for a tile, strongest first. Only ever proven facts. */
  badges: string[];
}

const byId = (r: AssayReport | null, id: AssayResult["id"]) => r?.results.find((x) => x.id === id) ?? null;

function evidenceOf(r: AssayResult | null): Proof["evidence"] {
  if (!r) return null;
  return { finding: r.finding, items: r.evidence.slice(0, 8).map((e) => ({ label: e.label, value: e.value, url: e.url })) };
}

/** The raw verdict, before we decide what it means for this particular check. */
function raw(r: AssayResult | null): "pass" | "fail" | "open" | "na" {
  if (!r) return "open";
  if (r.notApplicable) return "na";
  return r.verdict === "pass" ? "pass" : r.verdict === "fail" ? "fail" : "open";
}

export function trustOf(l: Listing, report: AssayReport | null, extra: { createdAt?: string | null; settled?: number } = {}): Trust {
  const settled = extra.settled ?? l.settled ?? l.hires ?? 0;
  const at = report?.assayedAt ?? null;

  // --- reachable: our own call to its endpoint -------------------------
  const reachable: Proof = (() => {
    const when = l.probe?.at ?? null;
    const ev: Proof["evidence"] = l.probe
      ? {
          finding: l.probe.answered ? "Our probe called the endpoint its registration names and it answered." : "Our probe called the endpoint its registration names.",
          items: [
            ...(l.probe.endpoint ? [{ label: "Endpoint", value: l.probe.endpoint }] : []),
            ...(l.probe.status != null ? [{ label: "HTTP status", value: String(l.probe.status) }] : []),
            ...(l.probe.latencyMs != null ? [{ label: "Response time", value: `${l.probe.latencyMs} ms` }] : []),
            ...(when ? [{ label: "Checked", value: new Date(when).toUTCString() }] : []),
          ],
        }
      : null;
    if (l.liveness === "live")
      return { key: "reachable", label: "Endpoint", state: "proven", headline: l.probe?.latencyMs != null ? `Answered in ${l.probe.latencyMs} ms` : "Answered our call", at: when, evidence: ev };
    if (l.liveness === "silent")
      return { key: "reachable", label: "Endpoint", state: "failed", headline: "Did not answer when we called", meaning: "We called the endpoint it publishes and nothing came back. It may be down, or moved.", at: when, evidence: ev };
    if (l.liveness === "no-endpoint")
      return { key: "reachable", label: "Endpoint", state: "nodata", headline: "Publishes no endpoint", meaning: "Its registration names nothing to call, so there is nothing for us to test.", at: when, evidence: ev };
    return { key: "reachable", label: "Endpoint", state: "nodata", headline: "Not called yet", meaning: "We have not reached it in our checks yet. That is different from it being silent.", at: when, evidence: ev };
  })();

  // --- wallet activity ---------------------------------------------------
  const act = byId(report, "activity");
  const active: Proof = (() => {
    const v = raw(act);
    if (v === "pass") return { key: "active", label: "Wallet", state: "proven", headline: "Its wallet transacts on BNB Smart Chain", at, evidence: evidenceOf(act) };
    if (v === "fail")
      return { key: "active", label: "Wallet", state: "unproven", headline: "No recent activity from its wallet", meaning: "Agents that act rarely, or that act through a session on someone else's account, look like this.", at, evidence: evidenceOf(act) };
    if (v === "na") return { key: "active", label: "Wallet", state: "nodata", headline: "Does not apply to this agent", at, evidence: evidenceOf(act) };
    return { key: "active", label: "Wallet", state: "nodata", headline: "Not checked yet", at, evidence: evidenceOf(act) };
  })();

  // --- capability: did it touch what its job needs -----------------------
  const cap = byId(report, "capability");
  const protocols = cap?.proven?.protocols ?? [];
  const capability: Proof = (() => {
    const v = raw(cap);
    if (v === "pass")
      return { key: "capability", label: "Capability", state: "proven", headline: protocols.length ? `Touched ${protocols.slice(0, 2).join(" and ")}` : "Did what its job requires", at, evidence: evidenceOf(cap) };
    if (v === "fail")
      return {
        key: "capability",
        label: "Capability",
        state: "unproven",
        headline: "Not seen doing its job on chain yet",
        meaning: `We scanned ${cap?.proven?.scannedBlocks ?? "recent"} blocks and did not see it touch the contracts its job needs. Agents that act rarely, or only read, look like this.`,
        at,
        evidence: evidenceOf(cap),
      };
    if (v === "na") return { key: "capability", label: "Capability", state: "nodata", headline: "Does not apply to this agent", at, evidence: evidenceOf(cap) };
    return { key: "capability", label: "Capability", state: "nodata", headline: "Not checked yet", at, evidence: evidenceOf(cap) };
  })();

  // --- custody: is the agent's key separate from its owner's --------------
  const cus = byId(report, "custody");
  const custody: Proof = (() => {
    const v = raw(cus);
    if (v === "pass") return { key: "custody", label: "Custody", state: "proven", headline: "Acts with a key separate from its owner", at, evidence: evidenceOf(cus) };
    if (v === "fail")
      return { key: "custody", label: "Custody", state: "failed", headline: "Signs with its owner's own wallet", meaning: "Nothing separates what the agent can do from everything its owner can do.", at, evidence: evidenceOf(cus) };
    if (v === "na") return { key: "custody", label: "Custody", state: "nodata", headline: "Never holds your funds", meaning: "It sells answers per call, so there is no custody to separate.", at, evidence: evidenceOf(cus) };
    return { key: "custody", label: "Custody", state: "nodata", headline: "Not checked yet", at, evidence: evidenceOf(cus) };
  })();

  // --- reputation ----------------------------------------------------------
  const rep = byId(report, "reputation");
  const reputation: Proof = (() => {
    const v = raw(rep);
    if (v === "pass") return { key: "reputation", label: "Reputation", state: "proven", headline: "Reviewed by wallets that review other agents too", at, evidence: evidenceOf(rep) };
    if (v === "fail")
      return { key: "reputation", label: "Reputation", state: "failed", headline: "Reviews look coordinated", meaning: "The wallets reviewing it mostly review nothing else, which is how a review ring looks.", at, evidence: evidenceOf(rep) };
    return { key: "reputation", label: "Reputation", state: "nodata", headline: l.reviews ? `${l.reviews} reviews, not yet assessed` : "No reviews yet", at, evidence: evidenceOf(rep) };
  })();

  // --- settled work --------------------------------------------------------
  const perf = byId(report, "performance");
  const settledProof: Proof = (() => {
    if (settled > 0) return { key: "settled", label: "Settled work", state: "proven", headline: `${settled} paid job${settled === 1 ? "" : "s"} delivered`, evidence: evidenceOf(perf) };
    if (raw(perf) === "fail")
      return { key: "settled", label: "Settled work", state: "failed", headline: "Lost to its benchmark", meaning: "It has a record, and the record is below doing nothing.", evidence: evidenceOf(perf) };
    return { key: "settled", label: "Settled work", state: "nodata", headline: "No settled history yet", meaning: "Nobody has paid it through this marketplace and had the work delivered yet. New agents all start here.", evidence: evidenceOf(perf) };
  })();

  const proofs = [reachable, active, capability, custody, reputation, settledProof];

  const counted = report ? report.results.filter((r) => !r.notApplicable) : [];
  const passed = counted.filter((r) => r.verdict === "pass").length;
  const timeline: Proof[] = [
    { key: "registered", label: "Registered", state: "proven", headline: `ERC-8004 identity #${l.tokenId}`, at: extra.createdAt ?? l.createdAt ?? null },
    { ...reachable, label: "Reachable" },
    { ...active, label: "Active" },
    { ...capability, label: "Capability checked" },
    report
      ? {
          key: "assayed",
          label: "Assayed",
          state: passed > 0 ? "proven" : "unproven",
          headline: `${passed} of ${counted.length} checks proven`,
          meaning: passed < counted.length ? "Checks that are not proven are listed above with what each one means. Most new agents prove a few." : undefined,
          at,
          evidence: {
            finding: "Each check reads the chain or calls the agent. None of them trusts its own description.",
            items: report.results.map((r) => ({ label: r.title, value: r.notApplicable ? "does not apply" : r.verdict === "pass" ? "proven" : r.verdict === "fail" ? "not shown" : "not enough data" })),
          },
        }
      : { key: "assayed", label: "Assayed", state: "nodata", headline: "Not checked yet" },
    { ...settledProof, label: "Settled" },
  ];

  const counts: Record<ProofState, number> = { proven: 0, unproven: 0, failed: 0, nodata: 0 };
  for (const p of proofs) counts[p.state] += 1;

  const badges: string[] = [];
  if (reachable.state === "proven") badges.push("Endpoint verified");
  if (active.state === "proven") badges.push("Wallet active");
  if (capability.state === "proven") badges.push("Capability proven");
  if (settledProof.state === "proven") badges.push("Settled work");
  if (custody.state === "proven") badges.push("Separate key");
  if (reputation.state === "proven") badges.push("Genuine reviews");

  return { proofs, timeline, counts, badges };
}
