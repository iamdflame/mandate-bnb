/**
 * The agents that take jobs with capital (MandateMarket), in the market's
 * card shape, so /jobs draws them with the one agent card. With design
 * fixtures on (fixtures.ts) they come from a capture of the production
 * market; otherwise from the live listings, filtered and ordered as before.
 */
import { applyQuery, EMPTY, PRED } from "@/lib/market/catalogue";
import { listings } from "@/lib/market/listing";
import { card, type MarketCard, type MarketSearch } from "@/lib/market/market-api";
import { fixture } from "./fixtures";

export function viewTakers(counts: { byTokenId?: Map<string, number>; settled?: Parameters<typeof listings>[1]; delivery?: Parameters<typeof listings>[2] }, limit = 8): MarketCard[] {
  const f = fixture<{ data: MarketSearch }>("market-all.json");
  if (f) return f.data.agents.filter((a) => a.how.includes("mandate")).slice(0, limit);
  return applyQuery(listings(counts.byTokenId, counts.settled, counts.delivery).filter(PRED.job), EMPTY)
    .shown.slice(0, limit)
    .map((l) => card(l));
}
