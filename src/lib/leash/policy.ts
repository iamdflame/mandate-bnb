/**
 * What a user may leash our agents to do on their own wallet, and nothing more.
 *
 * Each leash is an Altana session on the user's passkey wallet. Its call list
 * is the whole of what the agent may touch, and every call in it acts for the
 * caller with no recipient argument, so whatever it moves stays with the
 * wallet. Its spend is capped per day in USDT, and a little native BNB a day
 * pays the relay. It expires on its own, and the wallet's owner revokes it in
 * one step.
 */

import { parseEther, parseUnits, type Address } from "viem";
import { USDT } from "@/lib/chain/leash";
import { VUSDT } from "@/lib/chain/house";

export type LeashSlug = "yield-1" | "guard-1";

export interface LeashPolicy {
  slug: LeashSlug;
  name: string;
  /** In a sentence, what it does with the wallet. */
  does: string;
  calls: { to: Address; signature: string; words: string }[];
  /** What the wallet approves Venus to take, once, by its owner: exactly the budget. */
  approve: { token: Address; spender: Address } | null;
  /** The relay's fee for the agent's own actions, per day. */
  nativePerDay: bigint;
}

export const LEASH_POLICIES: Record<LeashSlug, LeashPolicy> = {
  "yield-1": {
    slug: "yield-1",
    name: "Yield-1",
    does: "Supplies idle USDT in this wallet to Venus when Venus pays a rate, and can take it back out. What it supplies is credited to this wallet.",
    calls: [
      { to: VUSDT, signature: "mint(uint256)", words: "Supply this wallet's USDT to Venus, credited to this wallet" },
      { to: VUSDT, signature: "redeemUnderlying(uint256)", words: "Take this wallet's USDT back out of Venus, to this wallet" },
    ],
    approve: { token: USDT, spender: VUSDT },
    nativePerDay: parseEther("0.0005"),
  },
  "guard-1": {
    slug: "guard-1",
    name: "Guard-1",
    does: "Repays this wallet's own Venus USDT debt when its health factor falls near liquidation.",
    calls: [{ to: VUSDT, signature: "repayBorrow(uint256)", words: "Repay this wallet's own Venus USDT debt" }],
    approve: { token: USDT, spender: VUSDT },
    nativePerDay: parseEther("0.0005"),
  },
};

export const isLeashSlug = (s: string): s is LeashSlug => s === "yield-1" || s === "guard-1";

/** The bounds a user may choose within. */
export const LIMITS = { minDailyUsdt: 0.01, maxDailyUsdt: 100, minDays: 1, maxDays: 30 } as const;

/** The session's permissions, in the SDK's shape: the calls, the daily USDT cap, and the relay's native allowance. */
export function permissionsFor(slug: LeashSlug, dailyUsdt: number) {
  const p = LEASH_POLICIES[slug];
  return {
    calls: p.calls.map((c) => ({ to: c.to, signature: c.signature })),
    spend: [
      { limit: p.nativePerDay, period: "day" as const },
      { limit: parseUnits(String(dailyUsdt), 18), period: "day" as const, token: USDT },
    ],
  };
}
