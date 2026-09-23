/**
 * The shape of the agent economy on BNB Smart Chain, as six real numbers.
 *
 * Hundreds of thousands of agents are registered; a few hundred publish a
 * card that says they do one of the four jobs; fewer answer when called;
 * fewer still quote a price; and a small number can actually be hired today.
 * That narrowing is the most honest one-picture explanation of what this
 * marketplace does, so it is drawn on the home page.
 *
 * Every stage comes from a named source with a time, and a stage whose source
 * did not answer is "unknown" rather than zero, because a zero is a claim.
 */

import { registeredCount } from "@/lib/registry/count";
import { getAgentIndex } from "@/lib/data/agents";
import { censusAge, type Listing } from "@/lib/market/listing";
import { PRED } from "@/lib/market/catalogue";
import { withTimeout } from "@/lib/cache";

export interface Stage {
  key: "registered" | "readable" | "listed" | "reachable" | "priced" | "hireable";
  label: string;
  n: number | null;
  /** Where it came from, in words. */
  source: string;
  /** When it was read. */
  at: string | null;
  /** The list this stage counts, where there is one. */
  href: string | null;
}

export async function funnel(all: Listing[]): Promise<Stage[]> {
  const chain = await withTimeout(registeredCount().catch(() => null), 6_000);
  const index = getAgentIndex();
  const census = censusAge();

  return [
    {
      key: "registered",
      label: "registered",
      n: chain?.count ?? (index.registry.registered || null),
      source: chain ? `ERC-8004 registry, read from the chain at block ${chain.block.toLocaleString("en-GB")}` : "ERC-8004 registry, from our last index",
      at: chain?.at ?? index.capturedAt,
      href: null,
    },
    {
      key: "readable",
      label: "with a readable card",
      n: index.agents.length || null,
      source: "Registrations whose agent card we could fetch and parse",
      at: index.capturedAt,
      href: null,
    },
    {
      key: "listed",
      label: "do one of the four jobs",
      n: all.length,
      source: "Cards that describe rebalancing, grid trading, yield or loan protection",
      at: index.capturedAt,
      href: "/agents",
    },
    {
      key: "reachable",
      label: "answered our call",
      n: all.filter(PRED.live).length,
      source: "Our own probe called the endpoint each one publishes",
      at: census.at,
      href: "/agents?live=1",
    },
    {
      key: "priced",
      label: "publish a price",
      n: all.filter(PRED.priced).length,
      source: "A per-call price read from the agent's own payment response",
      at: census.at,
      href: "/agents?priced=1",
    },
    {
      key: "hireable",
      label: "hireable today",
      n: all.filter(PRED.hireable).length,
      source: "Answered inside a day and priced on a rail this marketplace can settle",
      at: census.at,
      href: "/agents?hireable=1",
    },
  ];
}

/**
 * Bar heights on a log scale. On a linear one the registry would be the only
 * visible bar; the story is in the bottom three orders of magnitude.
 */
export function logHeights(stages: Pick<Stage, "n">[]): (number | null)[] {
  const top = Math.max(...stages.map((s) => s.n ?? 0), 1);
  const lt = Math.log10(top + 1);
  return stages.map((s) => (s.n === null ? null : Math.max(0.06, Math.log10(s.n + 1) / lt)));
}
