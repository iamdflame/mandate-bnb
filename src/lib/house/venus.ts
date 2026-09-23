/**
 * Guard-1 and Yield-1, deciding on their own.
 *
 * Both act on the demo account's Venus position through sessions that can
 * only call vUSDT: Guard-1 may repay the account's own USDT debt, Yield-1 may
 * supply the account's own USDT. Neither can borrow, redeem to anyone else,
 * or name who is credited.
 *
 * The decisions are pure functions of what was read, so the rules can be
 * tested without a chain. They were one-off scripts before, run by hand;
 * `src/scripts/venus-agents.ts` still plans and runs them from a terminal.
 *
 *   Guard-1  repays 0.02 USDT when the health factor is under 3.00, never more
 *            than 0.05 USDT in a day (its session's cap), never more than the
 *            debt or the cash the account holds.
 *   Yield-1  supplies idle USDT to Venus at most once a day, up to its 0.1 USDT
 *            daily cap, and only above a reserve that keeps Guard-1 able to
 *            repay. When Aave pays more it says so: Aave's supply names the
 *            address to credit, and no session here may make that call.
 */

import { formatEther, parseAbi, parseEther, type Abi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { USDT } from "@/lib/chain/leash";
import { readVenus } from "@/lib/diagnose/positions";
import { usdtRates, VUSDT } from "@/lib/venus/rates";
import type { HouseRun } from "@/lib/house/runs";
import type { TurnContext, TurnResult } from "@/lib/house/types";

export const VTOKEN_ABI = parseAbi([
  "function mint(uint256) returns (uint256)",
  "function repayBorrow(uint256) returns (uint256)",
  "function borrowBalanceStored(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

/** Guard-1's rule. The daily cap is its session's, so the agent never asks for a repay the account guard would refuse. */
export const GUARD = { trigger: 3.0, repay: parseEther("0.02"), dailyCap: parseEther("0.05") } as const;
/** Yield-1's rule. The reserve covers two days of Guard-1's repayments. */
export const YIELD = { dailyCap: parseEther("0.1"), reserve: parseEther("0.1"), minimum: parseEther("0.01") } as const;

export const usdt = (wei: bigint) => formatEther(wei);
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));

export type VenusDecision =
  | { act: false; outcome: "nothing" | "skipped"; reason: string }
  | { act: true; functionName: "repayBorrow" | "mint"; amount: bigint; reason: string; description: string };

export interface GuardReadings {
  /** Undefined when the read failed; null when there is no debt. */
  healthFactor: number | null | undefined;
  debt: bigint;
  usdt: bigint;
  /** What its own live runs repaid in the last 24 hours. */
  repaidToday: bigint;
}

export function decideGuard(r: GuardReadings, rule: { trigger: number; repay: bigint; dailyCap: bigint } = GUARD): VenusDecision {
  if (r.healthFactor === undefined) return { act: false, outcome: "skipped", reason: "Could not read the account's health factor from Venus, so it did nothing." };
  if (r.healthFactor === null) return { act: false, outcome: "nothing", reason: "The account has no Venus debt, so there is nothing to protect." };
  const hf = r.healthFactor;
  const at = `Health factor ${hf.toFixed(2)}`;
  if (hf >= rule.trigger) return { act: false, outcome: "nothing", reason: `${at} is above its ${rule.trigger.toFixed(2)} trigger, so there is nothing to do.` };
  const room = rule.dailyCap > r.repaidToday ? rule.dailyCap - r.repaidToday : 0n;
  if (room === 0n) {
    return { act: false, outcome: "nothing", reason: `${at} is under its ${rule.trigger.toFixed(2)} trigger, but it has already repaid its ${usdt(rule.dailyCap)} USDT for today.` };
  }
  if (r.usdt === 0n) return { act: false, outcome: "nothing", reason: `${at} is under its ${rule.trigger.toFixed(2)} trigger, but the account holds no USDT to repay with.` };
  const amount = min(rule.repay, room, r.usdt, r.debt);
  if (amount === 0n) return { act: false, outcome: "nothing", reason: `${at} is under its trigger, but Venus reports no USDT debt to repay.` };
  return {
    act: true,
    functionName: "repayBorrow",
    amount,
    reason: `${at} is under its ${rule.trigger.toFixed(2)} trigger: repay ${usdt(amount)} USDT of the account's own debt.`,
    description: `repay ${usdt(amount)} USDT: health factor ${hf.toFixed(2)} is under the ${rule.trigger.toFixed(2)} trigger`,
  };
}

export interface YieldReadings {
  /** Null when the rate could not be read. */
  venusApr: number | null;
  aaveApr: number | null;
  usdt: bigint;
  /** What its own live runs supplied in the last 24 hours. */
  suppliedToday: bigint;
}

export function decideYield(r: YieldReadings, rule: { dailyCap: bigint; reserve: bigint; minimum: bigint } = YIELD): VenusDecision {
  if (r.venusApr === null) return { act: false, outcome: "skipped", reason: "Could not read Venus's USDT supply rate, so it did nothing." };
  if (r.suppliedToday > 0n) {
    return { act: false, outcome: "nothing", reason: `It supplied ${usdt(r.suppliedToday)} USDT to Venus in the last 24 hours and moves at most once a day.` };
  }
  if (r.venusApr <= 0) return { act: false, outcome: "nothing", reason: "Venus pays nothing on USDT right now, so there is no reason to move cash there." };
  const idle = r.usdt > rule.reserve ? r.usdt - rule.reserve : 0n;
  const amount = min(idle, rule.dailyCap);
  if (amount < rule.minimum) {
    return {
      act: false,
      outcome: "nothing",
      reason: `Only ${usdt(idle)} USDT is idle above the ${usdt(rule.reserve)} it keeps for Guard-1's repayments, under its ${usdt(rule.minimum)} minimum move.`,
    };
  }
  const aave = r.aaveApr !== null && r.aaveApr > r.venusApr ? ` Aave pays ${pct(r.aaveApr)}, but its supply names the address to credit, which no session here may call.` : "";
  return {
    act: true,
    functionName: "mint",
    amount,
    reason: `Supply ${usdt(amount)} idle USDT to Venus at ${pct(r.venusApr)} a year.${aave}`,
    description: `supply ${usdt(amount)} idle USDT to Venus at ${pct(r.venusApr)}`,
  };
}

const balanceOf = (token: Address, who: Address) => marketClient.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [who] }) as Promise<bigint>;

export async function readGuard(account: Address, repaidToday: bigint): Promise<GuardReadings & { borrowUsd: number | null; collateralUsd: number | null }> {
  const [v, debt, cash] = await Promise.all([
    readVenus(account).catch(() => null),
    marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "borrowBalanceStored", args: [account] }) as Promise<bigint>,
    balanceOf(USDT, account),
  ]);
  return {
    healthFactor: v ? v.healthFactor : undefined,
    debt,
    usdt: cash,
    repaidToday,
    borrowUsd: v?.borrowUsd ?? null,
    collateralUsd: v?.collateralUsd ?? null,
  };
}

export async function readYield(account: Address, suppliedToday: bigint): Promise<YieldReadings & { block: number | null }> {
  const [rates, cash] = await Promise.all([usdtRates().catch(() => null), balanceOf(USDT, account)]);
  return { venusApr: rates?.venusApr ?? null, aaveApr: rates?.aaveApr ?? null, usdt: cash, suppliedToday, block: rates?.block ?? null };
}

/** What its own live actions moved in the window, from the amounts they recorded. */
export function movedToday(rows: HouseRun[]): bigint {
  return rows.reduce((sum, r) => {
    const a = r.readings?.amount;
    return typeof a === "string" && /^\d+(\.\d+)?$/.test(a) ? sum + parseEther(a as `${number}`) : sum;
  }, 0n);
}

const vToken = (functionName: "repayBorrow" | "mint", amount: bigint) => ({ address: VUSDT, abi: VTOKEN_ABI as unknown as Abi, functionName, args: [amount] as const });
const debtOf = (who: Address) => marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "borrowBalanceStored", args: [who] }) as Promise<bigint>;
const vBalanceOf = (who: Address) => marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "balanceOf", args: [who] }) as Promise<bigint>;

/*
  Venus is a Compound fork, and several of its failure paths return an error
  code instead of reverting. A repay or a supply can land as a successful
  transaction that did nothing. So each action is checked by its effect: the
  debt went down, or the vUSDT balance went up. Otherwise it is recorded as a
  failure, whatever the receipt says.
*/

export async function guardTurn(ctx: TurnContext): Promise<TurnResult> {
  const repaidToday = movedToday(ctx.today);
  const r = await readGuard(ctx.account, repaidToday);
  const d = decideGuard(r);
  const readings: Record<string, unknown> = {
    healthFactor: r.healthFactor ?? null,
    trigger: GUARD.trigger,
    debt: usdt(r.debt),
    usdt: usdt(r.usdt),
    repaidToday: usdt(repaidToday),
    borrowUsd: r.borrowUsd,
    collateralUsd: r.collateralUsd,
  };
  if (!d.act) return { outcome: d.outcome, reason: d.reason, readings, txs: [] };
  if (!ctx.live) return { outcome: "would-act", reason: d.reason, readings: { ...readings, amount: usdt(d.amount) }, txs: [] };
  const sent = await ctx.send(vToken("repayBorrow", d.amount), d.description);
  const [debtAfter, after] = await Promise.all([debtOf(ctx.account), readVenus(ctx.account).catch(() => null)]);
  const txs = [{ step: "repayBorrow", tx: sent.hash }];
  if (debtAfter >= r.debt) {
    return { outcome: "failed", reason: `The repay landed but Venus's debt did not fall (${usdt(r.debt)} before, ${usdt(debtAfter)} after), so Venus returned an error code.`, readings, txs };
  }
  const hf = typeof after?.healthFactor === "number" ? after.healthFactor.toFixed(2) : "unread";
  return { outcome: "acted", reason: `${d.reason} Health factor after: ${hf}.`, readings: { ...readings, amount: usdt(d.amount), debtAfter: usdt(debtAfter), healthFactorAfter: after?.healthFactor ?? null }, txs };
}

export async function yieldTurn(ctx: TurnContext): Promise<TurnResult> {
  const suppliedToday = movedToday(ctx.today);
  const r = await readYield(ctx.account, suppliedToday);
  const d = decideYield(r);
  const readings: Record<string, unknown> = {
    venusApr: r.venusApr,
    aaveApr: r.aaveApr,
    usdt: usdt(r.usdt),
    reserve: usdt(YIELD.reserve),
    suppliedToday: usdt(suppliedToday),
    block: r.block,
  };
  if (!d.act) return { outcome: d.outcome, reason: d.reason, readings, txs: [] };
  if (!ctx.live) return { outcome: "would-act", reason: d.reason, readings: { ...readings, amount: usdt(d.amount) }, txs: [] };
  const before = await vBalanceOf(ctx.account);
  const sent = await ctx.send(vToken("mint", d.amount), d.description);
  const after = await vBalanceOf(ctx.account);
  const txs = [{ step: "mint", tx: sent.hash }];
  if (after <= before) {
    return { outcome: "failed", reason: "The supply landed but the account's vUSDT balance did not rise, so Venus returned an error code.", readings, txs };
  }
  return { outcome: "acted", reason: d.reason, readings: { ...readings, amount: usdt(d.amount), vTokensBefore: before.toString(), vTokensAfter: after.toString() }, txs };
}
