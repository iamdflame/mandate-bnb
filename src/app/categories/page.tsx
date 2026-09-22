import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import CategoryTile from "@/components/x/CategoryTile";
import AgentArtwork from "@/components/x/AgentArtwork";
import Status from "@/components/x/Status";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { listings, censusAge } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { applyQuery, categoryStats, EMPTY } from "@/lib/market/catalogue";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "Categories | MANDATE",
  description: "Rebalancing, grid trading, yield optimisation and health factor monitoring agents on BNB Smart Chain.",
};

export const revalidate = 300;
export const maxDuration = 60;

/**
 * The four jobs, side by side, each with the agents leading it right now.
 *
 * Equal depth is the point: the same counts, the same shelf, the same order
 * for every job. A job with few agents shows few agents rather than padding
 * itself out, because an honest thin shelf is more useful than a full fake one.
 */
export default async function CategoriesPage() {
  await live();
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled);
  const stats = categoryStats(all);
  const census = censusAge();

  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <div>
            <h1 className="x-mkt-head__h">Categories</h1>
            <p className="x-muted">Four jobs agents do on BNB Smart Chain. Pick the one that matches your problem.</p>
          </div>
          <p className="x-fresh">{census.at ? <Ago iso={census.at} prefix="Checked" /> : null}</p>
        </div>
      </section>

      <section className="x-wrap x-section--tight">
        <div className="x-cats4">
          {CATEGORIES.map((c) => (
            <CategoryTile key={c} category={c} s={stats[c]} />
          ))}
        </div>
      </section>

      {CATEGORIES.map((c) => {
        const lead = applyQuery(
          all.filter((l) => l.category === c),
          EMPTY,
        ).shown.slice(0, 6);
        return (
          <section key={c} className="x-wrap x-section--tight" aria-labelledby={`h-${c}`}>
            <div className="x-head">
              <div>
                <h2 id={`h-${c}`}>{CATEGORY_LABEL[c]}</h2>
                <p>
                  {stats[c].total} agents · {stats[c].live} reachable · {stats[c].hireable} hireable now
                </p>
              </div>
              <Link href={`/agents?category=${c}`} className="x-head__link">
                All {stats[c].total} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <ol className="x-table">
              {lead.map((l) => (
                <li key={l.tokenId}>
                  <Link href={`/agents/${l.tokenId}`} className="x-trow">
                    <span className="x-trow__art" aria-hidden="true">
                      <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} shape="square" />
                    </span>
                    <span className="x-trow__name">
                      <span>{l.name}</span>
                      <span className="x-trow__what">{l.what ?? "No description published."}</span>
                    </span>
                    <span className="x-trow__cell">
                      <Status liveness={l.liveness} />
                    </span>
                    <span className="x-trow__cell x-mono x-accent">{l.priceLabel ?? <span className="x-dim">No price</span>}</span>
                    <span className="x-trow__cell x-mono">{l.probe?.answered && l.probe.latencyMs != null ? `${l.probe.latencyMs} ms` : <span className="x-dim">no answer</span>}</span>
                    <span className="x-trow__cell x-mono">{l.checksPassed === null ? <span className="x-dim">unchecked</span> : `${l.checksPassed} checks`}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </AppShell>
  );
}
