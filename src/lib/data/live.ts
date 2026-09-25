/**
 * One call at the top of a judge-facing render.
 *
 * Loads any snapshot newer than the build from the database, then schedules
 * a census slice to run after the response if the reading is stale. Pages
 * stay synchronous below this line.
 */

import { DEFAULT_WARM, warm, type SnapshotName } from "@/lib/data/snapshots";
import { scheduleRefresh } from "@/lib/census/refresh";
import { warmRegistry } from "@/lib/registry/tail";
import { warmOutcomes } from "@/lib/market/hire-law";

/**
 * `names` adds to the defaults; it never replaces them. It used to replace
 * them, and /judges, asking only for the grid window, rendered a census
 * fifteen hours old while a fresher one sat in the database.
 */
export async function live(names: SnapshotName[] = []): Promise<void> {
  // Agents minted since the committed crawl, read from the registry by the tail.
  // and every recorded paid call, so the hire law remembers a failure a visitor's own payment met.
  await Promise.all([
    warm([...new Set([...DEFAULT_WARM, ...names])]).catch(() => undefined),
    warmRegistry().catch(() => undefined),
    warmOutcomes().catch(() => undefined),
  ]);
  scheduleRefresh();
}
