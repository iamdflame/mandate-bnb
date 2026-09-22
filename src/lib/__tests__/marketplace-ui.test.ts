/**
 * The marketplace's shared pieces, held to what they promise.
 *
 * Artwork has to be the same picture for the same agent on the server and in
 * the browser, or every page hydrates with a mismatch and every agent changes
 * face on reload. Trust nodes have to report exactly what the stored checks
 * say: a node that shows a pass the assay does not contain is a fabricated
 * claim, which is the one thing this product cannot ship.
 */

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AgentArtwork from "@/components/x/AgentArtwork";
import { trustOf } from "@/lib/market/trust";
import type { Listing } from "@/lib/market/listing";
import type { AssayReport } from "@/lib/assay/types";

const art = (category: Parameters<typeof AgentArtwork>[0]["category"], seed: string) =>
  renderToStaticMarkup(createElement(AgentArtwork, { category, seed }));

describe("agent artwork", () => {
  it("draws the same picture for the same agent every time", () => {
    expect(art("rebalancing", "342379:Range Check")).toBe(art("rebalancing", "342379:Range Check"));
  });

  it("draws different agents in one category differently", () => {
    expect(art("grid-trading", "1:A")).not.toBe(art("grid-trading", "2:B"));
  });

  it("draws every category and the unfiled case without throwing", () => {
    for (const c of ["rebalancing", "grid-trading", "yield-optimisation", "health-factor", null] as const) {
      expect(art(c, "7:x")).toContain("<svg");
    }
  });

  it("is decorative unless given a title", () => {
    expect(art("health-factor", "9:y")).toContain('aria-hidden="true"');
  });
});

const listing = (over: Partial<Listing> = {}): Listing =>
  ({
    tokenId: "42",
    name: "Test agent",
    what: null,
    category: "rebalancing",
    categoryLabel: "Rebalancing",
    confidence: 1,
    matched: [],
    owner: null,
    protocols: [],
    probe: { answered: true, status: 402, latencyMs: 300, endpoint: "https://x.test", at: "2026-09-22T10:00:00Z" },
    liveness: "live",
    declaresPayment: true,
    quote: null,
    priceLabel: null,
    registryVerified: false,
    reviews: 0,
    reviewQuality: null,
    checksPassed: null,
    custodySeparate: null,
    avgScore: null,
    registryScore: null,
    hires: 0,
    signals: [],
    readiness: 0,
    ...over,
  }) as Listing;

const report = (verdicts: Record<string, "pass" | "fail" | "inconclusive" | "na">): AssayReport =>
  ({
    results: Object.entries(verdicts).map(([id, v]) => ({
      id,
      title: id,
      claim: "",
      finding: `finding for ${id}`,
      verdict: v === "na" ? "inconclusive" : v,
      notApplicable: v === "na" ? true : undefined,
      score: 0,
      weight: 0,
      evidence: [],
    })),
    assayedAt: "2026-09-20T00:00:00Z",
  }) as unknown as AssayReport;

describe("trust nodes", () => {
  it("counts only applicable checks, and only the ones that passed", () => {
    const t = trustOf(listing(), report({ identity: "pass", custody: "na", activity: "pass", capability: "fail", reputation: "inconclusive", performance: "fail" }));
    expect(t.verified).toBe(2);
    expect(t.applicable).toBe(5);
  });

  it("says nothing was checked when there is no stored assay, rather than zero", () => {
    const t = trustOf(listing(), null);
    expect(t.verified).toBeNull();
    expect(t.nodes.find((n) => n.key === "assayed")?.detail).toBe("Not checked yet");
  });

  it("never badges a capability the assay did not pass", () => {
    const t = trustOf(listing(), report({ activity: "pass", capability: "fail" }));
    expect(t.badges).toContain("Wallet active");
    expect(t.badges).not.toContain("Capability checked");
  });

  it("reports a silent endpoint as not reachable, and an uncalled one as unknown", () => {
    expect(trustOf(listing({ liveness: "silent" }), null).nodes.find((n) => n.key === "reachable")?.state).toBe("fail");
    expect(trustOf(listing({ liveness: "untested", probe: null }), null).nodes.find((n) => n.key === "reachable")?.state).toBe("unknown");
  });

  it("shows settled work only when there is some", () => {
    expect(trustOf(listing({ hires: 0 }), null).nodes.find((n) => n.key === "settled")?.state).toBe("unknown");
    expect(trustOf(listing(), null, { settled: 3 }).nodes.find((n) => n.key === "settled")?.detail).toBe("3 paid jobs delivered");
  });
});

import { intentOf } from "@/lib/market/intent";

describe("search intent", () => {
  it("maps the brief's four examples to the right job", () => {
    expect(intentOf("protect my Venus loan")?.category).toBe("health-factor");
    expect(intentOf("rebalance my PancakeSwap liquidity")?.category).toBe("rebalancing");
    expect(intentOf("find better stablecoin yield")?.category).toBe("yield-optimisation");
    expect(intentOf("automate grid trades")?.category).toBe("grid-trading");
  });

  it("maps the home page's intent chips and placeholders", () => {
    expect(intentOf("Rebalance my PancakeSwap LP")?.category).toBe("rebalancing");
    expect(intentOf("Monitor my Venus health factor")?.category).toBe("health-factor");
    expect(intentOf("Run a grid strategy")?.category).toBe("grid-trading");
    expect(intentOf("Protect a loan")?.category).toBe("health-factor");
    expect(intentOf("Optimise yield")?.category).toBe("yield-optimisation");
  });

  it("does not decide on one weak word, and returns nothing for a name", () => {
    expect(intentOf("safe")).toBeNull();
    expect(intentOf("Agripinaa")).toBeNull();
  });
});
