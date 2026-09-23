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
import { applyQuery, EMPTY, PRED } from "@/lib/market/catalogue";
import { revokedWords } from "@/lib/market/events";
import { txStepOf } from "@/components/x/TxStatus";

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
    settled: 0,
    usdPrice: null,
    createdAt: null,
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

describe("the four verification states", () => {
  const proof = (t: ReturnType<typeof trustOf>, key: string) => t.proofs.find((p) => p.key === key)!;

  it("counts proven, not yet proven, failed and no data separately", () => {
    const t = trustOf(listing(), report({ identity: "pass", custody: "fail", activity: "pass", capability: "fail", reputation: "inconclusive", performance: "inconclusive" }));
    // Seven rows: the Tools row has no list to read on this agent, so it is "not enough data".
    expect(t.counts).toEqual({ proven: 2, unproven: 1, failed: 1, nodata: 3 });
  });

  it("says which protocol answered, and keeps an answer that is not an agent apart from silence", () => {
    const mcp = trustOf(listing({ probe: { answered: true, status: 200, latencyMs: 90, endpoint: "https://x.test/mcp", at: "2026-09-22T10:00:00Z", protocol: "mcp" } as never }), null);
    expect(mcp.proofs[0]).toMatchObject({ state: "proven", headline: "Answered in 90 ms over MCP" });
    const site = trustOf(listing({ liveness: "not-agent", probe: { answered: false, status: 200, latencyMs: 90, endpoint: "https://x.test", protocol: "http" } as never }), null);
    expect(site.proofs[0]).toMatchObject({ state: "unproven", headline: "Answers, but not as an agent" });
    const refused = trustOf(
      listing({ liveness: "no-endpoint", probe: { answered: false, status: null, latencyMs: null, endpoint: "http://10.0.0.1/x", refused: true, error: "we only call https, and that is http" } as never }),
      null,
    );
    expect(refused.proofs[0]).toMatchObject({ state: "failed", headline: "Points somewhere we will not call" });
  });

  it("proves tools only when what the server offers fits the card's job", () => {
    const withTools = (tools: { name: string; description?: string }[]) =>
      trustOf(listing({ probe: { answered: true, status: 200, latencyMs: 90, endpoint: "https://x.test/mcp", protocol: "mcp", tools } as never }), null).proofs.find((x) => x.key === "tools")!;
    expect(withTools([{ name: "get_position_range" }, { name: "ping" }])).toMatchObject({ state: "proven" });
    expect(withTools([{ name: "getWeather" }, { name: "tellJoke" }])).toMatchObject({ state: "failed", headline: "Its tools do not fit the job: getWeather, tellJoke" });
    expect(withTools([{ name: "ping" }, { name: "status" }])).toMatchObject({ state: "nodata" });
    expect(trustOf(listing({ probe: { answered: true, status: 200, latencyMs: 90, endpoint: "https://x.test/mcp", protocol: "mcp", tools: [{ name: "rebalance_lp" }] } as never }), null).badges).toContain("Tools fit its job");
  });

  it("calls a capability it did not see 'not yet proven', never failed", () => {
    const p = proof(trustOf(listing(), report({ capability: "fail" })), "capability");
    expect(p.state).toBe("unproven");
    expect(p.meaning).toMatch(/act rarely/);
  });

  it("calls a silent endpoint a failed check, and one never called 'not enough data'", () => {
    expect(proof(trustOf(listing({ liveness: "silent" }), null), "reachable").state).toBe("failed");
    expect(proof(trustOf(listing({ liveness: "untested", probe: null }), null), "reachable").state).toBe("nodata");
  });

  it("calls an agent that signs with its owner's wallet a failed custody check", () => {
    expect(proof(trustOf(listing(), report({ custody: "fail" })), "custody").state).toBe("failed");
  });

  it("says a seller of answers never holds funds rather than failing custody", () => {
    const p = proof(trustOf(listing(), report({ custody: "na" })), "custody");
    expect(p.state).toBe("nodata");
    expect(p.headline).toBe("Never holds your funds");
  });

  it("never shows a proven state or a badge without a passing check", () => {
    const t = trustOf(listing({ liveness: "untested", probe: null }), report({ activity: "fail", capability: "fail", custody: "fail", reputation: "fail" }));
    expect(t.proofs.filter((p) => p.state === "proven")).toHaveLength(0);
    expect(t.badges).toEqual([]);
  });

  it("shows settled work only when there is some", () => {
    expect(proof(trustOf(listing(), null, { settled: 0 }), "settled").state).toBe("nodata");
    expect(proof(trustOf(listing(), null, { settled: 3 }), "settled").headline).toBe("3 paid jobs delivered");
  });

  it("runs the timeline in the order a buyer reads it", () => {
    expect(trustOf(listing(), null).timeline.map((n) => n.key)).toEqual(["registered", "reachable", "active", "capability", "assayed", "settled"]);
  });
});

import { priceParts, usd } from "@/components/x/Price";

describe("price", () => {
  it("shows dollars when the agent prices in a dollar stablecoin, with the exact quote underneath", () => {
    expect(priceParts({ usdPrice: 0.05, priceLabel: "0.05 USDT", declaresPayment: true })).toMatchObject({ value: "$0.05", unit: "/ call", exact: "0.05 USDT" });
  });

  it("keeps the seller's own unit when it is not a dollar", () => {
    expect(priceParts({ usdPrice: null, priceLabel: "0.001 WBNB", declaresPayment: true })).toMatchObject({ value: "0.001 WBNB", unit: "/ call" });
  });

  it("never presents a missing price as free", () => {
    expect(priceParts({ usdPrice: null, priceLabel: null, declaresPayment: false })).toMatchObject({ value: null, none: "No price published" });
    expect(priceParts({ usdPrice: null, priceLabel: null, declaresPayment: true }).none).toMatch(/not read yet/);
  });

  it("does not round a real small charge down to nothing", () => {
    expect(usd(0.005)).toBe("$0.005");
    expect(usd(0.02)).toBe("$0.02");
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(0)).toBe("$0.00");
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

describe("marketplace sorts", () => {
  const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
  const probe = (m: number, answered = true) => ({ answered, status: 200, latencyMs: 100, endpoint: "https://x.test", at: at(m) });

  it("orders Recently active by our latest answer, and silent agents last", () => {
    const shelf = [
      listing({ tokenId: "1", probe: probe(90) as never }),
      listing({ tokenId: "2", probe: probe(5, false) as never, liveness: "silent" }),
      listing({ tokenId: "3", probe: probe(10) as never }),
    ];
    const ids = applyQuery(shelf, { ...EMPTY, sort: "recent" }).shown.map((l) => l.tokenId);
    expect(ids).toEqual(["3", "1", "2"]);
  });

  it("orders Fastest by response time, and never puts a silent agent first", () => {
    const shelf = [
      listing({ tokenId: "1", probe: { ...probe(5), latencyMs: 400 } as never }),
      listing({ tokenId: "2", probe: probe(5, false) as never, liveness: "silent" }),
      listing({ tokenId: "3", probe: { ...probe(5), latencyMs: 60 } as never }),
    ];
    const ids = applyQuery(shelf, { ...EMPTY, sort: "fastest" }).shown.map((l) => l.tokenId);
    expect(ids).toEqual(["3", "1", "2"]);
  });

  it("orders Most activity by settled work, then reviews, then hires", () => {
    const shelf = [
      listing({ tokenId: "1", reviews: 9 }),
      listing({ tokenId: "2", settled: 2 }),
      listing({ tokenId: "3", reviews: 9, hires: 4 }),
      listing({ tokenId: "4" }),
    ];
    const ids = applyQuery(shelf, { ...EMPTY, sort: "activity" }).shown.map((l) => l.tokenId);
    expect(ids).toEqual(["2", "3", "1", "4"]);
  });

  it("filters Price published to agents whose price we actually read", () => {
    expect(PRED.priced(listing({ declaresPayment: true, quote: null }))).toBe(false);
    expect(PRED.priced(listing({ quote: { payable: true, amount: "50000", decimals: 6 } as never }))).toBe(true);
  });
});

describe("market events", () => {
  it("names a leftover key for what it is rather than as an internal orphan", () => {
    expect(revokedWords("Orphaned key 0x12ab")).toEqual({ actor: "A leftover key on the demo account", what: "was revoked" });
    expect(revokedWords("Mandate Range-1")).toEqual({ actor: "Mandate Range-1", what: "had its permission revoked" });
  });
});

describe("the hire drawer's payment steps", () => {
  it("maps the payment engine's phases onto the four steps a buyer watches", () => {
    expect(txStepOf("quoting")).toBe("preparing");
    expect(txStepOf("quoted")).toBe("awaiting");
    expect(txStepOf("approving")).toBe("awaiting");
    expect(txStepOf("signing")).toBe("awaiting");
    expect(txStepOf("settling")).toBe("submitted");
    expect(txStepOf("done")).toBe("confirmed");
  });

  it("has no step for idle or a failure, which the drawer shows in place", () => {
    expect(txStepOf("idle")).toBeNull();
    expect(txStepOf("failed")).toBeNull();
  });
});
