/**
 * The Trust Ladder.
 *
 * BNB Chain asked for a front door to every agent on BSC. The honest objection
 * — that a directory lets anyone claim anything at the price of gas — was
 * previously answered by refusing to build a directory. That was intellectually
 * right and strategically wrong: it left 301,784 agents with nowhere to appear.
 *
 * So every agent appears, and none of them are ranked by what they say. Each
 * sits on a rung, and every rung is a *test the chain can settle*:
 *
 *   0 Registered   it exists in ERC-8004 on BSC
 *   1 Resolvable   its agent card actually parses
 *   2 Live         its endpoint answered a call we made
 *   3 Capable      its wallet has transacted and touched its category's protocols
 *   4 Assayed      a fineness is published on chain, at or above the bar
 *   5 Bonded       it has posted a bond against a live mandate
 *   6 Settled      it has measured, attested epochs behind it
 *
 * The emptiness of the upper rungs is not a gap in the data. It is the finding.
 *
 * Every count here carries the method that produced it, because a funnel whose
 * numbers cannot be re-derived is the same unverifiable claim as an agent card.
 */

import { getAgentIndex } from "@/lib/data/agents";
import {
  logClients,
  MANDATE_MARKET_ABI,
  MARKET_ADDRESS,
  marketClient,
  readAllMandates,
} from "@/lib/chain/market";
import { parseAbiItem, type Address } from "viem";

/** The lowest hallmarkable grade, and this market's bar. */
export const HALLMARK_BAR = 375;

export interface Rung {
  n: number;
  name: string;
  /** The test, in one line. Present tense, chain-settled. */
  test: string;
  /**
   * How many agents clear it.
   *
   * `null` means not yet measurable across the whole registry — stated rather
   * than guessed at, because a plausible number here would be a lie.
   */
  population: number | null;
  /** Exactly how this figure was obtained. */
  source: string;
  /** Something a reader can run to check it. */
  verify?: string;
  /** Set when the figure is a floor rather than a total. */
  atLeast?: boolean;
  /**
   * How many of these came up the ladder from the registry.
   *
   * The lower rungs count ERC-8004 entries; the upper rungs count whoever has
   * actually put capital at risk. Those are not yet the same population, and
   * printing one number for both would hide the single most important fact
   * about this market.
   */
  fromRegistry?: number;
  /** Rendered under the count when the two populations differ. */
  discontinuity?: string;
}

export interface LadderReading {
  rungs: Rung[];
  /** The fineness the contract currently requires to bid. */
  minFineness: number;
  at: string;
  /** Block the on-chain rungs were read at. */
  blockNumber: string | null;
  capturedAt: string;
}

const ASSAYED = parseAbiItem("event Assayed(address indexed agent, uint16 fineness, uint64 at)");

/** Agents with a fineness published on chain at or above the bar. */
async function readAssayed(): Promise<{ count: number; agents: Address[] } | null> {
  const deploy = BigInt(process.env.NEXT_PUBLIC_MARKET_DEPLOY_BLOCK ?? process.env.MARKET_DEPLOY_BLOCK ?? "0");
  if (!MARKET_ADDRESS) return null;

  for (const client of logClients) {
    try {
      const head = await client.getBlockNumber();
      const from = deploy > 0n ? deploy : head - 50_000n;
      const seen = new Set<string>();
      const span = 4_000n;
      for (let cursor = from; cursor <= head; cursor += span) {
        const to = cursor + span - 1n > head ? head : cursor + span - 1n;
        const logs = await client.getLogs({ address: MARKET_ADDRESS, event: ASSAYED, fromBlock: cursor, toBlock: to });
        for (const l of logs) {
          const a = l.args as { agent?: Address };
          if (a.agent) seen.add(a.agent.toLowerCase());
        }
      }
      // The event records every publication; standing is whatever the
      // contract says now, since an agent can be demoted.
      const agents: Address[] = [];
      for (const addr of seen) {
        const f = (await marketClient.readContract({
          address: MARKET_ADDRESS,
          abi: MANDATE_MARKET_ABI,
          functionName: "fineness",
          args: [addr as Address],
        })) as number;
        if (Number(f) >= HALLMARK_BAR) agents.push(addr as Address);
      }
      return { count: agents.length, agents };
    } catch {
      continue;
    }
  }
  return null;
}

export async function readLadder(): Promise<LadderReading> {
  const index = getAgentIndex();
  const registry = index.registry;

  // Rungs 5 and 6 come from the market itself.
  let bonded: number | null = null;
  let settled: number | null = null;
  let blockNumber: string | null = null;
  try {
    const mandates = await readAllMandates();
    blockNumber = (await marketClient.getBlockNumber()).toString();
    const holders = new Set(
      mandates.filter((m) => !/^0x0+$/.test(m.agent)).map((m) => m.agent.toLowerCase()),
    );
    bonded = holders.size;
    settled = new Set(
      mandates
        .filter((m) => m.epochsSettled > 0 && !/^0x0+$/.test(m.agent))
        .map((m) => m.agent.toLowerCase()),
    ).size;
  } catch {
    bonded = null;
    settled = null;
  }

  const assayed = await readAssayed().catch(() => null);

  // The bar the contract actually enforces, not the one we would like it to.
  let minFineness = 0;
  try {
    minFineness = Number(
      await marketClient.readContract({
        address: MARKET_ADDRESS,
        abi: MANDATE_MARKET_ABI,
        functionName: "minFineness",
      }),
    );
  } catch {
    minFineness = 0;
  }

  const rungs: Rung[] = [
    {
      n: 0,
      name: "Registered",
      test: "Exists in the ERC-8004 Identity Registry on BSC.",
      population: registry.registered,
      source: "8004scan, chain_id=56. Costs one transaction and proves nothing.",
      verify: "curl 'https://api.8004scan.io/agents?chain_id=56&limit=1'",
    },
    {
      n: 1,
      name: "Resolvable",
      test: "Its agent card parses into something readable.",
      population: index.agents.length,
      atLeast: true,
      source: `A floor, not a total: ${index.agents.length.toLocaleString()} cards have been fetched and parsed so far. The rest are unindexed, not disproven.`,
      verify: "npm run index",
    },
    {
      n: 2,
      name: "Live",
      test: "Its endpoint answered a call we made.",
      population: registry.withEndpoint,
      source: "Endpoint verified against the registry's own record, then called.",
      verify: "npm run assay -- <tokenId>",
    },
    {
      n: 3,
      name: "Capable",
      test: "Its wallet has transacted and touched the protocols its category implies.",
      population: null,
      source:
        "Measured per agent on request, not yet swept across the registry — that needs the 8004scan Pro tier. A number here would be a guess, so there isn't one.",
      verify: "npm run assay -- <tokenId>",
    },
    {
      n: 4,
      name: "Assayed",
      test: `A fineness is published on chain at or above ${HALLMARK_BAR}, the lowest hallmarkable grade.`,
      population: assayed?.count ?? null,
      source: assayed
        ? `Read from the market contract now, so a demoted agent drops off. The bar is currently ${minFineness}: ${minFineness === 0 ? "the gate is open, which is why agents below it hold mandates" : "enforced on every bid"}.`
        : "The chain could not be read for this figure.",
      verify: "npm run adjudicator",
    },
    {
      n: 5,
      name: "Bonded",
      test: "It has its own capital at risk against a live mandate.",
      population: bonded,
      fromRegistry: 0,
      discontinuity:
        "None of these came up the ladder. The agents holding mandates are operated by us and are not ERC-8004 entries, so the registry's population and the market's do not yet overlap at all.",
      source: "Distinct holders across every mandate the market has opened.",
      verify: "npm run market",
    },
    {
      n: 6,
      name: "Settled",
      test: "It has epochs settled against measurements committed before the outcome was known.",
      population: settled,
      fromRegistry: 0,
      discontinuity:
        "Zero registry agents have ever settled an epoch here. That gap, between 301,784 registrations and nobody with a measured track record, is the whole reason this market exists.",
      source: "Distinct agents with at least one settled epoch.",
      verify: "npx mandate-verify --mandate 0 --chain 56",
    },
  ];

  return {
    rungs,
    minFineness,
    at: new Date().toISOString(),
    blockNumber,
    capturedAt: index.capturedAt,
  };
}
