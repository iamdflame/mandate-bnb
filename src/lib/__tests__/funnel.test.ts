/**
 * The home page's funnel, held to its one promise: every figure is a count of
 * something real, taken from a named source, and a source that did not answer
 * shows as unknown rather than as a zero nobody measured.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/market/listing";

const chain = vi.hoisted(() => ({ registeredCount: vi.fn() }));
const index = vi.hoisted(() => ({ value: { agents: new Array(4436).fill({}), registry: { registered: 311_300 }, capturedAt: "2026-09-10T00:00:00Z" } }));

vi.mock("@/lib/registry/count", () => chain);
vi.mock("@/lib/data/agents", () => ({ getAgentIndex: () => index.value }));
vi.mock("@/lib/market/listing", async (orig) => ({
  ...(await orig<typeof import("@/lib/market/listing")>()),
  censusAge: () => ({ at: "2026-09-22T10:00:00Z", minutes: 5, stale: false }),
}));

const { funnel, logHeights } = await import("@/lib/market/funnel");
const { PRED } = await import("@/lib/market/catalogue");

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const quote = { payable: true, amount: "50000", decimals: 6, endpoint: "https://x.test", transferMethod: "eip3009" };

const agent = (tokenId: string, over: Partial<Listing>): Listing =>
  ({
    tokenId,
    name: `Agent ${tokenId}`,
    what: null,
    category: "rebalancing",
    owner: null,
    protocols: [],
    probe: { answered: true, status: 402, latencyMs: 200, endpoint: "https://x.test", at: minutesAgo(5) },
    liveness: "live",
    declaresPayment: true,
    quote: null,
    priceLabel: null,
    usdPrice: null,
    reviews: 0,
    hires: 0,
    settled: 0,
    readiness: 0,
    confidence: 1,
    createdAt: null,
    ...over,
  }) as unknown as Listing;

const shelf: Listing[] = [
  // Answered five minutes ago with a price we can pay: hireable.
  agent("900001", { quote: quote as never, priceLabel: "0.05 USDT", usdPrice: 0.05 }),
  // Priced, but its last answer is three days old: not offered for hire.
  agent("900002", { quote: quote as never, priceLabel: "0.05 USDT", usdPrice: 0.05, probe: { answered: true, status: 402, latencyMs: 200, endpoint: "https://x.test", at: minutesAgo(3 * 24 * 60) } as never }),
  // Answers, says it charges, has not given us a price.
  agent("900003", {}),
  // Silent when called.
  agent("900004", { liveness: "silent", probe: { answered: false, status: null, latencyMs: null, endpoint: "https://x.test", at: minutesAgo(5) } as never }),
];

beforeEach(() => {
  chain.registeredCount.mockReset();
  index.value = { agents: new Array(4436).fill({}), registry: { registered: 311_300 }, capturedAt: "2026-09-10T00:00:00Z" };
});

describe("the registry funnel", () => {
  it("counts each stage with the same predicate the list behind it uses", async () => {
    chain.registeredCount.mockResolvedValue({ count: 311_412, block: 62_000_000, at: "2026-09-22T10:00:00Z" });
    const s = Object.fromEntries((await funnel(shelf)).map((x) => [x.key, x.n]));
    expect(s.listed).toBe(shelf.length);
    expect(s.reachable).toBe(shelf.filter(PRED.live).length);
    expect(s.priced).toBe(shelf.filter(PRED.priced).length);
    expect(s.hireable).toBe(shelf.filter(PRED.hireable).length);
    expect([s.listed, s.reachable, s.priced, s.hireable]).toEqual([4, 3, 2, 1]);
  });

  it("only narrows from one stage to the next", async () => {
    chain.registeredCount.mockResolvedValue({ count: 311_412, block: 62_000_000, at: "2026-09-22T10:00:00Z" });
    const n = (await funnel(shelf)).map((x) => x.n as number);
    for (let i = 1; i < n.length; i++) expect(n[i]).toBeLessThanOrEqual(n[i - 1]);
  });

  it("reads the registry from the chain and names the block", async () => {
    chain.registeredCount.mockResolvedValue({ count: 311_412, block: 62_000_000, at: "2026-09-22T10:00:00Z" });
    const [registered] = await funnel(shelf);
    expect(registered.n).toBe(311_412);
    expect(registered.source).toContain("62,000,000");
  });

  it("falls back to the last index, and says so, when the chain does not answer", async () => {
    chain.registeredCount.mockRejectedValue(new Error("rpc down"));
    const [registered] = await funnel(shelf);
    expect(registered.n).toBe(311_300);
    expect(registered.source).toContain("last index");
  });

  it("shows unknown, never zero, when no source has the figure", async () => {
    chain.registeredCount.mockRejectedValue(new Error("rpc down"));
    index.value = { agents: [], registry: { registered: 0 }, capturedAt: "2026-09-10T00:00:00Z" };
    const s = await funnel(shelf);
    expect(s.find((x) => x.key === "registered")!.n).toBeNull();
    expect(s.find((x) => x.key === "readable")!.n).toBeNull();
  });

  it("links every stage it can to the list it counts", async () => {
    chain.registeredCount.mockResolvedValue({ count: 1, block: 1, at: "2026-09-22T10:00:00Z" });
    const s = await funnel(shelf);
    expect(s.find((x) => x.key === "hireable")!.href).toBe("/agents?hireable=1");
    expect(s.find((x) => x.key === "priced")!.href).toBe("/agents?priced=1");
  });

  it("draws bars on a log scale that keeps the smallest stage visible and unknown as a gap", () => {
    const h = logHeights([{ n: 311_300 }, { n: 19 }, { n: 0 }, { n: null }]);
    expect(h[0]).toBe(1);
    expect(h[1]).toBeGreaterThan(0.2);
    expect(h[2]).toBe(0.06);
    expect(h[3]).toBeNull();
  });
});
