/**
 * What we actually know about an agent, as six nodes.
 *
 * The six checks are the product's differentiator and they used to arrive as
 * six long paragraphs. This turns the stored assay and the live probe into a
 * short timeline every surface can share: the tile shows the count and the
 * first facts that are true, the agent page shows every node with its
 * evidence, and compare lines them up. One function, so no two surfaces can
 * disagree about whether something was checked.
 *
 * A node that failed is a fact, not an accusation. "Not demonstrated" means
 * the chain did not show it in the window we scanned, which is different from
 * the agent being unable to do it, and the wording keeps that difference.
 *
 * There is deliberately no aggregate score here. "3 of 6 verified" with the
 * three named is honest; a single number would hide which three.
 */

import type { AssayReport, AssayResult } from "@/lib/assay/types";
import type { Listing } from "@/lib/market/listing";

export type NodeState = "pass" | "fail" | "unknown" | "na";

export interface TrustNode {
  key: "registered" | "reachable" | "active" | "capability" | "assayed" | "settled";
  label: string;
  state: NodeState;
  /** One short line. What we saw, not what we think of it. */
  detail: string;
  /** ISO time the fact was established, when there is one. */
  at?: string | null;
  /** The full finding, for the reader who opens the node. */
  evidence?: { finding: string; items: { label: string; value: string; url?: string }[] } | null;
}

export interface Trust {
  nodes: TrustNode[];
  /** Checks from the stored assay that passed, and how many applied. */
  verified: number | null;
  applicable: number | null;
  /** Short true statements for a tile, strongest first. */
  badges: string[];
}

const byId = (r: AssayReport | null, id: AssayResult["id"]) => r?.results.find((x) => x.id === id) ?? null;

function stateOf(r: AssayResult | null): NodeState {
  if (!r) return "unknown";
  if (r.notApplicable) return "na";
  return r.verdict === "pass" ? "pass" : r.verdict === "fail" ? "fail" : "unknown";
}

function evidenceOf(r: AssayResult | null): TrustNode["evidence"] {
  if (!r) return null;
  return {
    finding: r.finding,
    items: r.evidence.slice(0, 6).map((e) => ({ label: e.label, value: e.value, url: e.url })),
  };
}

export function trustOf(
  l: Listing,
  report: AssayReport | null,
  extra: { createdAt?: string | null; settled?: number } = {},
): Trust {
  const activity = byId(report, "activity");
  const capability = byId(report, "capability");
  const applicable = report ? report.results.filter((r) => !r.notApplicable) : null;
  const verified = applicable ? applicable.filter((r) => r.verdict === "pass").length : null;
  const settled = extra.settled ?? l.hires;

  const reach: TrustNode = (() => {
    const at = l.probe?.at ?? null;
    if (l.liveness === "live") {
      return {
        key: "reachable",
        label: "Reachable",
        state: "pass",
        detail: l.probe?.latencyMs != null ? `Answered in ${l.probe.latencyMs} ms` : "Answered our call",
        at,
      };
    }
    if (l.liveness === "silent") return { key: "reachable", label: "Reachable", state: "fail", detail: "Did not answer when we called", at };
    if (l.liveness === "no-endpoint") return { key: "reachable", label: "Reachable", state: "na", detail: "Publishes no endpoint to call", at };
    return { key: "reachable", label: "Reachable", state: "unknown", detail: "Not called yet", at };
  })();

  const capProtocols = capability?.proven?.protocols ?? [];
  const nodes: TrustNode[] = [
    {
      key: "registered",
      label: "Registered",
      state: "pass",
      detail: `ERC-8004 identity #${l.tokenId}`,
      at: extra.createdAt ?? null,
    },
    reach,
    {
      key: "active",
      label: "Wallet active",
      state: stateOf(activity),
      detail:
        stateOf(activity) === "pass"
          ? "Its wallet transacts on BNB Smart Chain"
          : stateOf(activity) === "fail"
            ? "No recent activity from its wallet"
            : stateOf(activity) === "na"
              ? "Does not apply to this agent"
              : "Not checked yet",
      evidence: evidenceOf(activity),
    },
    {
      key: "capability",
      label: "Capability",
      state: stateOf(capability),
      detail:
        stateOf(capability) === "pass"
          ? capProtocols.length
            ? `Touched ${capProtocols.slice(0, 2).join(" and ")}`
            : "Did what its category requires"
          : stateOf(capability) === "fail"
            ? "Not demonstrated in the blocks we scanned"
            : stateOf(capability) === "na"
              ? "Does not apply to this agent"
              : "Not checked yet",
      evidence: evidenceOf(capability),
    },
    {
      key: "assayed",
      label: "Verified",
      state: verified === null ? "unknown" : verified >= Math.ceil((applicable?.length ?? 6) / 2) ? "pass" : "fail",
      detail: verified === null ? "Not checked yet" : `${verified} of ${applicable?.length ?? 6} checks passed`,
      at: report?.assayedAt ?? null,
      evidence: report
        ? {
            finding: "Each check reads the chain or calls the agent. None of them trusts its own description.",
            items: report.results.map((r) => ({
              label: r.title,
              value: r.notApplicable ? "does not apply" : r.verdict === "pass" ? "passed" : r.verdict === "fail" ? "not shown" : "could not tell",
            })),
          }
        : null,
    },
    {
      key: "settled",
      label: "Settled work",
      state: settled > 0 ? "pass" : "unknown",
      detail: settled > 0 ? `${settled} paid job${settled === 1 ? "" : "s"} delivered` : "No settled history yet",
    },
  ];

  const badges: string[] = [];
  if (reach.state === "pass") badges.push("Reachable");
  if (stateOf(activity) === "pass") badges.push("Wallet active");
  if (stateOf(capability) === "pass") badges.push("Capability checked");
  if (l.quote?.payable) badges.push("Price published");
  if (settled > 0) badges.push("Settled work");

  return { nodes, verified, applicable: applicable?.length ?? null, badges };
}
