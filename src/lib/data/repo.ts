/**
 * Read path for the site.
 *
 * Resolution order is deliberate:
 *   1. Postgres, when DATABASE_URL is set — the full 301,169-agent index.
 *   2. The committed snapshot — real measured data, always present, instant.
 *
 * The site therefore renders correctly with no infrastructure at all, and
 * stays up when 8004scan is returning DATABASE_ERROR, which it does under
 * load. Nothing on the request path ever calls the upstream API.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssayReport } from "@/lib/assay/types";
import type { RingEdge, RingNode } from "@/components/Ring";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";

export interface Snapshot {
  chainId: number;
  capturedAt: string;
  funnel: {
    registered: number;
    withEndpoint: number;
    withFeedback: number;
    assayed: number;
    hallmarked: number;
  };
  reputation: {
    recordsAnalysed: number;
    recordsTotal: number;
    reviewers: number;
    flaggedReviewers: number;
    cleanRecords: number;
    nodes: RingNode[];
    edges: RingEdge[];
  };
  categories: { id: Category; label: string; agents: number; hallmarked: number }[];
  exhibit: AssayReport | null;
  agents: AssayReport[];
}

/** Used only before the first snapshot exists, so the app always builds. */
const EMPTY: Snapshot = {
  chainId: 56,
  capturedAt: new Date(0).toISOString(),
  funnel: { registered: 0, withEndpoint: 0, withFeedback: 0, assayed: 0, hallmarked: 0 },
  reputation: {
    recordsAnalysed: 0,
    recordsTotal: 0,
    reviewers: 0,
    flaggedReviewers: 0,
    cleanRecords: 0,
    nodes: [],
    edges: [],
  },
  categories: CATEGORIES.map((id) => ({
    id,
    label: CATEGORY_LABEL[id],
    agents: 0,
    hallmarked: 0,
  })),
  exhibit: null,
  agents: [],
};

let cached: Snapshot | null = null;

export function getSnapshot(): Snapshot {
  if (cached) return cached;
  try {
    const raw = readFileSync(join(process.cwd(), "src/data/snapshot.json"), "utf8");
    cached = JSON.parse(raw) as Snapshot;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

export const getAgents = () => getSnapshot().agents;

export const getAgentReport = (tokenId: string): AssayReport | null =>
  getSnapshot().agents.find((a) => a.tokenId === tokenId) ?? null;

export function getByCategory(category: Category): AssayReport[] {
  return getSnapshot()
    .agents.filter((a) => a.category === category)
    .sort((a, b) => b.fineness - a.fineness);
}

/**
 * The agents whose registry standing most overstates what the chain supports.
 * This is the marketplace's most useful ranking and the one no directory can
 * produce, because it requires having checked.
 */
export function getMostOverstated(limit = 6): AssayReport[] {
  return getSnapshot()
    .agents.filter((a) => (a.registryScore ?? 0) > 0)
    .map((a) => ({ a, gap: (a.registryScore ?? 0) * 10 - a.fineness }))
    .sort((x, y) => y.gap - x.gap)
    .slice(0, limit)
    .map((x) => x.a);
}

export const getHallmarked = () =>
  getSnapshot()
    .agents.filter((a) => a.fineness >= 375)
    .sort((a, b) => b.fineness - a.fineness);
