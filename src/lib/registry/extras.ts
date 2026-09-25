/**
 * Agents read from the ERC-8004 registry since the committed crawl.
 *
 * The committed index is a snapshot; the registry grows by hundreds of agents a
 * day. The registry tail writes each new agent to Postgres, and this holds the
 * ones the catalogue needs in memory so the synchronous index can merge them.
 * No imports beyond types, so the index can depend on it without a cycle.
 */

import type { IndexedAgent } from "@/lib/data/agents";

let rows = new Map<string, IndexedAgent>();
let version = 0;
let at: string | null = null;

export function registryExtras(): { rows: ReadonlyMap<string, IndexedAgent>; version: number; at: string | null } {
  return { rows, version, at };
}

export function setRegistryExtras(next: Map<string, IndexedAgent>, readAt: string): void {
  rows = next;
  at = readAt;
  version += 1;
}

export function putRegistryExtra(agent: IndexedAgent): void {
  const next = new Map(rows);
  next.set(agent.tokenId, agent);
  rows = next;
  version += 1;
}
