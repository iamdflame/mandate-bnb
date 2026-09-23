/**
 * The seller and buyer doors, as data: /api/v1/list and /api/v1/diagnose.
 *
 * Every public answer on this site carries the block it was read at, because
 * an unstamped number is a claim. These hold that for the two new endpoints,
 * hold their refusals, and hold the mapping from what a diagnosis found to
 * the agents a buyer could actually hire for it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/lib/market/listing";

const m = vi.hoisted(() => ({ diagnose: vi.fn(), checkListing: vi.fn(), listings: vi.fn(), hireCounts: vi.fn(), readAgentIndex: vi.fn(), findAgent: vi.fn() }));
vi.mock("@/lib/diagnose", () => ({ diagnose: m.diagnose }));
vi.mock("@/lib/market/hires", () => ({ hireCounts: m.hireCounts }));
vi.mock("@/lib/data/live", () => ({ live: async () => undefined }));
vi.mock("@/lib/market/listing", async (orig) => ({ ...(await orig<typeof import("@/lib/market/listing")>()), listings: m.listings }));
vi.mock("@/lib/market/list-check", async (orig) => ({ ...(await orig<typeof import("@/lib/market/list-check")>()), checkListing: m.checkListing }));
vi.mock("@/lib/data/agents", async (orig) => ({ ...(await orig<typeof import("@/lib/data/agents")>()), readAgentIndex: m.readAgentIndex, findAgent: m.findAgent }));
vi.mock("@/lib/rung", async (orig) => {
  const real = await orig<typeof import("@/lib/rung")>();
  return { ...real, readMarketSets: async () => real.EMPTY_SETS };
});

const { agentsFor } = await import("@/lib/diagnose/agents");
const { ChainUnread } = await import("@/lib/market/list-check");
const diagnoseRoute = await import("@/app/api/v1/diagnose/[address]/route");
const listRoute = await import("@/app/api/v1/list/route");
const agentsRoute = await import("@/app/api/v1/agents/route");

const now = () => new Date().toISOString();
// Token ids far outside the registry, so no real record or pause touches them.
const agent = (over: Partial<Listing>): Listing =>
  ({
    tokenId: "990000001",
    name: "Agent",
    what: null,
    category: "rebalancing",
    categoryLabel: "Rebalancing",
    confidence: 1,
    matched: [],
    owner: "0x00000000000000000000000000000000000000aa",
    protocols: [],
    probe: { answered: true, status: 402, latencyMs: 200, endpoint: "https://a.test/x402", at: now(), protocol: "x402" },
    liveness: "live",
    declaresPayment: true,
    quote: { payable: true, unpayable: null, amount: "50000000000000000", decimals: 18, endpoint: "https://a.test/x402", transferMethod: "eip3009" },
    priceLabel: "0.05 USD1",
    usdPrice: 0.05,
    registryVerified: false,
    reviews: 0,
    reviewQuality: null,
    checksPassed: null,
    custodySeparate: null,
    avgScore: null,
    registryScore: null,
    hires: 0,
    settled: 0,
    createdAt: null,
    signals: [],
    readiness: 50,
    copies: 1,
    firstOfProduct: true,
    ...over,
  }) as Listing;

const hireableRange = agent({ tokenId: "990000001", name: "Range for hire" });
const silentRange = agent({ tokenId: "990000002", name: "Range, no price", quote: null, priceLabel: null, usdPrice: null });
const hireableGuard = agent({ tokenId: "990000003", name: "Guard for hire", category: "health-factor", categoryLabel: "Health factor" });

const req = (url: string, ip: string, init: RequestInit = {}) => new Request(url, { ...init, headers: { "x-forwarded-for": ip, ...(init.headers ?? {}) } });

beforeEach(() => {
  m.diagnose.mockReset();
  m.checkListing.mockReset();
  m.listings.mockReset().mockReturnValue([hireableRange, silentRange, hireableGuard]);
  m.hireCounts.mockReset().mockResolvedValue({ byTokenId: new Map(), settled: new Map(), thirdParty: 0, operated: 0 });
});

describe("what a diagnosis maps to", () => {
  it("offers, per job the wallet needs and in its order, only the agents a buyer could hire, and counts the rest", () => {
    const out = agentsFor(["health-factor", "rebalancing"], [hireableRange, silentRange, hireableGuard]);
    expect(out.map((c) => c.category)).toEqual(["health-factor", "rebalancing"]);
    expect(out[0]!.hireable.map((l) => l.tokenId)).toEqual(["990000003"]);
    expect(out[1]!.hireable.map((l) => l.tokenId)).toEqual(["990000001"]);
    expect(out[1]).toMatchObject({ total: 1, answering: 2 });
  });

  it("recommends nobody for a job no hireable agent does", () => {
    expect(agentsFor(["yield-optimisation"], [hireableRange])).toEqual([{ category: "yield-optimisation", hireable: [], total: 0, answering: 0 }]);
  });
});

describe("GET /api/v1/diagnose/[address]", () => {
  const call = (input: string, ip: string) => diagnoseRoute.GET(req(`https://t.test/api/v1/diagnose/${input}`, ip), { params: Promise.resolve({ address: input }) });

  it("answers with the block it read, the findings, and who could fix them", async () => {
    m.diagnose.mockResolvedValue({
      input: "0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90",
      kind: "wallet",
      blockNumber: "123573916",
      positions: [{ tokenId: "7408923", liquidity: 5n, inRange: false }],
      venus: { error: 0n, healthFactor: 5.3, liquidityUsd: 0.26, shortfallUsd: 0, assetsIn: 2, active: true },
      idle: null,
      findings: [{ kind: "out-of-range", severity: "act", category: "rebalancing", title: "Position #7408923 is out of range" }],
      needed: ["rebalancing"],
      population: null,
    });
    const res = await call("0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90", "10.0.0.1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { observed: { blockNumber: string }; data: { blockNumber: string; positions: { liquidity: string }[]; agents: { category: string; best: { tokenId: string; hire: string }[] }[] } };
    expect(body.observed.blockNumber).toBe("123573916");
    expect(body.data.blockNumber).toBe("123573916");
    expect(body.data.positions[0]!.liquidity).toBe("5");
    expect(body.data.agents).toEqual([expect.objectContaining({ category: "rebalancing" })]);
    expect(body.data.agents[0]!.best.map((b) => b.tokenId)).toEqual(["990000001"]);
    expect(body.data.agents[0]!.best[0]!.hire).toMatch(/\/hire\/990000001$/);
  });

  it("refuses an input that is neither a wallet nor a position id", async () => {
    const res = await call("not-a-wallet", "10.0.0.2");
    expect(res.status).toBe(400);
    expect(m.diagnose).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/list", () => {
  const post = (body: string, ip: string) => listRoute.POST(req("https://t.test/api/v1/list", ip, { method: "POST", body, headers: { "content-type": "application/json" } }));

  it("answers with the seller's standing, stamped with the block its identity was read at", async () => {
    m.checkListing.mockResolvedValue({ tokenId: "342379", at: now(), blockNumber: "123570000", placement: { rung: 3, name: "Priced", rungs: [], next: { rung: 4, name: "Hallmarked", todo: "Run the assay" } } });
    const res = await post('{"tokenId":"342379"}', "10.0.1.1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { observed: { blockNumber: string }; data: { placement: { next: { name: string } } } };
    expect(body.observed.blockNumber).toBe("123570000");
    expect(body.data.placement.next.name).toBe("Hallmarked");
    expect(m.checkListing).toHaveBeenCalledWith("342379");
  });

  it("refuses a body that is not JSON, and a token id that is not a number", async () => {
    expect((await post("tokenId=1", "10.0.1.2")).status).toBe(400);
    expect((await post('{"tokenId":"abc"}', "10.0.1.3")).status).toBe(400);
    expect(m.checkListing).not.toHaveBeenCalled();
  });

  it("says the chain could not be read rather than calling a token missing", async () => {
    m.checkListing.mockRejectedValue(new ChainUnread("BNB Smart Chain did not answer just now"));
    const res = await post('{"tokenId":"1"}', "10.0.1.4");
    expect(res.status).toBe(503);
  });

  it("allows four checks a minute from one caller, each of which calls the agent", async () => {
    m.checkListing.mockResolvedValue({ tokenId: "1", at: now(), blockNumber: "1", placement: { rung: 0, name: "Registered", rungs: [], next: null } });
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await post('{"tokenId":"1"}', "10.0.1.5")).status);
    expect(codes).toEqual([200, 200, 200, 200, 429]);
  });
});

describe("GET /api/v1/agents?hireable=1", () => {
  const indexed = (tokenId: string, category: string) => ({ tokenId, name: tokenId, description: null, owner: null, imageUrl: null, protocols: [], x402: true, registryScore: null, feedbacks: 0, avgScore: null, createdAt: null, category, confidence: 1, matched: [] });

  beforeEach(() => {
    m.readAgentIndex.mockReset().mockResolvedValue({
      chainId: 56,
      capturedAt: now(),
      apiCalls: 0,
      registry: { registered: 3, withEndpoint: 3, withFeedback: 0 },
      registryBlock: 123570001,
      counts: {},
      agents: [indexed("990000001", "rebalancing"), indexed("990000002", "rebalancing"), indexed("990000003", "health-factor")],
    });
  });

  it("returns only what the hire law would offer, with the census's age and the registry's block", async () => {
    const res = await agentsRoute.GET(req("https://t.test/api/v1/agents?hireable=1", "10.0.2.1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { observed: { blockNumber: string }; data: { agents: { tokenId: string; hireable: boolean }[]; census: Record<string, unknown>; filter: { hireable: boolean } } };
    expect(body.data.agents.map((a) => a.tokenId).sort()).toEqual(["990000001", "990000003"]);
    expect(body.data.agents.every((a) => a.hireable)).toBe(true);
    expect(body.data.filter.hireable).toBe(true);
    expect(Object.keys(body.data.census).sort()).toEqual(["at", "minutes", "stale"]);
    expect(body.observed.blockNumber).toBe("123570001");
  });

  it("keeps a hireable agent the register has not crawled yet, from the census's own index", async () => {
    const full = await m.readAgentIndex();
    m.readAgentIndex.mockResolvedValue({ ...full, agents: full.agents.filter((a: { tokenId: string }) => a.tokenId !== "990000003") });
    m.findAgent.mockImplementation((id: string) => (id === "990000003" ? indexed("990000003", "health-factor") : null));
    const res = await agentsRoute.GET(req("https://t.test/api/v1/agents?hireable=1", "10.0.2.3"));
    const body = (await res.json()) as { data: { agents: { tokenId: string }[] } };
    expect(body.data.agents.map((a) => a.tokenId).sort()).toEqual(["990000001", "990000003"]);
  });

  it("refuses a hireable value it does not understand instead of ignoring it", async () => {
    const res = await agentsRoute.GET(req("https://t.test/api/v1/agents?hireable=yes", "10.0.2.2"));
    expect(res.status).toBe(400);
  });
});
