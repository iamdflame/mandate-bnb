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
import { db, hasDb, schema } from "@/lib/db/client";

export interface IndexedAgent {
  tokenId: string;
  name: string | null;
  description: string | null;
  owner: string | null;
  imageUrl: string | null;
  protocols: string[];
  x402: boolean;
  /** Rung 2: the registry says this endpoint answered. Absent in older snapshots. */
  endpointVerified?: boolean;
  registryScore: number | null;
  feedbacks: number;
  avgScore: number | null;
  createdAt: string | null;
  category: Category | null;
  confidence: number;
  matched: string[];
  /** When this row was last refreshed from the registry. */
  lastSeen?: string;
  /** Ladder rung, attached at render time. Not part of the stored index. */
  rung?: number;
  /** Why it sits there rather than higher. */
  rungReason?: string;
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
    /** Rows refreshed in the most recent run; the rest are carried. */
    refreshed?: number;
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
 * The index, preferring Postgres and falling back to the committed snapshot.
 *
 * The worker has always written to Postgres and nothing ever read from it, so
 * the database was a write-only store and the site ran on a file — which is
 * what C2 is actually about. This is the read path.
 *
 * The fallback is deliberate rather than defensive. It keeps the site
 * deployable before any infrastructure exists and keeps it up when the
 * database is unreachable, and the source is reported rather than hidden so
 * nobody has to guess which one they are looking at.
 */
export async function readAgentIndex(): Promise<AgentIndex & { source: "postgres" | "snapshot" }> {
  const snapshot = getAgentIndex();
  if (!hasDb || !db) return { ...snapshot, source: "snapshot" };

  try {
    const rows = await db.select().from(schema.agents).limit(20_000);
    if (rows.length === 0) return { ...snapshot, source: "snapshot" };

    const agents: IndexedAgent[] = rows.map((r) => ({
      tokenId: String(r.tokenId),
      name: r.name ?? null,
      description: r.description ?? null,
      owner: r.ownerAddress ?? null,
      imageUrl: r.imageUrl ?? null,
      protocols: r.supportedProtocols ?? [],
      x402: Boolean(r.x402Supported),
      endpointVerified: Boolean(r.isEndpointVerified),
      registryScore: r.registryScore ?? null,
      feedbacks: r.registryFeedbacks ?? 0,
      avgScore: r.registryAvgScore ?? null,
      createdAt: r.registeredAt ? new Date(r.registeredAt).toISOString() : null,
      category: (r.category as Category | null) ?? null,
      confidence: Number(r.categoryConfidence ?? 0),
      // The stored row carries the assay, not the phrases that matched; the
      // signals live in `results` and are rendered from the assay itself.
      matched: [],
      lastSeen: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
    }));

    const byCategory = Object.fromEntries(
      CATEGORIES.map((c) => [c, agents.filter((a) => a.category === c).length]),
    ) as Record<Category, number>;

    return {
      ...snapshot,
      agents,
      counts: {
        ...snapshot.counts,
        indexed: agents.length,
        classified: agents.filter((a) => a.category).length,
        byCategory,
      },
      source: "postgres",
    };
  } catch {
    // A database that will not answer is not a reason to serve nothing.
    return { ...snapshot, source: "snapshot" };
  }
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
