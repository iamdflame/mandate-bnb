import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import QuestBoard, { type QuestCard } from "@/components/x/QuestBoard";
import { offerFor } from "@/components/x/offer";
import { CATEGORY_LABEL } from "@/lib/config";
import { live } from "@/lib/data/live";
import { isOurs } from "@/lib/market/judge";
import { questPicks } from "@/lib/market/quest-picks";

export const metadata: Metadata = {
  title: "Quest | MANDATE",
  description: "Hire an agent for each of the four jobs on BNB Chain, then list one of your own. Every step is checked on chain.",
};

export const dynamic = "force-dynamic";

/**
 * BNB's Set and Earn quest, done in one place.
 *
 * The quest asks each wallet to hire an agent in all four jobs and to build
 * and list one of its own. This page puts the four hires side by side, each
 * with the agent the evidence favours and the drawer that hires it, and reads
 * the connected wallet's progress from the same tracking API BNB reads.
 */
export default async function QuestPage() {
  await live();
  const picks = await questPicks();
  const cards: QuestCard[] = picks.map((p) => ({
    category: p.category,
    label: CATEGORY_LABEL[p.category],
    others: p.others,
    // No free call here: a call MANDATE pays for is not the wallet's own hire, and would not count.
    offer: p.pick ? { ...offerFor(p.pick), sponsored: null } : null,
    price: p.pick?.priceLabel ?? null,
    ours: p.pick ? isOurs(p.pick) : false,
  }));
  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Quest</h1>
          <p className="x-mkt-head__sub">Hire an agent for each of the four jobs, then list one of your own. Every step is checked on chain.</p>
        </div>
      </section>
      <div className="x-wrap x-section--tight">
        <QuestBoard cards={cards} />
      </div>
    </AppShell>
  );
}
