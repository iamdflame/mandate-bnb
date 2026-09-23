/**
 * A pause is enforced, not described.
 *
 * The agent page once said Grid-1 "is paused" while its session was live and
 * every surface still offered it for hire. These hold the three places a
 * pause has to bite: the hire law refuses it on every rail, the lease renewer
 * leaves its leash to run out instead of paying to renew it, and its x402
 * endpoint refuses to take money, even when a payment is attached.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { hirePath } from "../market/hire-law";
import { PAUSED, pauseFor, pauseForSlug } from "../market/paused";
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

  it("is refused by the hire law on every rail, however well it answers", () => {
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
    expect(v.ok).toBe(false);
    expect(v.rails).toEqual([]);
    expect(v.short).toBe("Paused");
    expect(v.reason).toMatch(/^Paused:/);
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

  it("stops its x402 endpoint taking money, even when a payment is attached", async () => {
    const { GET } = await import("../../app/api/x402/house/[slug]/route");
    const res = await GET(new Request("https://mandate.test/api/x402/house/grid-1", { headers: { "x-payment": "e30=" } }), {
      params: Promise.resolve({ slug: "grid-1" }),
    });
    expect(res.status).toBe(410);
    const body = (await res.json()) as { paused?: boolean; settled?: boolean; error?: string };
    expect(body.paused).toBe(true);
    expect(body.settled).toBe(false);
    expect(body.error).toMatch(/^Paused:/);
  });
});
