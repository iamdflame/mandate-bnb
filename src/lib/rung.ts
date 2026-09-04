/**
 * Where a single agent sits on the ladder.
 *
 * The rung is derived, never claimed, and it is derived from whatever evidence
 * actually exists — which for most of the registry is very little. An agent
 * that cannot be placed above rung 1 is not being accused of anything; it is
 * being described.
 *
 * The upper rungs are keyed by wallet, the lower ones by registry entry, and
 * those are not yet the same population. `RungPlacement` says which of the two
 * it could see, so a page never implies a registry agent was checked against
 * the market when it was not.
 */

import type { IndexedAgent } from "@/lib/data/agents";
import {
  MANDATE_MARKET_ABI,
  MARKET_ADDRESS,
  marketClient,
  readAllMandates,
} from "@/lib/chain/market";
import { HALLMARK_BAR } from "@/lib/ladder";
import type { Address } from "viem";
import { RUNG_NAMES } from "@/lib/config";

export interface MarketSets {
  /** Lower-cased wallets with a fineness at or above the bar. */
  assayed: Set<string>;
  /** Lower-cased wallets holding a mandate. */
  bonded: Set<string>;
  /** Lower-cased wallets with at least one settled epoch. */
  settled: Set<string>;
  /** False when the chain could not be read; rungs 4-6 are then unknown. */
  read: boolean;
}

export const EMPTY_SETS: MarketSets = {
  assayed: new Set(),
  bonded: new Set(),
  settled: new Set(),
  read: false,
};

/**
 * The market's whole upper-rung population, read once.
 *
 * Small by construction — that is the finding, not an optimisation — so this
 * is a handful of reads rather than a scan per agent.
 */
export async function readMarketSets(): Promise<MarketSets> {
  const assayed = new Set<string>();
  const bonded = new Set<string>();
  const settled = new Set<string>();
  try {
    const mandates = await readAllMandates();
    for (const m of mandates) {
      const a = m.agent?.toLowerCase();
      if (!a || /^0x0+$/.test(a)) continue;
      bonded.add(a);
      if (m.epochsSettled > 0) settled.add(a);
    }
    for (const a of bonded) {
      const f = (await marketClient.readContract({
        address: MARKET_ADDRESS,
        abi: MANDATE_MARKET_ABI,
        functionName: "fineness",
        args: [a as Address],
      })) as number;
      if (Number(f) >= HALLMARK_BAR) assayed.add(a);
    }
    return { assayed, bonded, settled, read: true };
  } catch {
    return EMPTY_SETS;
  }
}

export interface RungPlacement {
  rung: number;
  name: string;
  /** Why it sits here rather than higher. Always populated. */
  reason: string;
  /** Rungs the evidence could not settle either way. */
  unknown: number[];
}

/**
 * Places an agent, and says what stopped it going higher.
 *
 * MandateX renders an exclusion reason for every candidate that falls out; this
 * does the same for every agent that does not reach the top, because "not
 * listed" and "listed with a reason" are very different products.
 */
export function placeAgent(agent: IndexedAgent, sets: MarketSets): RungPlacement {
  const wallet = agent.owner?.toLowerCase() ?? "";
  const unknown: number[] = [];

  const settled = sets.read && wallet && sets.settled.has(wallet);
  const bonded = sets.read && wallet && sets.bonded.has(wallet);
  const assayed = sets.read && wallet && sets.assayed.has(wallet);
  if (!sets.read) unknown.push(4, 5, 6);

  // Capability needs a log scan per agent, which is not run for a list page.
  unknown.push(3);

  if (settled) {
    return { rung: 6, name: RUNG_NAMES[6], reason: "has settled epochs against committed measurements", unknown: [] };
  }
  if (bonded) {
    return {
      rung: 5,
      name: RUNG_NAMES[5],
      reason: "holds a mandate with its own capital at risk, but has settled no epochs yet",
      unknown,
    };
  }
  if (assayed) {
    return { rung: 4, name: RUNG_NAMES[4], reason: "assayed at or above the bar, but has never posted a bond", unknown };
  }
  if (agent.endpointVerified) {
    return {
      rung: 2,
      name: RUNG_NAMES[2],
      reason: "its endpoint answered, but it has never been assayed on chain",
      unknown,
    };
  }
  if (agent.name || agent.description) {
    return {
      rung: 1,
      name: RUNG_NAMES[1],
      reason: "its card parses, but no endpoint of ours has ever reached it",
      unknown,
    };
  }
  return {
    rung: 0,
    name: RUNG_NAMES[0],
    reason: "registered, and nothing beyond that: no name, no description, no endpoint",
    unknown,
  };
}

export { RUNG_NAMES };
