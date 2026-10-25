/**
 * Agents anyone can hire free on BNB Smart Chain testnet, every builder's,
 * with the price each last signed for the testnet kernel and why any cannot
 * be hired right now.
 *
 *   GET /api/v1/testnet/agents
 */

import { ok } from "@/lib/api/respond";
import { warm } from "@/lib/data/snapshots";
import { testnetListings, testnetSellers } from "@/lib/testnet/sellers";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  await warm(["testnet-sellers"]);
  const all = testnetListings();
  return ok(
    {
      network: "bsc-testnet",
      checkedAt: testnetSellers().at,
      hireable: all.filter((a) => a.hireable).length,
      agents: all.map((a) => ({
        tokenId: a.tokenId,
        name: a.name,
        what: a.what,
        job: a.category,
        ours: a.ours,
        mainnetTokenId: a.mainnetTokenId,
        hireable: a.hireable,
        whyNot: a.why,
        price: a.quote && a.hireable ? { amount: a.quote.price, token: "test $U", decimals: 18 } : null,
        pricedAt: a.quote?.at ?? null,
      })),
    },
    { chainId: 97, at: testnetSellers().at },
    { "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" },
  );
}
