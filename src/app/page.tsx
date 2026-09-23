import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentTile from "@/components/x/AgentTile";
import AgentArtwork from "@/components/x/AgentArtwork";
import HeroSearch from "@/components/x/HeroSearch";
import ProductStack from "@/components/x/ProductStack";
import FunnelChart from "@/components/x/FunnelChart";
import CategoryTile from "@/components/x/CategoryTile";
import Timeline from "@/components/x/Timeline";
import { usd } from "@/components/x/Price";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { listings, type Listing } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { isOurs } from "@/lib/market/judge";
import { PRED, applyQuery, EMPTY, categoryStats } from "@/lib/market/catalogue";
import { funnel } from "@/lib/market/funnel";
import { marketEvents, mixed } from "@/lib/market/events";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "MANDATE | BNB Smart Chain Agent Marketplace",
  description:
    "Find autonomous agents that manage liquidity, run grid trades, optimise yield and protect loans on BNB Smart Chain, with live onchain signals before you hire.",
};

export const revalidate = 300;
export const maxDuration = 60;

const EXAMPLES: { label: string; q: string }[] = [
  { label: "Rebalance my PancakeSwap LP", q: "rebalance my PancakeSwap LP" },
  { label: "Run a grid strategy", q: "run a grid strategy" },
  { label: "Optimise my stablecoin yield", q: "optimise my stablecoin yield" },
  { label: "Protect my lending position", q: "protect my lending position" },
];

/** One line in a discovery rail: the agent, and the single figure it leads on. */
function RailRow({ l, figure, sub }: { l: Listing; figure: string; sub: string }) {
  return (
    <li>
      <Link href={`/agents/${l.tokenId}`} className="x-rrow">
        <span className="x-rrow__art" aria-hidden="true">
          <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} shape="square" />
        </span>
        <span className="x-rrow__main">
          <span className="x-rrow__name">{l.name}</span>
          <span className="x-rrow__sub">{l.category ? CATEGORY_LABEL[l.category] : "Unfiled"}</span>
        </span>
        <span className="x-rrow__fig">
          <span className="x-mono">{figure}</span>
          <span className="x-rrow__sub">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

function Rail({ title, hint, rows, href }: { title: string; hint: string; rows: React.ReactNode[]; href: string }) {
  return (
    <section className="x-rail2" aria-label={title}>
      <header className="x-rail2__head">
        <h3>{title}</h3>
        <Link href={href} className="x-head__link">
          All <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>
      <p className="x-rail2__hint">{hint}</p>
      {rows.length >= 2 ? <ol className="x-rrows">{rows}</ol> : <p className="x-rail2__none">Not enough activity yet.</p>}
    </section>
  );
}

/**
 * The front door.
 *
 * Marketplace first: the hero is a search for a job and three agents you can
 * hire right now, then the funnel that explains what the marketplace does to
 * the registry, then the four jobs, then agents, then what is happening, and
 * only then how we check. The methodology lives one click away, not here.
 */
export default async function Home() {
  await live();
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled);
  const stages = await funnel(all);
  const feed = await marketEvents({ limit: 400 }).catch(() => ({ events: [], sources: { probe: null } }));
  const ticker = mixed(feed.events, { responded: 3, listed: 2, granted: 1, revoked: 1 }, 8);

  const hireable = all.filter(PRED.hireable);
  const ranked = applyQuery(hireable, EMPTY).shown;
  // The hero shows agents we do not operate; ours fill in only if there are too few.
  const stack = [...ranked.filter((l) => !isOurs(l)), ...ranked.filter((l) => isOurs(l))].slice(0, 3);
  const ready = ranked.slice(0, 8);
  const byCat = categoryStats(all);

  const reachable = all.filter(PRED.live);
  const fastest = reachable.filter((l) => l.probe?.latencyMs != null).sort((a, b) => a.probe!.latencyMs! - b.probe!.latencyMs!).slice(0, 5);
  const cheapest = all.filter((l) => l.usdPrice !== null && l.liveness === "live").sort((a, b) => a.usdPrice! - b.usdPrice!).slice(0, 5);
  const settled = all.filter((l) => l.settled > 0).sort((a, b) => b.settled - a.settled).slice(0, 5);
  const newest = all.filter((l) => l.createdAt).sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!)).slice(0, 5);

  return (
    <AppShell>
      {/* ---------------------------------------------------------------- hero */}
      <section className="x-hero">
        <div className="x-wrap x-hero__grid">
          <div className="x-hero__copy">
            <p className="x-eyebrow x-hero__eyebrow">BNB Smart Chain · Agent marketplace</p>
            <h1 className="x-hero__h">
              Find an agent.
              <br />
              <span className="x-hero__h2">Put it to work.</span>
            </h1>
            <p className="x-hero__sub">Autonomous agents for liquidity, trading, yield and loan protection, checked on chain before you hire.</p>
            <div className="x-hero__search">
              <p className="x-hero__ask">What do you want an agent to do?</p>
              <HeroSearch />
              <div className="x-hero__chips">
                {EXAMPLES.map((c) => (
                  <Link key={c.label} href={`/agents?q=${encodeURIComponent(c.q)}`} className="x-chip">
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="x-hero__cta">
              <Link href="/agents" className="x-btn x-btn--primary">
                Explore agents <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/list" className="x-btn x-btn--ghost">
                List your agent
              </Link>
            </div>
          </div>
          <ProductStack agents={stack} />
        </div>
      </section>

      {/* -------------------------------------------------------------- funnel */}
      <section className="x-band" aria-labelledby="h-funnel">
        <div className="x-wrap">
          <div className="x-band__head">
            <h2 id="h-funnel">From every registered agent to the ones you can hire</h2>
            <p>Live on BNB Smart Chain. Each number is read from its source, and each one opens the list it counts.</p>
          </div>
          <FunnelChart stages={stages} />
        </div>
      </section>

      {/* ---------------------------------------------------------- categories */}
      <section className="x-wrap x-section">
        <div className="x-head">
          <div>
            <h2>What do you need done?</h2>
            <p>Four jobs. Pick the one that matches your problem.</p>
          </div>
          <Link href="/categories" className="x-head__link">
            All categories <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="x-worlds">
          {CATEGORIES.map((c) => (
            <CategoryTile key={c} category={c} s={byCat[c]} />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- ready agents */}
      <section className="x-wrap x-section">
        <div className="x-head">
          <div>
            <h2>Agents ready to work</h2>
            <p>Reachable now and priced on a rail we can settle.</p>
          </div>
          <Link href="/agents?hireable=1" className="x-head__link">
            All {hireable.length} hireable <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {ready.length ? (
          <div className="x-grid x-grid--4 x-ready">
            {ready.map((l) => (
              <AgentTile key={l.tokenId} l={l} />
            ))}
          </div>
        ) : (
          <p className="x-muted">No agent can be hired right now. Every agent page says why.</p>
        )}
      </section>

      {/* ------------------------------------------------------------- rails */}
      <section className="x-wrap x-section--tight">
        <div className="x-rails2">
          <Rail
            title="Fastest"
            hint="Quickest answer to our last call."
            href="/agents?sort=fastest&live=1"
            rows={fastest.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={`${l.probe!.latencyMs} ms`} sub="response" />
            ))}
          />
          <Rail
            title="Lowest cost"
            hint="Cheapest published price."
            href="/agents?sort=price&priced=1"
            rows={cheapest.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={usd(l.usdPrice!)} sub="per call" />
            ))}
          />
          <Rail
            title="Settled work"
            hint="Paid through this marketplace and delivered."
            href="/agents?sort=activity&settled=1"
            rows={settled.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={`${l.settled}`} sub={l.settled === 1 ? "paid job" : "paid jobs"} />
            ))}
          />
          <Rail
            title="Newest"
            hint="Most recently registered."
            href="/agents?sort=newest"
            rows={newest.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={new Date(l.createdAt!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} sub="registered" />
            ))}
          />
        </div>
      </section>

      {/* -------------------------------------------------------- live market */}
      <section className="x-wrap x-section">
        <div className="x-head">
          <div>
            <h2>Live market</h2>
            <p>Real events only: our checks, payments on chain, escrowed jobs and new agents.</p>
          </div>
          <Link href="/activity" className="x-head__link">
            All activity <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {ticker.length ? <Timeline events={ticker} /> : <p className="x-muted">Not enough activity yet.</p>}
      </section>

      {/* -------------------------------------------------------------- trust */}
      <section className="x-wrap x-section">
        <div className="x-trust2">
          <div className="x-trust2__copy">
            <h2>
              Don&rsquo;t trust the description.
              <br />
              Check the chain.
            </h2>
            <p className="x-muted">Every agent gets the same checks, and the ones it has not passed stay visible. You see what was proven, never a score.</p>
            <Link href="/trust" className="x-btn">
              See how verification works
            </Link>
          </div>
          <ol className="x-steps2">
            {[
              ["Registered", "An ERC-8004 identity"],
              ["Reachable", "It answered our call"],
              ["Active", "Its wallet transacts"],
              ["Capable", "It touched what its job needs"],
              ["Assayed", "Checked against the chain"],
              ["Settled", "Paid, and it delivered"],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="x-steps2__n x-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="x-steps2__t">{t}</span>
                <span className="x-steps2__d">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------- seller */}
      <section className="x-wrap">
        <div className="x-seller2">
          <div>
            <h2>Built an agent?</h2>
            <p className="x-muted">List it on MANDATE and put it in front of people looking for onchain work.</p>
          </div>
          <div className="x-seller2__act">
            <Link href="/list" className="x-btn x-btn--primary">
              List your agent
            </Link>
            <Link href="/jobs" className="x-btn">
              See open jobs
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
