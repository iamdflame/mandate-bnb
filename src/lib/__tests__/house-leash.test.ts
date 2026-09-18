/**
 * The house leashes, checked for the two mistakes that have actually happened.
 *
 * Guard-1, Yield-1 and Grid-1 all lapsed on 12 September and nobody noticed
 * for six days, because a session that has expired does not fail loudly: the
 * agent just stops being able to act, while still being listed and still
 * holding a key. The leashes were written out longhand in three scripts, so
 * renewing one meant finding the script that granted it.
 *
 * Separately, a session granted without a native allowance reverts every
 * execute with `NoSpendPermissions`, because the account pays the relay's gas
 * out of the same permission set. That one costs a registration transaction
 * to discover.
 */

import { describe, expect, it } from "vitest";
import { HOUSE_LEASHES, houseSessionId } from "../chain/house";
import { CATEGORIES } from "../config";

describe("the house leashes", () => {
  it("covers all four categories, once each", () => {
    const cats = HOUSE_LEASHES.map((l) => l.category);
    expect(new Set(cats).size).toBe(HOUSE_LEASHES.length);
    for (const c of CATEGORIES) expect(cats).toContain(c);
  });

  it("gives every leash a native allowance, without which every execute reverts", () => {
    for (const l of HOUSE_LEASHES) {
      expect(l.nativeSpendWei, `${l.slug} pays its own relay gas`).toBeGreaterThan(0n);
    }
  });

  it("grants at least one call and never an approval", () => {
    for (const l of HOUSE_LEASHES) {
      expect(l.calls.length, `${l.slug} can do something`).toBeGreaterThan(0);
      for (const c of l.calls) {
        expect(c.signature).toMatch(/^[a-zA-Z]\w*\(/);
        // An allowance outlives the session that granted it, so a session that
        // can approve is not bounded by its own expiry.
        expect(c.signature).not.toMatch(/^(approve|setApprovalForAll|transferFrom)\(/);
        expect(c.to).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });

  it("caps every token it can move, so nothing leaves through an unlisted one", () => {
    for (const l of HOUSE_LEASHES) {
      for (const t of l.tokenSpend) {
        expect(t.limit, `${l.slug} caps ${t.token}`).toBeGreaterThan(0n);
        expect(t.token).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });

  it("names a session id the renewal and the agents both compute the same way", () => {
    const id = houseSessionId("grid-1", "0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90");
    expect(id).toBe("house:grid-1:0x54c06cc2623aaa2dcc38b17fa07ad2e99b363c90");
    expect(id).toBe(id.toLowerCase().replace("house:grid-1:", "house:grid-1:"));
  });
});
