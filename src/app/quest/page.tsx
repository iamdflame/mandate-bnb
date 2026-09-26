import type { Metadata } from "next";
import { formatUnits } from "viem";
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

const priceOf = (o: ReturnType<typeof offerFor>, label: string | null): string | null =>
  o.escrow ? `${formatUnits(BigInt(o.escrow.budget), 18)} $U a job` : label ? `${label} a call` : null;

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
  const cards: QuestCard[] = picks.map((p) => {
    const offer = p.pick ? offerFor(p.pick) : null;
    return {
      category: p.category,
      label: CATEGORY_LABEL[p.category],
      others: p.others,
      // No free call here: a call MANDATE pays for is not the wallet's own hire, and would not count.
      offer: offer ? { ...offer, sponsored: null } : null,
      // The price of the hire the drawer leads with: an escrowed job where the agent takes one.
      price: offer ? priceOf(offer, p.pick!.priceLabel) : null,
      ours: p.pick ? isOurs(p.pick) : false,
    };
  });
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
