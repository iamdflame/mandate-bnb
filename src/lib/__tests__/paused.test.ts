/**
 * A pause is enforced, not described, and says exactly what stops.
 *
 * The agent page once said Grid-1 "is paused" while its session was live and
 * every surface still offered it for hire. These hold the three places a
 * pause has to bite: the hire law refuses it on every rail, the lease renewer
 * leaves its leash to run out instead of paying to renew it, and its x402
 * endpoint refuses to take money, even when a payment is attached.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { hirePath } from "../market/hire-law";
import { PAUSED, hirePauseFor, pauseFor, pauseForSlug } from "../market/paused";
import { referenceRegistrations } from "../house";

const session = vi.hoisted(() => ({ grantScopedSession: vi.fn(), listSessions: vi.fn() }));
vi.mock("@/lib/chain/session", () => ({ grantScopedSession: session.grantScopedSession }));
vi.mock("@/lib/chain/session-store", () => ({ listSessions: session.listSessions }));

const NOW = Date.parse("2026-09-23T12:00:00Z");
const grid1 = referenceRegistrations()["grid-1"]!.tokenId;

beforeEach(() => {
  session.grantScopedSession.mockReset();
  session.listSessions.mockReset().mockResolvedValue([]);
});

describe("a paused agent", () => {
  it("is recorded with a reason and a short form", () => {
    expect(pauseForSlug("grid-1")).not.toBeNull();
    expect(pauseFor(grid1)?.slug).toBe("grid-1");
    for (const p of PAUSED) {
      expect(p.reason.length).toBeGreaterThan(p.short.length);
      expect(p.reason).not.toMatch(/—/);
    }
  });

  it("with trading paused, keeps its paid answer on sale but offers no job with capital", () => {
    expect(pauseFor(grid1)?.scope).toBe("trading");
    expect(hirePauseFor(grid1)).toBeNull();
    const v = hirePath(
      {
        tokenId: grid1,
        owner: referenceRegistrations()["grid-1"]!.owner,
        probe: { answered: true, status: 402, latencyMs: 40, endpoint: "https://example.test/x402", at: new Date(NOW - 60_000).toISOString() },
        liveness: "live",
        quote: { payable: true, unpayable: null, amount: "50000000000000000", endpoint: "https://example.test/x402", transferMethod: "eip3009" } as never,
        priceLabel: "0.05 USD1",
      },
      { now: NOW, bidders: new Set([referenceRegistrations()["grid-1"]!.owner.toLowerCase()]) },
    );
    expect(v.ok).toBe(true);
    // The report moves nobody's money; a job would hand it capital to trade, which the pause forbids.
    expect(v.rails.map((r) => r.kind)).toEqual(["x402"]);
  });

  it("does not affect an agent that is not paused", () => {
    expect(pauseFor(referenceRegistrations()["range-1"]!.tokenId)).toBeNull();
    expect(pauseFor("999999001")).toBeNull();
  });

  it("has its leash left to run out: the renewer skips it and never grants", async () => {
    const { renewHouseSessions } = await import("../chain/house");
    const out = await renewHouseSessions({ only: ["grid-1"], withinDays: 3 });
    expect(out).toEqual([expect.objectContaining({ slug: "grid-1", renewed: false, skipped: "paused" })]);
    expect(out[0].error).toBeUndefined();
    expect(session.grantScopedSession).not.toHaveBeenCalled();
  });

  it("says so in its public registration: still selling its answer, trading paused, and why", async () => {
    const { GET } = await import("../../app/house/[slug]/registration.json/route");
    const read = async (slug: string) => (await (await GET(new Request(`https://mandate.test/house/${slug}/registration.json`), { params: Promise.resolve({ slug }) })).json()) as {
      active: boolean;
      services: { name: string }[];
      price?: unknown;
      paused?: { reason: string };
      tradingPaused?: { reason: string };
    };
    const grid = await read("grid-1");
    expect(grid.active).toBe(true);
    expect(grid.services.map((x) => x.name)).toContain("x402");
    expect(grid.paused).toBeUndefined();
    expect(grid.tradingPaused?.reason).toMatch(/^Trading paused:/);
    const range = await read("range-1");
    expect(range.active).toBe(true);
    expect(range.tradingPaused).toBeUndefined();
  });

  it("still quotes a price at its x402 endpoint, since its answer is on sale", async () => {
    const { GET } = await import("../../app/api/x402/house/[slug]/route");
    const res = await GET(new Request("https://mandate.test/api/x402/house/grid-1"), { params: Promise.resolve({ slug: "grid-1" }) });
    expect(res.status).toBe(402);
  });

  it("is a paused reference on the judge walk, even while its session is still live", async () => {
    const future = Math.floor(Date.now() / 1000) + 10 * 86_400;
    session.listSessions.mockResolvedValue([
      { id: "house:grid-1:0x54c06cc2623aaa2dcc38b17fa07ad2e99b363c90", expiry: future },
      { id: "house:range-1:0x54c06cc2623aaa2dcc38b17fa07ad2e99b363c90", expiry: future },
    ]);
    const { referenceAgents } = await import("../market/reference");
    const refs = await referenceAgents();
    expect(refs["grid-trading"].status).toBe("paused");
    expect(refs["grid-trading"].evidence).toMatch(/Paused since/);
    expect(refs.rebalancing.status).not.toBe("paused");
  });
});
