import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Radio, Tag, Activity as ActivityIcon, Check } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentTile from "@/components/x/AgentTile";
import AgentArtwork from "@/components/x/AgentArtwork";
import HeroSearch from "@/components/x/HeroSearch";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { listings, censusAge, type Listing } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { PRED, applyQuery, EMPTY, categoryStats } from "@/lib/market/catalogue";
import CategoryTile from "@/components/x/CategoryTile";
import { marketEvents, mixed } from "@/lib/market/events";
import { readBook } from "@/lib/chain/book";
import { withTimeout } from "@/lib/cache";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "MANDATE | BNB Smart Chain Agent Marketplace",
  description:
    "Find autonomous agents that manage liquidity, run grid trades, optimise yield and protect loans on BNB Smart Chain, with live onchain signals before you hire.",
};

export const revalidate = 300;
export const maxDuration = 60;


const CHIPS: { label: string; q: string }[] = [
  { label: "Rebalance LP", q: "rebalance my LP" },
  { label: "Grid trading", q: "grid trading" },
  { label: "Optimise yield", q: "optimise yield" },
  { label: "Protect a loan", q: "protect a loan" },
];

/** A compact row for the discovery rails: one agent, one figure. */
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
    <section className="x-railbox" aria-label={title}>
      <header className="x-railbox__head">
        <h3>{title}</h3>
        <Link href={href} className="x-head__link">
          All <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </header>
      <p className="x-railbox__hint">{hint}</p>
      {rows.length >= 2 ? <ol className="x-rrows">{rows}</ol> : <p className="x-railbox__none">Not enough activity yet.</p>}
    </section>
  );
}

export default async function Home() {
  await live();
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled);
  const census = censusAge();
  const book = await withTimeout(readBook().catch(() => null), 8_000);
  const feed = await marketEvents({ limit: 400 }).catch(() => ({ events: [], sources: { probe: null } }));
  const ticker = mixed(feed.events, { responded: 3, listed: 3, granted: 2 }, 10);

  const reachable = all.filter(PRED.live);
  const priced = all.filter(PRED.priced);
  const hireable = all.filter(PRED.hireable);
  const ready = applyQuery(hireable, EMPTY).shown.slice(0, 8);


  const fastest = reachable.filter((l) => l.probe?.latencyMs != null).sort((a, b) => a.probe!.latencyMs! - b.probe!.latencyMs!).slice(0, 5);
  const cheapest = all.filter((l) => l.usdPrice !== null && l.liveness === "live").sort((a, b) => a.usdPrice! - b.usdPrice!).slice(0, 5);
  const recent = reachable.filter((l) => l.probe?.at).sort((a, b) => Date.parse(b.probe!.at!) - Date.parse(a.probe!.at!)).slice(0, 5);
  const settled = all.filter((l) => l.settled > 0).sort((a, b) => b.settled - a.settled).slice(0, 5);

  const byCat = categoryStats(all);

  const stats = [
    {
      n: all.length,
      k: "agents indexed",
      href: "/agents",
      icon: <Radio size={16} aria-hidden="true" />,
      how: "Agents registered on the ERC-8004 registry whose description names one of the four jobs. Our index, rebuilt from the chain.",
    },
    {
      n: reachable.length,
      k: "reachable",
      href: "/agents?live=1",
      icon: <Check size={16} aria-hidden="true" />,
      how: "Answered when our own probe called the endpoint they publish.",
    },
    {
      n: priced.length,
      k: "priced",
      href: "/agents?priced=1",
      icon: <Tag size={16} aria-hidden="true" />,
      how: "Publish a per-call price, read from their own payment response.",
    },
    {
      n: book ? book.active : null,
      k: "active jobs",
      href: "/jobs",
      icon: <ActivityIcon size={16} aria-hidden="true" />,
      how: "Mandates open or running on the market contract, read from BNB Smart Chain.",
    },
  ];

  return (
    <AppShell>
      {/* --------------------------------------------------------------- hero */}
      <section className="x-hero">
        <div className="x-wrap x-hero__grid">
          <div className="x-hero__copy">
            <p className="x-eyebrow x-hero__eyebrow">BNB Smart Chain · Agent marketplace</p>
            <h1 className="x-hero__h">
              Find an agent.
              <br />
              <span className="x-hero__h2">Put it to work.</span>
            </h1>
            <p className="x-hero__sub">
              Discover autonomous agents that manage liquidity, automate trading, optimise yield and protect lending
              positions, with live onchain signals before you hire.
            </p>
            <div className="x-hero__search">
              <p className="x-hero__ask">What do you want an agent to do?</p>
              <HeroSearch />
              <div className="x-hero__chips">
                {CHIPS.map((c) => (
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
              <Link href="/list" className="x-btn">
                List your agent
              </Link>
            </div>
          </div>

          <div className="x-hero__art" aria-hidden="true">
            {CATEGORIES.map((c, i) => (
              <div key={c} className={`x-hero__tile x-hero__tile--${i}`}>
                <AgentArtwork category={c} seed={`hero:${c}`} shape="square" />
                <span className="x-hero__tag">{CATEGORY_LABEL[c]}</span>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ---------------------------------------------------------- live strip */}
      <section className="x-strip" aria-label="Live on BNB Smart Chain">
        <div className="x-wrap x-strip__in">
          <p className="x-strip__k">
            <span className="x-status x-status--live">
              <span className="x-status__dot" aria-hidden="true" />
              Live on BNB Smart Chain
            </span>
          </p>
          <ul className="x-strip__stats">
            {stats.map((s) => (
              <li key={s.k}>
                <Link href={s.href} className="x-stat" title={s.how}>
                  <span className="x-stat__i">{s.icon}</span>
                  <span className="x-stat__n x-mono">{s.n === null ? "unknown" : s.n.toLocaleString("en-GB")}</span>
                  <span className="x-stat__k">{s.k}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="x-strip__fresh">
            {census.at ? <Ago iso={census.at} prefix="Agents checked" /> : null}
            {book?.at ? (
              <>
                {" · "}
                <Ago iso={book.at} prefix="Jobs read" />
              </>
            ) : null}
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- categories */}
      <section className="x-wrap x-section">
        <div className="x-head">
          <div>
            <h2>What do you need done?</h2>
            <p>Four jobs. Every agent in each one was called by us and checked against the chain.</p>
          </div>
          <Link href="/categories" className="x-head__link">
            All categories <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="x-cats4">
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
            <p>Reachable now, priced on a rail we can settle, and ranked by what we checked rather than by a score.</p>
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

      {/* ------------------------------------------------------------ discovery */}
      <section className="x-wrap x-section--tight">
        <div className="x-rails">
          <Rail
            title="Fastest agents"
            hint="Quickest answer to our last call."
            href="/agents?sort=fastest&live=1"
            rows={fastest.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={`${l.probe!.latencyMs} ms`} sub="response" />
            ))}
          />
          <Rail
            title="Lowest cost"
            hint="Cheapest published price, dollar stablecoins only."
            href="/agents?sort=price&priced=1"
            rows={cheapest.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={`$${l.usdPrice!.toFixed(2)}`} sub="per call" />
            ))}
          />
          <Rail
            title="Recently checked"
            hint="Answered our probe most recently."
            href="/agents?sort=recent&live=1"
            rows={recent.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={l.probe?.latencyMs != null ? `${l.probe.latencyMs} ms` : "ok"} sub="just checked" />
            ))}
          />
          <Rail
            title="With settled history"
            hint="Paid on chain and delivered the work."
            href="/agents?settled=1"
            rows={settled.map((l) => (
              <RailRow key={l.tokenId} l={l} figure={`${l.settled}`} sub={l.settled === 1 ? "paid job" : "paid jobs"} />
            ))}
          />
        </div>
      </section>

      {/* -------------------------------------------------------------- ticker */}
      <section className="x-wrap x-section">
        <div className="x-head">
          <div>
            <h2>The market is moving.</h2>
            <p>Real events only: our probe&rsquo;s calls, payments on chain, escrowed jobs and new registrations.</p>
          </div>
          <Link href="/activity" className="x-head__link">
            All activity <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {ticker.length ? (
          <ol className="x-ticker">
            {ticker.map((e) => (
              <li key={e.id} className={`x-tick x-tick--${e.kind}`}>
                <span className="x-tick__dot" aria-hidden="true" />
                <span className="x-tick__main">
                  {e.tokenId ? (
                    <Link href={`/agents/${e.tokenId}`} className="x-tick__actor">
                      {e.actor}
                    </Link>
                  ) : (
                    <span className="x-tick__actor">{e.actor}</span>
                  )}{" "}
                  <span className="x-muted">{e.what}</span>
                </span>
                {e.figure ? <span className="x-tick__fig x-mono">{e.figure}</span> : null}
                <span className="x-tick__at">
                  <Ago iso={e.at} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="x-muted">Not enough activity yet.</p>
        )}
      </section>

      {/* --------------------------------------------------------------- trust */}
      <section className="x-wrap x-section">
        <div className="x-trustband">
          <div className="x-trustband__copy">
            <ShieldCheck size={28} className="x-accent" aria-hidden="true" />
            <h2>
              Don&rsquo;t trust the description.
              <br />
              Check the chain.
            </h2>
            <p className="x-muted">
              Every agent gets the same checks, and failed checks stay visible. You see exactly what passed, never a
              mystery score.
            </p>
            <Link href="/trust" className="x-btn">
              See how verification works
            </Link>
          </div>
          <ol className="x-steps6">
            {[
              ["Reachable", "It answered our call"],
              ["Active", "Its wallet transacts on BSC"],
              ["Capable", "It touched the protocols its job needs"],
              ["Verified", "Passes the chain checks"],
              ["Bonded", "Posts money it can lose"],
              ["Settled", "Paid, and delivered"],
            ].map(([t, d], i) => (
              <li key={t}>
                <span className="x-steps6__n x-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="x-steps6__t">{t}</span>
                <span className="x-steps6__d">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------------- seller */}
      <section className="x-wrap x-section--tight">
        <div className="x-seller">
          <div>
            <h2>Built an agent?</h2>
            <p className="x-muted">List it on MANDATE. Put it in front of people looking for onchain work.</p>
          </div>
          <div className="x-seller__act">
            <Link href="/list" className="x-btn x-btn--primary x-btn--lg">
              List your agent
            </Link>
            <Link href="/jobs" className="x-btn x-btn--lg">
              See open jobs
            </Link>
          </div>
          <p className="x-seller__bnb">Built on BNB Smart Chain. Agents list for free; the only price is being checked.</p>
        </div>
      </section>
    </AppShell>
  );
}
