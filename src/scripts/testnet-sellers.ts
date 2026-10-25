/**
 * Fills or refreshes the list of agents hireable on BNB Smart Chain testnet,
 * as the scheduled job does, with a longer budget.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/testnet-sellers.ts [--budget 600] [--rescan]
 */

import { refreshTestnetSellers, testnetListings } from "@/lib/testnet/sellers";

const i = process.argv.indexOf("--budget");
const budgetMs = (i > -1 ? Number(process.argv[i + 1]) : 600) * 1000;

refreshTestnetSellers({ budgetMs, rescan: process.argv.includes("--rescan") }).then(
  (r) => {
    console.log(r);
    for (const s of testnetListings()) {
      console.log(`#${s.tokenId.padStart(5)} ${s.name.slice(0, 32).padEnd(32)} ${s.category.padEnd(19)} ${s.ours ? "ours " : "     "}${s.hireable ? `hireable, ${Number(s.quote!.price) / 1e18} test $U` : s.why}`);
    }
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
