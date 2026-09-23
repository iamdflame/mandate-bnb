/**
 * The whole book, with the bid queue and the bond floor attached to every job
 * still waiting for an agent.
 *
 * This used to live inside the API route, which meant the jobs page could
 * only fetch it from the browser and shipped HTML with no jobs in it. It is a
 * plain function now: the route serves it as JSON, and the jobs page renders
 * it on the server so the first byte already shows what is open.
 */

import { MARKET_ADDRESS, marketClient } from "@/lib/chain/market";
import { MANDATE_MARKET_V2_ABI } from "@/lib/chain/abiV2";
import { readBook } from "@/lib/chain/book";

export interface MarketBid {
  index: number;
  agent: string;
  bondWei: string;
  targetAlphaBps: number;
  spent: boolean;
  expiresAt: string;
}

export interface MarketMandate {
  id: number;
  deployment: string;
  deploymentAddress: string;
  canonical: boolean;
  category: number;
  state: number;
  principal: string;
  agent: string;
  capitalWei: string;
  bondWei: string;
  epochsSettled: number;
  epochsTotal: number;
  cumulativeAlphaBps: number;
  strikes: number;
  /** Only read for canonical mandates still awaiting a decision. */
  bids: MarketBid[];
  /**
   * The smallest bond the contract will accept on this job, in wei.
   *
   * Read from `requiredBond` rather than reconstructed in the browser: it is
   * the larger of a flat market minimum and a share of the capital, and both
   * are owner-settable, so a client that recomputed it would be right until
   * the day it silently was not.
   */
  requiredBondWei: string | null;
}

export interface MarketState {
  at: string;
  blockNumber: string;
  market: string;
  /** Deployments that did not answer, named rather than folded into the totals. */
  unread: string[];
  mandates: MarketMandate[];
  totals: { opened: number; active: number; underMandateWei: string; bondedWei: string };
}

export async function marketState(): Promise<MarketState> {
  if (!MARKET_ADDRESS) throw new Error("The market address is not configured.");
  const book = await readBook();

  // Bids are only actionable on the canonical deployment and only while a
  // mandate is still Open, so that is the only place we spend a read.
  const needsBids = book.rows.filter((r) => r.deployment.status === "canonical" && r.state === 0);
  const queues = await Promise.all(
    needsBids.map((r) =>
      marketClient.readContract({ address: MARKET_ADDRESS, abi: MANDATE_MARKET_V2_ABI, functionName: "getBids", args: [BigInt(r.id)] }).catch(() => null),
    ),
  );
  const floors = await Promise.all(
    needsBids.map((r) =>
      marketClient.readContract({ address: MARKET_ADDRESS, abi: MANDATE_MARKET_V2_ABI, functionName: "requiredBond", args: [BigInt(r.id)] }).catch(() => null),
    ),
  );
  const floorById = new Map(needsBids.map((r, i) => [r.id, floors[i] == null ? null : String(floors[i] as bigint)]));
  const byId = new Map(
    needsBids.map((r, i) => [
      r.id,
      ((queues[i] ?? []) as readonly { agent: string; bond: bigint; targetAlphaBps: number; spent: boolean; expiresAt: bigint }[]).map((b, index) => ({
        index,
        agent: b.agent,
        bondWei: b.bond.toString(),
        targetAlphaBps: Number(b.targetAlphaBps),
        spent: b.spent,
        expiresAt: b.expiresAt.toString(),
      })),
    ]),
  );

  return {
    at: book.at,
    blockNumber: (book.blockNumber ?? 0n).toString(),
    market: MARKET_ADDRESS,
    unread: book.unread,
    mandates: book.rows.map((r) => ({
      id: r.id,
      deployment: r.deployment.label,
      deploymentAddress: r.deployment.address,
      canonical: r.deployment.status === "canonical",
      category: r.category,
      state: r.state,
      principal: r.principal,
      agent: r.agent,
      capitalWei: r.capitalWei.toString(),
      bondWei: r.bondWei.toString(),
      epochsSettled: r.epochsSettled,
      epochsTotal: r.epochsTotal,
      cumulativeAlphaBps: Number(r.cumulativeAlphaBps),
      strikes: r.strikes,
      bids: byId.get(r.id) ?? [],
      requiredBondWei: floorById.get(r.id) ?? null,
    })),
    totals: {
      opened: book.opened,
      active: book.active,
      underMandateWei: book.underMandateWei.toString(),
      bondedWei: book.bondedWei.toString(),
    },
  };
}
