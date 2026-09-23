/**
 * The PancakeSwap pool-gap arithmetic.
 *
 * Turnover is only worth ranking by if it means the same thing for every
 * pair, so it is checked against pools whose depth is known exactly, and
 * against the same pool written with a token of different decimals. The
 * slicing is checked too: a window is always finished before the next starts,
 * and a provider that times out gets smaller requests, not a stuck cursor.
 */

import { describe, expect, it } from "vitest";
import { candidatesOf, nextSpan, nextStep, rankPools, tallySwaps, turnoverOf, type PoolRow, type Progress } from "../pancake/pool-gap";

const Q96 = 2n ** 96n;
const word = (n: bigint) => (n < 0n ? (1n << 256n) + n : n).toString(16).padStart(64, "0");
const swap = (pool: string, amount0: bigint) => ({ address: pool, data: `0x${word(amount0)}${word(0n)}` });

describe("tallying swaps", () => {
  it("counts each swap and adds the absolute token0 flow, whichever way it went", () => {
    const t = tallySwaps([swap("0xAB", 5n), swap("0xab", -7n), swap("0xcd", 1n)]);
    expect(t["0xab"]).toEqual({ swaps: 2, volume0: "12" });
    expect(t["0xcd"]).toEqual({ swaps: 1, volume0: "1" });
  });

  it("keeps a running tally across chunks, and skips a log too short to be a swap", () => {
    const t = tallySwaps([swap("0xab", 3n)]);
    tallySwaps([swap("0xab", -3n), { address: "0xab", data: "0x1234" }], t);
    expect(t["0xab"]).toEqual({ swaps: 2, volume0: "6" });
  });

  it("reads only pools with enough traffic, busiest first, up to the cap", () => {
    const t = { a: { swaps: 25, volume0: "1" }, b: { swaps: 90, volume0: "1" }, c: { swaps: 3, volume0: "1" }, d: { swaps: 40, volume0: "1" } };
    expect(candidatesOf(t)).toEqual(["b", "d", "a"]);
    expect(candidatesOf(t, 20, 2)).toEqual(["b", "d"]);
  });
});

describe("turnover", () => {
  it("is volume over the virtual token0 reserve, L over the square root of the price", () => {
    // At a price of 1 the virtual reserve is L itself.
    expect(turnoverOf(3_000n, 1_000n, Q96)).toBe(3);
    // At a price of 4 it is L / 2.
    expect(turnoverOf(1_000n, 1_000n, 2n * Q96)).toBe(2);
  });

  it("does not change when token0 is written with other decimals", () => {
    // The same pool, token0 at 18 decimals and then at 6: raw volume shrinks by 1e12,
    // the raw price grows by 1e12 (its square root by 1e6) and L shrinks by 1e6.
    const at18 = turnoverOf(5n * 10n ** 21n, 10n ** 21n, Q96);
    const at6 = turnoverOf(5n * 10n ** 9n, 10n ** 15n, Q96 * 10n ** 6n);
    expect(at18).toBe(5);
    expect(at6).toBe(at18);
  });

  it("has no value for a pool with nothing in range, rather than an infinite one", () => {
    expect(turnoverOf(10n, 0n, Q96)).toBeNull();
  });
});

describe("ranking", () => {
  const row = (pool: string, turnover: number | null, swaps = 30): PoolRow => ({ pool, token0: "", token1: "", symbol0: "A", symbol1: "B", fee: 500, swaps, volume0: 1, turnover });

  it("puts the highest turnover first and lists empty pools apart, never ranked", () => {
    const { ranked, empty } = rankPools([row("low", 0.2), row("none", null, 80), row("high", 4), row("mid", 1)]);
    expect(ranked.map((r) => r.pool)).toEqual(["high", "mid", "low"]);
    expect(empty.map((r) => r.pool)).toEqual(["none"]);
  });

  it("keeps only the top few", () => {
    expect(rankPools([row("a", 1), row("b", 2), row("c", 3)], 2).ranked.map((r) => r.pool)).toEqual(["c", "b"]);
  });
});

describe("reading a window in slices", () => {
  const cadence = { cadenceMs: 12 * 3_600_000 };
  const now = Date.parse("2026-09-23T12:00:00Z");
  const progress = (over: Partial<Progress> = {}): Progress => ({ from: 100, to: 1_099, cursor: 100, span: 200, tally: {}, swaps: 0, startedAt: "2026-09-23T11:00:00Z", ...over });

  it("waits while the last reading is younger than the cadence, and starts one when it is older", () => {
    expect(nextStep(null, "2026-09-23T06:00:00Z", now, cadence).kind).toBe("idle");
    expect(nextStep(null, "2026-09-22T23:00:00Z", now, cadence).kind).toBe("start");
    expect(nextStep(null, null, now, cadence).kind).toBe("start");
  });

  it("finishes a window before anything else, reading from the cursor by the current span", () => {
    // Even with a stale reading, an unfinished window is read on, never restarted.
    expect(nextStep(progress({ cursor: 900, span: 150 }), null, now, cadence)).toEqual({ kind: "read", from: 900, to: 1_049 });
    expect(nextStep(progress({ cursor: 1_000, span: 500 }), null, now, cadence)).toEqual({ kind: "read", from: 1_000, to: 1_099 });
    expect(nextStep(progress({ cursor: 1_100 }), null, now, cadence)).toEqual({ kind: "publish" });
  });

  it("halves the request after a timeout, grows it after an answer, and stays inside its bounds", () => {
    expect(nextSpan(200, false, 1_000)).toBe(100);
    expect(nextSpan(30, false, 1_000)).toBe(20);
    expect(nextSpan(200, true, 1_000)).toBe(300);
    expect(nextSpan(900, true, 1_000)).toBe(1_000);
  });
});
