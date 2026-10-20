/**
 * Who can fix what a wallet check found: for each job the wallet needs, the
 * agents a buyer could hire right now (the hire law's own set, best first),
 * in the market's card shape so /diagnose draws them with the one agent card.
 *
 * With design fixtures on (fixtures.ts) the same shapes come from a capture
 * of the production market; otherwise from the live listings.
 */
import type { Category } from "@/lib/config";
import { agentsFor } from "@/lib/diagnose/agents";
import { listings } from "@/lib/market/listing";
import { card, type MarketCard, type MarketSearch } from "@/lib/market/market-api";
import { fixture } from "./fixtures";

export interface FixersView {
  category: Category;
  /** Hireable now, best first, at most `per`. */
  hireable: MarketCard[];
  /** How many are hireable in all. */
  total: number;
  /** Answering in an agent protocol, hireable or not. */
  answering: number;
}

export function viewFixers(needed: Category[], counts: { byTokenId?: Map<string, number>; settled?: Parameters<typeof listings>[1]; delivery?: Parameters<typeof listings>[2] } | null, per = 3): FixersView[] {
  const f = fixture<{ data: MarketSearch }>("market-ready.json");
  if (f) {
    return needed.map((category) => {
      const all = f.data.agents.filter((a) => a.job === category && a.hireable);
      return { category, hireable: all.slice(0, per), total: all.length, answering: all.length };
    });
  }
  return agentsFor(needed, listings(counts?.byTokenId, counts?.settled, counts?.delivery), per).map((g) => ({
    category: g.category,
    hireable: g.hireable.map((l) => card(l)),
    total: g.total,
    answering: g.answering,
  }));
}
