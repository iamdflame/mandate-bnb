/**
 * Range-1, deciding on its own.
 *
 * It manages one position: the last one it opened for the demo account. When
 * the pool's price leaves that position's range, the position stops earning,
 * and Range-1 withdraws it, collects the tokens to the account and opens a new
 * range around the price. Every call goes through RecipientBound, a contract
 * with no recipient argument, so the tokens and the new position can only go
 * to the account. The other positions on the demo account are none of its
 * business and are never touched: two of them sit out of range on purpose,
 * as the /diagnose example.
 *
 * A recenter is three transactions, and a scheduled run can be cut off
 * between any two. So each step is recorded the moment it lands, and a run
 * resumes from what the chain says: a withdrawn position with tokens still
 * owed is collected; an empty one gets its replacement range. Before opening
 * that replacement it checks RecipientBound's own Minted events, so a mint
 * whose record was lost is adopted rather than sent twice.
 *
 * It never starts a recenter it cannot finish. RecipientBound's caps are for
 * its whole life (0.05 USDT and 0.05 WBNB), and a withdrawal that cannot be
 * followed by a new range would leave the account's liquidity sitting idle.
 */

import { decodeEventLog, formatEther, parseAbi, parseAbiItem, type Abi, type Address, type Hex } from "viem";
import { marketClient } from "@/lib/chain/market";
import { POSITION_MANAGER, RECIPIENT_BOUND, RECIPIENT_BOUND_ABI, USDT, WBNB, WBNB_USDT_POOL } from "@/lib/chain/leash";
import { recenterRecord } from "@/lib/demo";
import type { HouseRun } from "@/lib/house/runs";
import type { Call, Sent, TurnContext, TurnResult } from "@/lib/house/types";

const SPACING = 10;
const FEE = 500;
/** The new range: 150 ticks below the price to 50 above, the proven recenter's shape. */
const BELOW = 150;
const ABOVE = 50;
/** USDT a single recenter may commit. */
export const USDT_BUDGET = 30_000_000_000_000_000n; // 0.03
/** Less than this and the new range would be dust. */
export const MIN_USDT = 1_000_000_000_000_000n; // 0.001
export const MIN_WBNB = 10_000_000_000_000n; // 0.00001
const MAX128 = (1n << 128n) - 1n;
/*
  Every transaction carries a minimum out. The first recenter passed zero,
  which lets anyone who sees it coming move the price and keep the difference.

  Out of range, a withdrawal's amounts do not depend on the price, so it is
  bound 2% under what the maths expects. A mint cannot be bound that way: the
  new range is 210 ticks wide, and a 2% floor on the token that is not
  limiting would revert on a move of a few ticks, which this pair makes in
  seconds. So the mint is bound on price instead, the standard way: each
  minimum is the least that token could be if the price moved up to 1%
  (100 ticks) either way before the transaction lands.
*/
const bound = (x: bigint) => (x * 98n) / 100n;
const PRICE_BAND_TICKS = 100;

const NPM_ABI = parseAbi([
  "function positions(uint256) view returns (uint96,address,address,address,uint24,int24,int24,uint128,uint256,uint256,uint128,uint128)",
  "function ownerOf(uint256) view returns (address)",
  "function isApprovedForAll(address,address) view returns (bool)",
]);
const ERC20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"]);
const POOL_ABI = parseAbi(["function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)"]);
const MINTED = parseAbiItem("event Minted(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)");

export interface RangeReadings {
  position: bigint;
  owner: Address;
  lower: number;
  upper: number;
  liquidity: bigint;
  owed0: bigint;
  owed1: bigint;
  tick: number;
  rb: { expiry: number; cap0: bigint; cap1: bigint; spent0: bigint; spent1: bigint };
  balances: { usdt: bigint; wbnb: bigint };
  approvals: { nfts: boolean; usdt: bigint; wbnb: bigint };
}

export interface MintPlan {
  lo: number;
  hi: number;
  amount0: bigint;
  amount1: bigint;
  /** The least the mint may take of each token: what the same liquidity needs if the price moves 1% against it. */
  min0: bigint;
  min1: bigint;
  feasible: boolean;
  /** Why a new range cannot be opened, when it cannot. */
  why: string | null;
}

export type RangeDecision =
  | { step: "none"; outcome: "nothing" | "skipped"; reason: string }
  | { step: "withdraw" | "collect" | "mint"; reason: string; plan: MintPlan };

const floorTick = (t: number) => Math.floor(t / SPACING) * SPACING;
const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));
const left = (cap: bigint, spent: bigint) => (cap > spent ? cap - spent : 0n);
const tok = (wei: bigint) => formatEther(wei);

/** What a position holds, from its liquidity and ticks (Uniswap V3 math, in floating point: an estimate for planning). */
export function positionAmounts(liquidity: bigint, lower: number, upper: number, tick: number): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n };
  const sp = (t: number) => Math.pow(1.0001, t / 2);
  const L = Number(liquidity);
  const sa = sp(lower);
  const sb = sp(upper);
  let a0 = 0;
  let a1 = 0;
  if (tick < lower) a0 = L * (1 / sa - 1 / sb);
  else if (tick >= upper) a1 = L * (sb - sa);
  else {
    const sc = sp(tick);
    a0 = L * (1 / sc - 1 / sb);
    a1 = L * (sc - sa);
  }
  return { amount0: BigInt(Math.floor(Math.max(0, a0))), amount1: BigInt(Math.floor(Math.max(0, a1))) };
}

/**
 * What a mint of these amounts into [lo, hi) takes if it lands at `tick`, and
 * the least it could take if the price moved before it landed.
 *
 * The pool takes as much liquidity as the scarcer token allows at whatever
 * price the transaction lands, so each minimum is what the pool would take at
 * the edge of the band that is worst for that token: a higher price needs less
 * USDT, a lower one less WBNB. The upward band stops short of the range's top,
 * so a mint that would open a range the price has already left reverts
 * instead of landing out of range.
 */
export function expectedMint(
  tick: number,
  lo: number,
  hi: number,
  amount0: bigint,
  amount1: bigint,
  band = PRICE_BAND_TICKS,
): { used0: bigint; used1: bigint; min0: bigint; min1: bigint } {
  const sp = (t: number) => Math.pow(1.0001, t / 2);
  const sa = sp(lo);
  const sb = sp(hi);
  const a0 = Number(amount0);
  const a1 = Number(amount1);
  const takes = (t: number) => {
    const need0 = Math.max(0, 1 / sp(t) - 1 / sb);
    const need1 = Math.max(0, sp(t) - sa);
    const L = Math.min(need0 > 0 ? a0 / need0 : Infinity, need1 > 0 ? a1 / need1 : Infinity);
    return Number.isFinite(L) ? { u0: L * need0, u1: L * need1 } : { u0: 0, u1: 0 };
  };
  const up = Math.max(0, Math.min(band, hi - 1 - tick - 4));
  const down = Math.max(0, Math.min(band, tick - lo - 4));
  const big = (x: number) => BigInt(Math.floor(Math.max(0, x)));
  const now = takes(tick);
  return {
    used0: big(now.u0),
    used1: big(now.u1),
    // 1% under again, for the floating point.
    min0: big(takes(tick + up).u0 * 0.99),
    min1: big(takes(tick - down).u1 * 0.99),
  };
}

/** The new range and what can go into it, counting what the old position will release. */
export function mintPlan(r: RangeReadings): MintPlan {
  const held = positionAmounts(r.liquidity, r.lower, r.upper, r.tick);
  const have0 = r.balances.usdt + held.amount0 + r.owed0;
  const have1 = r.balances.wbnb + held.amount1 + r.owed1;
  const left0 = left(r.rb.cap0, r.rb.spent0);
  const left1 = left(r.rb.cap1, r.rb.spent1);
  const amount0 = min(USDT_BUDGET, left0, r.approvals.usdt, have0);
  const amount1 = min(left1, r.approvals.wbnb, have1);
  const why =
    left0 === 0n
      ? `RecipientBound's lifetime USDT cap is spent (${tok(r.rb.spent0)} of ${tok(r.rb.cap0)})`
      : left1 === 0n
        ? `RecipientBound's lifetime WBNB cap is spent (${tok(r.rb.spent1)} of ${tok(r.rb.cap1)})`
        : r.approvals.usdt === 0n
          ? "the account's USDT allowance for RecipientBound is used up"
          : r.approvals.wbnb === 0n
            ? "the account's WBNB allowance for RecipientBound is used up"
            : amount0 < MIN_USDT
              ? `only ${tok(amount0)} USDT could go into it`
              : amount1 < MIN_WBNB
                ? `only ${tok(amount1)} WBNB could go into it`
                : null;
  const lo = floorTick(r.tick - BELOW);
  const hi = floorTick(r.tick + ABOVE) + SPACING;
  const used = expectedMint(r.tick, lo, hi, amount0, amount1);
  return { lo, hi, amount0, amount1, min0: used.min0, min1: used.min1, feasible: why === null, why };
}

export function decideRange(r: RangeReadings, now: number, account: Address): RangeDecision {
  const p = `Position #${r.position}`;
  if (r.owner.toLowerCase() !== account.toLowerCase()) return { step: "none", outcome: "skipped", reason: `${p} is no longer owned by the account, so Range-1 has nothing to manage.` };
  if (r.rb.expiry * 1000 < now + 3_600_000) {
    return { step: "none", outcome: "skipped", reason: `RecipientBound, the only contract Range-1 can act through, expires ${new Date(r.rb.expiry * 1000).toISOString().slice(0, 10)}.` };
  }
  if (!r.approvals.nfts) return { step: "none", outcome: "skipped", reason: "The account has not approved RecipientBound to manage its positions." };
  const plan = mintPlan(r);
  const range = `[${r.lower}, ${r.upper})`;
  if (r.liquidity > 0n) {
    if (r.tick >= r.lower && r.tick < r.upper) {
      return { step: "none", outcome: "nothing", reason: `${p} is in range: the pool is at tick ${r.tick}, inside ${range}, so it is earning and there is nothing to do.` };
    }
    const side = r.tick < r.lower ? "below" : "above";
    if (!plan.feasible) {
      return {
        step: "none",
        outcome: "nothing",
        reason: `${p} is out of range (tick ${r.tick} is ${side} ${range}), but a new range could not be opened: ${plan.why}. It does not start a recenter it cannot finish.`,
      };
    }
    return {
      step: "withdraw",
      reason: `${p} is out of range: the pool is at tick ${r.tick}, ${side} ${range}. Withdraw it, collect to the account, and open [${plan.lo}, ${plan.hi}) around the price.`,
      plan,
    };
  }
  // No liquidity: a recenter was cut off, and the chain says how far it got.
  if (r.owed0 > 0n || r.owed1 > 0n) return { step: "collect", reason: `${p} was withdrawn and its tokens are still owed: collect them to the account.`, plan };
  if (!plan.feasible) return { step: "none", outcome: "nothing", reason: `${p} is empty, and a new range could not be opened: ${plan.why}.` };
  return { step: "mint", reason: `${p} is empty after a withdrawal: open [${plan.lo}, ${plan.hi}) around tick ${r.tick}.`, plan };
}

const read = <T>(address: Address, abi: Abi, functionName: string, args: unknown[] = []) =>
  marketClient.readContract({ address, abi, functionName, args } as never) as Promise<T>;

export async function readRange(account: Address, position: bigint): Promise<RangeReadings> {
  const [pos, owner, slot, expiry, cap0, cap1, spent0, spent1, usdt, wbnb, nfts, allowUsdt, allowWbnb] = await Promise.all([
    read<readonly unknown[]>(POSITION_MANAGER, NPM_ABI as Abi, "positions", [position]),
    read<Address>(POSITION_MANAGER, NPM_ABI as Abi, "ownerOf", [position]),
    read<readonly unknown[]>(WBNB_USDT_POOL, POOL_ABI as Abi, "slot0"),
    read<bigint>(RECIPIENT_BOUND, RECIPIENT_BOUND_ABI as Abi, "expiry"),
    read<bigint>(RECIPIENT_BOUND, RECIPIENT_BOUND_ABI as Abi, "cap0"),
    read<bigint>(RECIPIENT_BOUND, RECIPIENT_BOUND_ABI as Abi, "cap1"),
    read<bigint>(RECIPIENT_BOUND, RECIPIENT_BOUND_ABI as Abi, "spent0"),
    read<bigint>(RECIPIENT_BOUND, RECIPIENT_BOUND_ABI as Abi, "spent1"),
    read<bigint>(USDT, ERC20 as Abi, "balanceOf", [account]),
    read<bigint>(WBNB, ERC20 as Abi, "balanceOf", [account]),
    read<boolean>(POSITION_MANAGER, NPM_ABI as Abi, "isApprovedForAll", [account, RECIPIENT_BOUND]),
    read<bigint>(USDT, ERC20 as Abi, "allowance", [account, RECIPIENT_BOUND]),
    read<bigint>(WBNB, ERC20 as Abi, "allowance", [account, RECIPIENT_BOUND]),
  ]);
  return {
    position,
    owner,
    lower: Number(pos[5]),
    upper: Number(pos[6]),
    liquidity: pos[7] as bigint,
    owed0: pos[10] as bigint,
    owed1: pos[11] as bigint,
    tick: Number(slot[1]),
    rb: { expiry: Number(expiry), cap0, cap1, spent0, spent1 },
    balances: { usdt, wbnb },
    approvals: { nfts, usdt: allowUsdt, wbnb: allowWbnb },
  };
}

/** The readings a record keeps, as plain values. */
function summary(r: RangeReadings): Record<string, unknown> {
  return {
    position: r.position.toString(),
    range: [r.lower, r.upper],
    tick: r.tick,
    liquidity: r.liquidity.toString(),
    capsLeft: { usdt: tok(left(r.rb.cap0, r.rb.spent0)), wbnb: tok(left(r.rb.cap1, r.rb.spent1)) },
    account: { usdt: tok(r.balances.usdt), wbnb: tok(r.balances.wbnb) },
  };
}

/** The position Range-1 manages: the last one it opened, else the one its first recenter opened. */
export function managedPosition(last: HouseRun | null): bigint | null {
  const fromRun = last?.state?.managed;
  if (typeof fromRun === "string" && /^\d+$/.test(fromRun)) return BigInt(fromRun);
  const first = recenterRecord()?.latest?.after?.tokenId;
  return first ? BigInt(first) : null;
}

/** A Minted event from RecipientBound since a block, if one landed. Throws if the logs cannot be read, so a mint is never sent blind. */
async function mintedSince(fromBlock: bigint): Promise<bigint | null> {
  const logs = await marketClient.getLogs({ address: RECIPIENT_BOUND, event: MINTED, fromBlock, toBlock: "latest" });
  const last = logs[logs.length - 1] as { args?: { tokenId?: bigint } } | undefined;
  return last?.args?.tokenId ?? null;
}

function mintedId(sent: Sent): bigint {
  for (const log of sent.logs) {
    if (log.address.toLowerCase() !== RECIPIENT_BOUND.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: RECIPIENT_BOUND_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName === "Minted") return (ev.args as { tokenId: bigint }).tokenId;
    } catch {
      /* not this event */
    }
  }
  throw new Error("the mint landed but RecipientBound emitted no Minted event");
}

interface Recenter {
  from: string;
  fromRange: [number, number];
  fromTick: number;
  step?: "withdrawn" | "collected";
  withdrawBlock: string | null;
  txs: { step: string; tx: string }[];
}

const rbCall = (functionName: string, args: readonly unknown[]): Call => ({ address: RECIPIENT_BOUND, abi: RECIPIENT_BOUND_ABI as unknown as Abi, functionName, args });
const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 900);
/** How far back to look for a lost mint when no withdrawal block was recorded: about an hour of BSC blocks. */
const LOOKBACK_BLOCKS = 8_000n;

export async function rangeTurn(ctx: TurnContext): Promise<TurnResult> {
  const managed = managedPosition(ctx.last);
  if (managed === null) return { outcome: "skipped", reason: "There is no position on record for Range-1 to manage.", readings: {}, txs: [] };

  let r = await readRange(ctx.account, managed);
  let d = decideRange(r, ctx.now, ctx.account);
  const readings = summary(r);
  if (d.step === "none") return { outcome: d.outcome, reason: d.reason, readings, txs: [] };

  if (!ctx.live) {
    const plan = d.plan;
    return {
      outcome: "would-act",
      reason: `${d.reason} It would put up to ${tok(plan.amount0)} USDT and ${tok(plan.amount1)} WBNB into the new range.`,
      readings: { ...readings, plan: { range: [plan.lo, plan.hi], usdt: tok(plan.amount0), wbnb: tok(plan.amount1), minUsdt: tok(plan.min0), minWbnb: tok(plan.min1) } },
      txs: [],
    };
  }

  const prior = (ctx.last?.state?.recenter as Recenter | null | undefined) ?? null;
  let rec: Recenter =
    prior && prior.from === managed.toString() ? prior : { from: managed.toString(), fromRange: [r.lower, r.upper], fromTick: r.tick, withdrawBlock: null, txs: [] };
  let written: TurnResult | null = null;

  while (Date.now() < ctx.stepDeadline) {
    if (d.step === "withdraw") {
      const held = positionAmounts(r.liquidity, r.lower, r.upper, r.tick);
      const sent = await ctx.send(
        rbCall("decreaseLiquidity", [managed, r.liquidity, bound(held.amount0), bound(held.amount1), deadline()]),
        `withdraw all liquidity from #${managed}, out of range at tick ${r.tick}, taking at least ${tok(bound(held.amount0))} USDT and ${tok(bound(held.amount1))} WBNB`,
      );
      rec = { ...rec, step: "withdrawn", withdrawBlock: sent.blockNumber.toString(), txs: [...rec.txs, { step: "withdraw", tx: sent.hash }] };
      written = {
        outcome: "partial",
        reason: `Withdrew position #${managed}: the pool at tick ${r.tick} had left its range [${r.lower}, ${r.upper}). Collecting and a new range come next.`,
        readings,
        txs: [{ step: "withdraw", tx: sent.hash }],
        state: { managed: managed.toString(), recenter: rec },
      };
      await ctx.record(written);
    } else if (d.step === "collect") {
      const sent = await ctx.send(rbCall("collect", [managed, MAX128, MAX128]), `collect #${managed}'s tokens and fees to the account`);
      rec = { ...rec, step: "collected", txs: [...rec.txs, { step: "collect", tx: sent.hash }] };
      written = {
        outcome: "partial",
        reason: `Collected position #${managed}'s tokens and fees to the account. A new range comes next.`,
        readings,
        txs: [{ step: "collect", tx: sent.hash }],
        state: { managed: managed.toString(), recenter: rec },
      };
      await ctx.record(written);
    } else if (d.step === "mint") {
      const head = await marketClient.getBlockNumber();
      const lost = await mintedSince(rec.withdrawBlock ? BigInt(rec.withdrawBlock) : head - LOOKBACK_BLOCKS);
      let opened: bigint;
      const txs = [...rec.txs];
      if (lost !== null && lost !== managed) {
        opened = lost;
      } else {
        const plan = d.plan;
        const sent = await ctx.send(
          rbCall("mint", [FEE, plan.lo, plan.hi, plan.amount0, plan.amount1, plan.min0, plan.min1, deadline()]),
          `open [${plan.lo}, ${plan.hi}) around tick ${r.tick} with at least ${tok(plan.min0)} USDT and ${tok(plan.min1)} WBNB; the position goes to the account`,
        );
        opened = mintedId(sent);
        txs.push({ step: "mint", tx: sent.hash });
      }
      const after = await readRange(ctx.account, opened);
      const inRange = after.tick >= after.lower && after.tick < after.upper;
      const sameOwner = after.owner.toLowerCase() === ctx.account.toLowerCase();
      written = {
        outcome: "acted",
        reason: `Recentered: position #${rec.from} had left its range, so it was withdrawn, collected to the account and replaced by #${opened} at [${after.lower}, ${after.upper}), ${inRange ? "in range" : "out of range"} at tick ${after.tick}. ${sameOwner ? "The account owned every position and token throughout." : "The new position is not owned by the account."}`,
        readings: {
          ...summary(after),
          before: { tokenId: rec.from, range: rec.fromRange, tick: rec.fromTick },
          after: { tokenId: opened.toString(), range: [after.lower, after.upper], tick: after.tick, inRange, owner: after.owner },
          sameOwnerThroughout: sameOwner,
          // Non-zero minimums on the withdrawal and the mint, which the first recenter did not have.
          bounded: true,
        },
        txs,
        state: { managed: opened.toString(), recenter: null },
      };
      await ctx.record(written);
      return { ...written, recorded: true };
    }
    r = await readRange(ctx.account, managed);
    d = decideRange(r, Date.now(), ctx.account);
    if (d.step === "none" || d.step === "withdraw") break;
  }

  if (written) return { ...written, recorded: true };
  return { outcome: "skipped", reason: "This run's time went on reading; it acts on the next run.", readings, txs: [] };
}
