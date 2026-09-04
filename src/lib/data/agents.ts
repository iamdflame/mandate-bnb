/**
 * The agent index the marketplace browses.
 *
 * Read from a committed file rather than the API: 8004scan allows 25 requests
 * a minute anonymously, so a page that queried it per request would be unusable
 * and would break entirely under two concurrent visitors. The indexer writes
 * this; the site only reads it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES, type Category } from "@/lib/config";

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

export interface AgentIndex {
  chainId: number;
  capturedAt: string;
  apiCalls: number;
  registry: { registered: number; withEndpoint: number; withFeedback: number };
  counts: {
    indexed: number;
    classified: number;
    byCategory: Record<Category, number>;
  };
  agents: IndexedAgent[];
}

const EMPTY: AgentIndex = {
  chainId: 56,
  capturedAt: new Date(0).toISOString(),
  apiCalls: 0,
  registry: { registered: 0, withEndpoint: 0, withFeedback: 0 },
  counts: {
    indexed: 0,
    classified: 0,
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
  },
  agents: [],
};

let cached: AgentIndex | null = null;

export function getAgentIndex(): AgentIndex {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(process.cwd(), "src/data/agents.json"), "utf8");
    cached = JSON.parse(raw) as AgentIndex;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

/**
 * Ranks agents within a category.
 *
 * Registry score alone puts batch-minted placeholders at the top, because the
 * registry scores metadata completeness rather than whether anything works.
 * Classification confidence comes first, then evidence of any real counterpart
 * having interacted with it.
 */
export function agentsInCategory(category: Category, limit = 24): IndexedAgent[] {
  return getAgentIndex()
    .agents.filter((a) => a.category === category)
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.feedbacks - a.feedbacks ||
        (b.registryScore ?? 0) - (a.registryScore ?? 0),
    )
    .slice(0, limit);
}

export function findAgent(tokenId: string): IndexedAgent | null {
  return getAgentIndex().agents.find((a) => a.tokenId === tokenId) ?? null;
}

export function searchAgents(q: string, limit = 60): IndexedAgent[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return getAgentIndex()
    .agents.filter(
      (a) =>
        a.tokenId.includes(needle) ||
        (a.name ?? "").toLowerCase().includes(needle) ||
        (a.description ?? "").toLowerCase().includes(needle),
    )
    .slice(0, limit);
}
