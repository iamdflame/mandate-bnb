/**
 * Builds the agent index the marketplace browses.
 *
 * The previous snapshot held forty agents, which is not a marketplace over a
 * registry of three hundred thousand. The constraint is the API: 25 req/min
 * anonymous, 500 with a key. So the index is built the cheap way round — a
 * list call returns up to a hundred agents per request, while a detail call
 * returns one — and classification runs on what the list already gives us.
 *
 * Breadth here, depth on demand: the agent page assays live when opened.
 *
 *   npx tsx --env-file=.env src/scripts/index-agents.ts [maxPerQuery]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { countAgents, listAgents, type ScanAgentSummary } from "@/lib/sources/scan";
import { classify } from "@/lib/assay/classify";

const CHAIN = Number(process.env.CHAIN_ID ?? 56);
const PER_QUERY = Number(process.argv[2] ?? 400);
const OUT = "src/data/agents.json";

const log = (...a: unknown[]) => console.log("·", ...a);

/**
 * Search terms per category, deliberately wide.
 *
 * An agent that manages LP ranges rarely says "rebalancing" — it says range,
 * or position, or concentrated liquidity. Narrow terms return a handful and
 * make a category look empty when it is not.
 */
const QUERIES: Record<Category, string[]> = {
  rebalancing: ["rebalance", "rebalancing", "lp range", "liquidity range", "position manager", "concentrated liquidity", "impermanent"],
  "grid-trading": ["grid", "grid trading", "trading bot", "dca", "market making", "limit order", "spread"],
  "yield-optimisation": ["yield", "apr", "apy", "farming", "vault", "compound", "staking", "harvest", "optimiser", "optimizer"],
  "health-factor": ["health factor", "liquidation", "collateral", "lending", "borrow", "ltv", "venus", "aave"],
};

/** Untargeted sweeps, so the index is not only what a keyword happened to match. */
const SWEEPS: { label: string; params: Parameters<typeof listAgents>[0] }[] = [
  { label: "verified endpoints", params: { chainId: CHAIN, isEndpointVerified: true, limit: 100 } },
  { label: "carrying feedback", params: { chainId: CHAIN, minFeedbacks: 1, limit: 100, sortBy: "total_feedbacks", sortOrder: "desc" } },
  { label: "highest scored", params: { chainId: CHAIN, limit: 100, sortBy: "total_score", sortOrder: "desc" } },
  { label: "newest", params: { chainId: CHAIN, limit: 100, sortBy: "created_at", sortOrder: "desc" } },
];

const found = new Map<string, ScanAgentSummary>();
let calls = 0;

async function page(params: Parameters<typeof listAgents>[0], max: number, label: string) {
  let offset = 0;
  let added = 0;
  while (offset < max) {
    let items: ScanAgentSummary[] = [];
    try {
      const res = await listAgents({ ...params, limit: 100, offset });
      calls += 1;
      items = res.items ?? [];
    } catch (error) {
      log(`  ${label}: ${String(error).slice(0, 80)}`);
      break;
    }
    if (items.length === 0) break;
    for (const a of items) {
      if (!found.has(a.token_id)) {
        found.set(a.token_id, a);
        added += 1;
      }
    }
    if (items.length < 100) break;
    offset += 100;
  }
  return added;
}

log(`indexing BSC agents · ${PER_QUERY} per query`);

// The three numbers the marketplace states about its own coverage.
const registered = await countAgents({ chainId: CHAIN });
const withEndpoint = await countAgents({ chainId: CHAIN, isEndpointVerified: true });
const withFeedback = await countAgents({ chainId: CHAIN, minFeedbacks: 1 });
calls += 3;
log(`registry: ${registered} registered · ${withFeedback} rated · ${withEndpoint} reachable`);

for (const s of SWEEPS) {
  const n = await page(s.params, PER_QUERY, s.label);
  log(`sweep ${s.label}: +${n} (total ${found.size})`);
}

for (const category of CATEGORIES) {
  let added = 0;
  for (const term of QUERIES[category]) {
    added += await page({ chainId: CHAIN, search: term, limit: 100 }, PER_QUERY, term);
  }
  log(`${CATEGORY_LABEL[category]}: +${added} (total ${found.size})`);
}

// ---------------------------------------------------------------------------
// Classify from what the list already returned. No extra calls.
// ---------------------------------------------------------------------------

export interface IndexedAgent {
  tokenId: string;
  name: string | null;
  description: string | null;
  owner: string | null;
  imageUrl: string | null;
  protocols: string[];
  x402: boolean;
  registryScore: number | null;
  feedbacks: number;
  avgScore: number | null;
  createdAt: string | null;
  category: Category | null;
  confidence: number;
  matched: string[];
}

const agents: IndexedAgent[] = [...found.values()].map((a) => {
  const c = classify({ name: a.name, description: a.description });
  return {
    tokenId: a.token_id,
    name: a.name,
    description: a.description,
    owner: a.owner_address,
    imageUrl: a.image_url,
    protocols: a.supported_protocols ?? [],
    x402: Boolean(a.x402_supported),
    registryScore: a.total_score,
    feedbacks: a.total_feedbacks ?? 0,
    avgScore: a.average_score,
    createdAt: a.created_at,
    category: c.category,
    confidence: c.confidence,
    matched: c.matched,
  };
});

const byCategory = Object.fromEntries(
  CATEGORIES.map((c) => [c, agents.filter((a) => a.category === c).length]),
) as Record<Category, number>;

const payload = {
  chainId: CHAIN,
  capturedAt: new Date().toISOString(),
  apiCalls: calls,
  registry: { registered, withEndpoint, withFeedback },
  counts: {
    indexed: agents.length,
    classified: agents.filter((a) => a.category).length,
    byCategory,
  },
  agents: agents.sort(
    (a, b) => b.feedbacks - a.feedbacks || (b.registryScore ?? 0) - (a.registryScore ?? 0),
  ),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));

console.log(`\nwrote ${OUT}`);
console.log(`  indexed    ${agents.length} agents in ${calls} API calls`);
console.log(`  classified ${payload.counts.classified}`);
for (const c of CATEGORIES) {
  console.log(`    ${CATEGORY_LABEL[c].padEnd(26)} ${byCategory[c]}`);
}
