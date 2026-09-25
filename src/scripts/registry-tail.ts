/**
 * Catch the catalogue up with the ERC-8004 registry, from a laptop.
 *
 *   npm run registry-tail              scan every mint since the crawl, then read every card
 *   npm run registry-tail -- --scan    only store the mints
 *   npm run registry-tail -- --resolve only read the cards still unread
 *
 * The site does the same in slices after each tick; this runs it in one
 * sitting against the same database, so the backlog clears in minutes.
 */

import { resolvePending, scanMints } from "@/lib/registry/tail";
import { closeDb } from "@/lib/db/client";

const onlyScan = process.argv.includes("--scan");
const onlyResolve = process.argv.includes("--resolve");

if (!onlyResolve) {
  for (;;) {
    const r = await scanMints({ budgetMs: 60_000, maxChunks: 40 });
    console.log(`  scanned to block ${r.cursor - 1} of ${r.head}: ${r.minted} mints stored`);
    if (r.cursor > r.head) break;
  }
}

if (!onlyScan) {
  for (;;) {
    const r = await resolvePending({ budgetMs: 90_000, limit: 600 });
    console.log(`  read ${r.resolved} cards, ${r.classified} filed under a job; ${r.left} still to read`);
    if (r.left === 0 || r.resolved === 0) break;
  }
}

await closeDb();
process.exit(0);
