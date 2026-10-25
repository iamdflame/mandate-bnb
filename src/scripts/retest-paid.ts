/**
 * One paid test purchase now for the sellers named, from the trial pool, as
 * the daily job makes it (0.10 a call, 1.00 a day, recorded against the hire
 * law the same way). For a builder who fixed a failed paid call and asked to
 * be checked again.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/retest-paid.ts 382582
 */

import { testBuys } from "@/lib/market/test-buys";
import { warm } from "@/lib/data/snapshots";
import { warmRegistry } from "@/lib/registry/tail";

const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (!ids.length) {
  console.error("Name at least one token id.");
  process.exit(1);
}

(async () => {
  await Promise.all([warm(), warmRegistry()]);
  console.log(await testBuys({ budgetMs: 90_000, only: ids }));
  process.exit(0);
})();
