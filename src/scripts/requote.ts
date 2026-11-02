/**
 * Asks the sellers named for their escrow price now, whatever their turn, as
 * the scheduled job asks. Reads and A2A calls only: nothing is spent.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/requote.ts 374107 374112 401324
 */

import { refreshEscrowQuotes } from "@/lib/census/quotes";

const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
refreshEscrowQuotes({ budgetMs: 150_000, ...(only.length ? { only } : {}) }).then(
  (r) => {
    console.log(r);
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
