/**
 * The house agents, deciding and acting without the operator.
 *
 * The rules are tested as pure functions on readings taken from the chain on
 * 23 September (Range-1's position out of range at tick -66,647, 0.02 USDT
 * left on RecipientBound's lifetime cap, a health factor of 4.00). The
 * harness is tested with fakes for the things that would spend money, so a
 * test can prove a dry run never loads a signer, never sends, and a paused
 * or unleashed agent never runs at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseEther, type Address } from "viem";

const chain = vi.hoisted(() => ({ readContract: vi.fn(), getBlockNumber: vi.fn(), getLogs: vi.fn() }));
const venus = vi.hoisted(() => ({ readVenus: vi.fn(), usdtRates: vi.fn() }));
vi.mock("@/lib/chain/market", () => ({ marketClient: chain }));
vi.mock("@/lib/diagnose/positions", () => ({ readVenus: venus.readVenus }));
vi.mock("@/lib/venus/rates", () => ({ usdtRates: venus.usdtRates, VUSDT: "0xfD5840Cd36d94D7229439859C0112a4185BC0255" }));

const { decideGuard, decideYield, guardTurn, yieldTurn, GUARD, YIELD, movedToday } = await import("../house/venus");
const { decideRange, mintPlan, positionAmounts, expectedMint } = await import("../house/range");
const { runHouse } = await import("../house/run");
const { HOUSE_LEASHES } = await import("../chain/house");

const ACCOUNT = "0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90" as Address;
const e = (x: string) => parseEther(x);
const NOW = Date.parse("2026-09-23T12:00:00Z");

beforeEach(() => {
  chain.readContract.mockReset();
  venus.readVenus.mockReset();
  venus.usdtRates.mockReset();
});

describe("Guard-1's rule", () => {
  const base = { healthFactor: 4.0, debt: e("0.06"), usdt: e("0.55"), repaidToday: 0n };

  it("does nothing above its trigger", () => {
    const d = decideGuard(base);
    expect(d.act).toBe(false);
    expect(d.reason).toMatch(/4\.00 is above its 3\.00 trigger/);
  });

  it("repays 0.02 USDT under its trigger, never more than the debt", () => {
    const d = decideGuard({ ...base, healthFactor: 2.9 });
    expect(d).toMatchObject({ act: true, functionName: "repayBorrow", amount: e("0.02") });
    expect(decideGuard({ ...base, healthFactor: 2.9, debt: e("0.005") })).toMatchObject({ act: true, amount: e("0.005") });
  });

  it("keeps under its session's daily cap, and says so when the cap is spent", () => {
    expect(decideGuard({ ...base, healthFactor: 2.9, repaidToday: e("0.04") })).toMatchObject({ act: true, amount: e("0.01") });
    const spent = decideGuard({ ...base, healthFactor: 2.9, repaidToday: e("0.05") });
    expect(spent.act).toBe(false);
    expect(spent.reason).toMatch(/already repaid its 0\.05 USDT for today/);
  });

  it("does nothing without cash, reports no debt plainly, and skips an unread factor", () => {
    expect(decideGuard({ ...base, healthFactor: 2.9, usdt: 0n }).reason).toMatch(/holds no USDT/);
    expect(decideGuard({ ...base, healthFactor: null }).reason).toMatch(/no Venus debt/);
    expect(decideGuard({ ...base, healthFactor: undefined })).toMatchObject({ act: false, outcome: "skipped" });
  });

  it("uses the cap its leash actually grants", () => {
    const leash = HOUSE_LEASHES.find((l) => l.slug === "guard-1")!;
    expect(leash.tokenSpend[0].limit).toBe(GUARD.dailyCap);
  });
});

describe("Yield-1's rule", () => {
  const base = { venusApr: 0.0317, aaveApr: 0.0288, usdt: e("0.5582"), suppliedToday: 0n };

  it("supplies idle cash above the reserve, up to its daily cap", () => {
    const d = decideYield(base);
    expect(d).toMatchObject({ act: true, functionName: "mint", amount: YIELD.dailyCap });
    expect(decideYield({ ...base, usdt: e("0.13") })).toMatchObject({ act: true, amount: e("0.03") });
  });

  it("keeps the reserve Guard-1 repays from, and ignores dust", () => {
    const d = decideYield({ ...base, usdt: e("0.105") });
    expect(d.act).toBe(false);
    expect(d.reason).toMatch(/Only 0\.005 USDT is idle above the 0\.1/);
  });

  it("moves at most once a day", () => {
    expect(decideYield({ ...base, suppliedToday: e("0.1") }).reason).toMatch(/at most once a day/);
  });

  it("says when Aave pays more, and why it still cannot go there", () => {
    const d = decideYield({ ...base, aaveApr: 0.05 });
    expect(d.act).toBe(true);
    expect(d.reason).toMatch(/Aave pays 5\.00%, but its supply names the address to credit/);
  });

  it("uses the cap its leash actually grants, and counts what it moved today", () => {
    const leash = HOUSE_LEASHES.find((l) => l.slug === "yield-1")!;
    expect(leash.tokenSpend[0].limit).toBe(YIELD.dailyCap);
    expect(movedToday([{ readings: { amount: "0.04" } }, { readings: { amount: "0.01" } }, { readings: {} }] as never)).toBe(e("0.05"));
  });
});

describe("Range-1's rule", () => {
  // Read from the chain on 23 September.
  const live = {
    position: 7409024n,
    owner: ACCOUNT,
    lower: -65830,
    upper: -65620,
    liquidity: 445772214497406864n,
    owed0: 0n,
    owed1: 0n,
    tick: -66647,
    rb: { expiry: Date.parse("2027-10-13T10:36:22Z") / 1000, cap0: e("0.05"), cap1: e("0.05"), spent0: e("0.03"), spent1: e("0.0003") },
    balances: { usdt: e("0.5582"), wbnb: e("0.0004") },
    approvals: { nfts: true, usdt: e("0.02"), wbnb: e("0.0497") },
  };

  it("estimates what an out-of-range position holds: all USDT below its range", () => {
    const held = positionAmounts(live.liquidity, live.lower, live.upper, live.tick);
    expect(held.amount1).toBe(0n);
    expect(Number(held.amount0) / 1e18).toBeCloseTo(0.1248, 3);
  });

  it("recenters an out-of-range position it can reopen, within RecipientBound's caps", () => {
    const d = decideRange(live, NOW, ACCOUNT);
    expect(d.step).toBe("withdraw");
    if (d.step === "none") return;
    expect(d.plan).toMatchObject({ lo: -66800, hi: -66590, amount0: e("0.02"), amount1: e("0.0004"), feasible: true });
  });

  it("bounds the mint on price: it lands anywhere in the band, and not once the price has left the range", () => {
    const [a0, a1] = [e("0.02"), e("0.0004")];
    const m = expectedMint(-66647, -66800, -66590, a0, a1);
    expect(m.min0).toBeGreaterThan(0n);
    expect(m.min1).toBeGreaterThan(0n);
    const lands = (t: number) => {
      const x = expectedMint(t, -66800, -66590, a0, a1, 0);
      return x.used0 >= m.min0 && x.used1 >= m.min1;
    };
    for (const t of [-66747, -66700, -66647, -66620, -66596]) expect(lands(t), `lands at ${t}`).toBe(true);
    expect(lands(-66590)).toBe(false);
    // The plan a live run sends carries these same price-band minimums.
    const plan = mintPlan(live);
    expect(plan.min0).toBe(m.min0);
  });

  it("never starts a recenter it cannot finish", () => {
    const spent = { ...live, rb: { ...live.rb, spent0: e("0.05") } };
    const d = decideRange(spent, NOW, ACCOUNT);
    expect(d.step).toBe("none");
    expect(d.reason).toMatch(/lifetime USDT cap is spent/);
    expect(d.reason).toMatch(/does not start a recenter it cannot finish/);
    expect(mintPlan(spent).feasible).toBe(false);
  });

  it("does nothing while the position earns", () => {
    const d = decideRange({ ...live, tick: -65700 }, NOW, ACCOUNT);
    expect(d).toMatchObject({ step: "none", outcome: "nothing" });
    expect(d.reason).toMatch(/is in range/);
  });

  it("resumes a cut-off recenter from what the chain says", () => {
    expect(decideRange({ ...live, liquidity: 0n, owed0: e("0.12") }, NOW, ACCOUNT).step).toBe("collect");
    expect(decideRange({ ...live, liquidity: 0n, balances: { usdt: e("0.68"), wbnb: e("0.0004") } }, NOW, ACCOUNT).step).toBe("mint");
  });

  it("leaves alone a position the account no longer owns, and one it may not manage", () => {
    expect(decideRange({ ...live, owner: "0x000000000000000000000000000000000000dEaD" }, NOW, ACCOUNT)).toMatchObject({ step: "none", outcome: "skipped" });
    expect(decideRange({ ...live, approvals: { ...live.approvals, nfts: false } }, NOW, ACCOUNT)).toMatchObject({ step: "none", outcome: "skipped" });
  });
});

/* ------------------------------------------------------------ the harness */

const session = { expiry: Math.floor(NOW / 1000) + 10 * 86_400 };
const fakeDeps = (over: Record<string, unknown> = {}) => {
  const rows: unknown[] = [];
  const sender = vi.fn(async () => vi.fn(async () => ({ hash: "0xabc" as const, blockNumber: 1n, logs: [] })));
  return {
    rows,
    sender,
    deps: {
      session: vi.fn(async () => session),
      sender,
      record: vi.fn(async (r: unknown) => void rows.push(r)),
      last: vi.fn(async () => null),
      today: vi.fn(async () => []),
      recent: vi.fn(async () => []),
      lease: async <T,>(_s: string, fn: () => Promise<T>) => fn(),
      ...over,
    },
  };
};

describe("the house agents' harness", () => {
  it("never runs a paused agent", async () => {
    const turn = vi.fn();
    const { deps, rows } = fakeDeps({ turns: { "grid-1": turn } });
    const r = await runHouse("grid-1", { now: NOW, deps: deps as never });
    expect(r.outcome).toBe("skipped");
    // Grid-1's trading is paused: it never acts on the account, though its paid report is still on sale.
    expect(r.reason).toMatch(/^Trading paused:/);
    expect(turn).not.toHaveBeenCalled();
    expect(rows).toHaveLength(0);
  });

  it("records a lapsed leash and stops, without ever granting itself a session", async () => {
    const turn = vi.fn();
    const { deps, rows, sender } = fakeDeps({ session: vi.fn(async () => ({ expiry: Math.floor(NOW / 1000) - 60 })), turns: { "guard-1": turn } });
    const r = await runHouse("guard-1", { now: NOW, live: true, deps: deps as never });
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/lapsed on/);
    expect(turn).not.toHaveBeenCalled();
    expect(sender).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it("sends nothing in a dry run, and never loads a signer", async () => {
    const turn = vi.fn(async (ctx: { live: boolean; send: (c: never, d: string) => Promise<unknown> }) => {
      await expect(ctx.send({} as never, "try")).rejects.toThrow(/dry run sends nothing/);
      return { outcome: "would-act" as const, reason: "would repay", readings: {}, txs: [] };
    });
    const { deps, rows, sender } = fakeDeps({ turns: { "guard-1": turn } });
    const r = await runHouse("guard-1", { now: NOW, live: false, deps: deps as never });
    expect(r).toMatchObject({ mode: "dry", outcome: "would-act" });
    expect(sender).not.toHaveBeenCalled();
    expect(rows).toEqual([expect.objectContaining({ slug: "guard-1", mode: "dry", outcome: "would-act" })]);
  });

  it("sends through the agent's own session when live, and records the result once", async () => {
    const turn = vi.fn(async (ctx: { send: (c: never, d: string) => Promise<{ hash: string }> }) => {
      const s = await ctx.send({} as never, "repay");
      return { outcome: "acted" as const, reason: "repaid", readings: { amount: "0.02" }, txs: [{ step: "repayBorrow", tx: s.hash }] };
    });
    const { deps, rows, sender } = fakeDeps({ turns: { "guard-1": turn } });
    const r = await runHouse("guard-1", { now: NOW, live: true, deps: deps as never });
    expect(r).toMatchObject({ mode: "live", outcome: "acted", txs: [{ step: "repayBorrow", tx: "0xabc" }] });
    expect(sender).toHaveBeenCalledWith("house:guard-1:0x54c06cc2623aaa2dcc38b17fa07ad2e99b363c90");
    expect(rows).toHaveLength(1);
  });

  it("does not write twice for a turn that recorded its own steps", async () => {
    const turn = vi.fn(async (ctx: { record: (r: unknown) => Promise<void> }) => {
      const step = { outcome: "partial" as const, reason: "withdrew", readings: {}, txs: [{ step: "withdraw", tx: "0x1" }] };
      await ctx.record(step);
      return { ...step, recorded: true };
    });
    const { deps, rows } = fakeDeps({ turns: { "range-1": turn } });
    await runHouse("range-1", { now: NOW, live: true, deps: deps as never });
    expect(rows).toHaveLength(1);
  });

  it("counts a failed transaction towards the stop, and a failed read not at all", async () => {
    const sendFails = vi.fn(async (ctx: { send: (c: never, d: string) => Promise<unknown> }) => {
      await ctx.send({} as never, "repay");
      return { outcome: "acted" as const, reason: "", readings: {}, txs: [] };
    });
    const failingSender = vi.fn(async () => vi.fn(async () => Promise.reject(new Error("repayBorrow reverted: 0xdef"))));
    const a = fakeDeps({ sender: failingSender, turns: { "guard-1": sendFails } });
    expect((await runHouse("guard-1", { now: NOW, live: true, deps: a.deps as never })).outcome).toBe("failed");

    const readFails = vi.fn(async () => Promise.reject(new Error("rpc timeout")));
    const b = fakeDeps({ turns: { "guard-1": readFails } });
    const r = await runHouse("guard-1", { now: NOW, live: true, deps: b.deps as never });
    expect(r.outcome).toBe("skipped");
    expect(r.reason).toMatch(/Could not finish reading/);
  });

  it("stops for six hours after three failures in a row", async () => {
    const turn = vi.fn();
    const failed = { outcome: "failed", mode: "live", at: new Date(NOW - 3_600_000).toISOString(), reason: "reverted" };
    const { deps } = fakeDeps({ recent: vi.fn(async () => [failed, failed, failed]), turns: { "guard-1": turn } });
    const r = await runHouse("guard-1", { now: NOW, live: true, deps: deps as never });
    expect(r.reason).toMatch(/Stopped after 3 failed attempts/);
    expect(turn).not.toHaveBeenCalled();
  });

  it("runs one turn per agent at a time", async () => {
    const turn = vi.fn();
    const { deps } = fakeDeps({ lease: async () => null, turns: { "guard-1": turn } });
    const r = await runHouse("guard-1", { now: NOW, deps: deps as never });
    expect(r.reason).toMatch(/in progress/);
    expect(turn).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------- Venus's error codes */

describe("Guard-1 and Yield-1 against Venus", () => {
  const ctx = (live: boolean, send = vi.fn(async () => ({ hash: "0xfeed" as const, blockNumber: 1n, logs: [] }))) => ({
    account: ACCOUNT,
    live,
    now: NOW,
    send,
    record: vi.fn(),
    last: null,
    today: [],
    stepDeadline: NOW + 8_000,
  });

  it("does not send in a dry run, and says what it would do", async () => {
    venus.readVenus.mockResolvedValue({ healthFactor: 2.5, borrowUsd: 0.06, collateralUsd: 0.2 });
    chain.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => (functionName === "borrowBalanceStored" ? e("0.06") : e("0.5")));
    const c = ctx(false);
    const r = await guardTurn(c as never);
    expect(r.outcome).toBe("would-act");
    expect(c.send).not.toHaveBeenCalled();
  });

  it("records a repay that landed but did not lower the debt as a failure", async () => {
    venus.readVenus.mockResolvedValue({ healthFactor: 2.5, borrowUsd: 0.06, collateralUsd: 0.2 });
    // The debt reads the same before and after: Venus returned an error code instead of reverting.
    chain.readContract.mockImplementation(async ({ functionName }: { functionName: string }) => (functionName === "borrowBalanceStored" ? e("0.06") : e("0.5")));
    const r = await guardTurn(ctx(true) as never);
    expect(r.outcome).toBe("failed");
    expect(r.reason).toMatch(/debt did not fall/);
  });

  it("records a repay that lowered the debt as done", async () => {
    venus.readVenus.mockResolvedValueOnce({ healthFactor: 2.5, borrowUsd: 0.06, collateralUsd: 0.2 }).mockResolvedValueOnce({ healthFactor: 3.4 });
    let debtReads = 0;
    chain.readContract.mockImplementation(async ({ functionName }: { functionName: string }) =>
      functionName === "borrowBalanceStored" ? (debtReads++ === 0 ? e("0.06") : e("0.04")) : e("0.5"),
    );
    const r = await guardTurn(ctx(true) as never);
    expect(r.outcome).toBe("acted");
    expect(r.readings.amount).toBe("0.02");
    expect(r.reason).toMatch(/Health factor after: 3\.40/);
  });

  it("records a supply that did not raise the vUSDT balance as a failure", async () => {
    venus.usdtRates.mockResolvedValue({ venusApr: 0.0317, aaveApr: 0.0288, block: 1 });
    chain.readContract.mockImplementation(async ({ address }: { address: string }) => (address.toLowerCase().startsWith("0xfd58") ? 1000n : e("0.5582")));
    const r = await yieldTurn(ctx(true) as never);
    expect(r.outcome).toBe("failed");
    expect(r.reason).toMatch(/vUSDT balance did not rise/);
  });
});
