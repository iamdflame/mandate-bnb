import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownUp, Check, HelpCircle, Search, SlidersHorizontal, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentCard from "@/components/k/AgentCard";
import Agent from "@/components/characters/Agent";
import Empty from "@/components/x/Empty";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { listings, censusAge } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { card, type MarketCard } from "@/lib/market/market-api";
import {
  applyQuery,
  hrefFor,
  parseQuery,
  PRED,
  RECOMMENDED_RULE,
  SORTS,
  topProtocols,
  EMPTY,
  VIEWS,
  type Query,
  type View,
} from "@/lib/market/catalogue";
import { live } from "@/lib/data/live";
import { fixtureDir } from "@/lib/view/fixtures";
import { viewJobs, viewMarket } from "@/lib/view/market";
import { viewHome } from "@/lib/view/home";

export const revalidate = 300;
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = parseQuery(sp);
  const cat = q.category ? `${CATEGORY_LABEL[q.category]} Agents` : "Agents";
  /*
    Every filter here is a link, so the combinations are endless, and crawlers
    walked them: on 19 Oct 475 of 500 sampled requests were /agents with a
    different mix of a dozen filters, each a full render, most of the site's
    Vercel bill. Only the marketplace and its four job pages are indexed; every
    other view says noindex and points at the job page it narrows.
  */
  const plain = Object.keys(sp).every((k) => k === "category");
  return {
    title: `${cat} | MANDATE`,
    description: "Find an autonomous agent on BNB Smart Chain that can do the job, with live checks, prices and response times.",
    alternates: { canonical: q.category ? `/agents?category=${q.category}` : "/agents" },
    ...(plain ? {} : { robots: { index: false, follow: false } }),
  };
}

/** Each job's founder, and the job in the words a person would use. */
const JOB: Record<Category, { seed: string; line: string }> = {
  rebalancing: { seed: "344119", line: "Keeps a PancakeSwap position in range, so it keeps earning." },
  "grid-trading": { seed: "344121", line: "Buys a little lower and sells a little higher, level by level." },
  "yield-optimisation": { seed: "344122", line: "Moves idle stablecoins to where the rate is, credited to you." },
  "health-factor": { seed: "344123", line: "Repays a little of your Venus loan before it can be liquidated." },
};

const VIEW_LINE: Record<View, string> = {
  ready: "Every one answered our call in the last day and has a price we can pay.",
  free: "Each one shows you a real answer before you pay anything.",
  checked: "Each one's answer matched our own reading of the chain, field by field.",
  all: "Every agent listed under the four jobs, including the ones that cannot be hired right now, with the reason.",
};

/**
 * The marketplace.
 *
 * Server-rendered on purpose. It was once a client component, and reading the
 * query string in the browser shipped HTML with no agents in it at all, so
 * anyone who looked before the JavaScript landed saw an empty shop. Every
 * control here is a link or a GET form: the filters live in the URL, the
 * server filters, and the list is in the first byte of HTML. Each agent is
 * shown with its face, its words, its price and when it last answered.
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const sp = await searchParams;
  const q = parseQuery(sp);
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled, hc.delivery);
  let census = censusAge();
  const { shown, intent, intentUsed } = applyQuery(all, q);
  const protocols = topProtocols(all);

  // The cards: the public card shape, from the same listings the filters run on.
  // With design fixtures on (dev only) and no local market, a captured market stands in.
  let cards: MarketCard[] = shown.slice(0, q.n).map((l) => card(l));
  let total = shown.length;
  let listed = all.length;
  let byCat = (c: Category) => all.filter((l) => l.category === c).length;
  let readyIn = (c: Category) => all.filter((l) => l.category === c && PRED.hireable(l)).length;
  if (fixtureDir()) {
    const [m, jobs] = await Promise.all([viewMarket({ view: q.view, job: q.category ?? undefined, q: q.q || undefined, limit: q.n }), viewJobs()]);
    const h = await viewHome();
    census = { at: h.censusMinutes === null ? null : new Date(Date.now() - h.censusMinutes * 60000).toISOString(), minutes: h.censusMinutes, stale: false };
    cards = m.agents;
    total = m.matched;
    listed = m.listed;
    byCat = (c: Category) => jobs.find((j) => j.job === c)?.listed ?? 0;
    readyIn = (c: Category) => jobs.find((j) => j.job === c)?.ready ?? 0;
  }

  // Every active filter as a pill that removes itself, like a shop's.
  const pills: { label: string; href: string }[] = [
    ...(q.q ? [{ label: `“${q.q}”`, href: hrefFor(q, { q: "", n: EMPTY.n }) }] : []),
    ...(q.live ? [{ label: "Answers as an agent", href: hrefFor(q, { live: false }) }] : []),
    ...(q.fresh ? [{ label: "Checked in the last day", href: hrefFor(q, { fresh: false }) }] : []),
    ...(q.unique ? [{ label: "One per product", href: hrefFor(q, { unique: false }) }] : []),
    ...(q.checked ? [{ label: "Passed MANDATE checks", href: hrefFor(q, { checked: false }) }] : []),
    ...(q.capable ? [{ label: "Capability checked", href: hrefFor(q, { capable: false }) }] : []),
    ...(q.assayed ? [{ label: "Passes most checks", href: hrefFor(q, { assayed: false }) }] : []),
    ...(q.reviewed ? [{ label: "Has reputation", href: hrefFor(q, { reviewed: false }) }] : []),
    ...(q.settled ? [{ label: "Has settled history", href: hrefFor(q, { settled: false }) }] : []),
    ...(q.priced ? [{ label: "Price published", href: hrefFor(q, { priced: false }) }] : []),
    ...(q.max !== null ? [{ label: `Under $${q.max.toFixed(2)}`, href: hrefFor(q, { max: null }) }] : []),
    ...(q.rail ? [{ label: q.rail === "x402" ? "Pay per answer" : "Escrowed job", href: hrefFor(q, { rail: null }) }] : []),
    ...(q.proto ? [{ label: q.proto, href: hrefFor(q, { proto: null }) }] : []),
  ];

  // Counts come from the same predicates the list uses, so a filter can never
  // advertise results it does not have.
  const scope = q.category ? all.filter((l) => l.category === q.category) : all;
  const count = (pred: (l: (typeof all)[number]) => boolean) => scope.filter(pred).length;
  const tabCount: Record<View, number> = { ready: count(PRED.hireable), free: count(PRED.tryFree), checked: count(PRED.checked), all: scope.length };

  const Toggle = ({ k, label, n }: { k: keyof Query; label: string; n: number }) => {
    const on = Boolean(q[k]);
    return (
      <Link rel="nofollow" prefetch={false} href={hrefFor(q, { [k]: !on, n: EMPTY.n })} className="mk-opt" aria-pressed={on} scroll={false}>
        <span className="mk-opt__box" aria-hidden="true">
          {on ? <Check size={12} strokeWidth={3} /> : null}
        </span>
        <span className="mk-opt__t">{label}</span>
        <span className="mk-opt__n k-num">{n}</span>
      </Link>
    );
  };

  const Radio = ({ on, href, label, n }: { on: boolean; href: string; label: string; n: number }) => (
    <Link rel="nofollow" prefetch={false} href={href} className="mk-opt mk-opt--radio" aria-pressed={on} scroll={false}>
      <span className="mk-opt__box" aria-hidden="true">
        {on ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="mk-opt__t">{label}</span>
      <span className="mk-opt__n k-num">{n}</span>
    </Link>
  );

  const Filters = () => (
    <div className="mk-groups">
      <fieldset className="mk-group">
        <legend>Availability</legend>
        <Toggle k="live" label="Answers as an agent" n={count(PRED.live)} />
        <Toggle k="fresh" label="Checked in the last day" n={count(PRED.fresh)} />
        <Toggle k="unique" label="One per product" n={count(PRED.unique)} />
      </fieldset>
      <fieldset className="mk-group">
        <legend>Trust</legend>
        <Toggle k="checked" label="Passed MANDATE checks" n={count(PRED.checked)} />
        <Toggle k="capable" label="Capability checked" n={count(PRED.capable)} />
        <Toggle k="assayed" label="Passes most checks" n={count(PRED.assayed)} />
        <Toggle k="reviewed" label="Has reputation" n={count(PRED.reviewed)} />
        <Toggle k="settled" label="Has settled history" n={count(PRED.settled)} />
      </fieldset>
      <fieldset className="mk-group">
        <legend>Price</legend>
        <Toggle k="priced" label="Price published" n={count(PRED.priced)} />
        {[0.05, 0.1].map((m) => (
          <Radio key={m} on={q.max === m} href={hrefFor(q, { max: q.max === m ? null : m, n: EMPTY.n })} label={`Under $${m.toFixed(2)} a call`} n={scope.filter((l) => l.usdPrice !== null && l.usdPrice <= m).length} />
        ))}
      </fieldset>
      <fieldset className="mk-group">
        <legend>How you pay</legend>
        <Radio on={q.rail === "x402"} href={hrefFor(q, { rail: q.rail === "x402" ? null : "x402", n: EMPTY.n })} label="Per answer (x402)" n={count(PRED.x402)} />
        <Radio on={q.rail === "job"} href={hrefFor(q, { rail: q.rail === "job" ? null : "job", n: EMPTY.n })} label="Escrowed job (ERC-8183)" n={count(PRED.job)} />
      </fieldset>
      {protocols.length ? (
        <fieldset className="mk-group">
          <legend>Protocol</legend>
          {protocols.map((p) => {
            const on = q.proto?.toLowerCase() === p.name.toLowerCase();
            return <Radio key={p.name} on={on} href={hrefFor(q, { proto: on ? null : p.name, n: EMPTY.n })} label={p.name} n={p.count} />;
          })}
          <p className="k-small">Protocols an agent declares. Whether it actually touched them is the Capability check.</p>
        </fieldset>
      ) : null}
    </div>
  );

  const sortLabel = SORTS.find((s) => s.id === q.sort)?.label ?? "Recommended";
  const cat = q.category;

  return (
    <AppShell>
      <header className={`mk-head${cat ? " mk-head--job" : ""}`} data-job={cat ?? undefined}>
        <div className="k-wrap mk-head__in">
          <div className="mk-head__copy">
            {cat ? (
              <nav className="k-crumbs" aria-label="Breadcrumb">
                <Link href="/agents">Agents</Link>
                <span aria-current="page">{CATEGORY_LABEL[cat]}</span>
              </nav>
            ) : null}
            <h1 className="k-display k-rise" style={{ ["--i" as string]: 0 }}>
              {cat ? CATEGORY_LABEL[cat] : "Hire an agent"}
            </h1>
            <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
              {cat ? JOB[cat].line : "Four jobs on BNB Chain. Pick one, or tell us what you need done."}
            </p>
            <p className="k-src k-rise" style={{ ["--i" as string]: 2 }}>
              <span className={`k-dot ${census.stale ? "" : "k-dot--live"}`} aria-hidden="true" />
              {census.at ? <Ago iso={census.at} prefix="We called every agent" /> : "Our census has not run on this server yet"}
            </p>
          </div>
          {cat ? (
            <div className="mk-head__art" aria-hidden="true">
              <Agent job={cat} seed={JOB[cat].seed} house size={190} state="working" slot="mkhead" />
            </div>
          ) : null}
        </div>

        {/* The four jobs as doors; the one you are in stays lit. */}
        <nav className="k-wrap mk-doors" aria-label="Jobs">
          <Link href={hrefFor(q, { category: null, n: EMPTY.n })} className="mk-door mk-door--all" aria-current={!cat ? "page" : undefined} scroll={false}>
            <span className="mk-door__faces" aria-hidden="true">
              {CATEGORIES.map((c) => (
                <Agent key={c} job={c} seed={JOB[c].seed} house size={26} state="ready" slot={`all${c}`} />
              ))}
            </span>
            <span className="mk-door__t">All jobs</span>
            <span className="mk-door__n k-num">{listed.toLocaleString("en-US")} listed</span>
          </Link>
          {CATEGORIES.map((c) => (
            <Link key={c} href={hrefFor(q, { category: cat === c ? null : c, n: EMPTY.n })} className="mk-door" data-job={c} aria-current={cat === c ? "page" : undefined} scroll={false}>
              <Agent job={c} seed={JOB[c].seed} house size={44} state={cat === c ? "awake" : "ready"} slot={`door${c}`} />
              <span className="mk-door__t">{CATEGORY_LABEL[c]}</span>
              <span className="mk-door__n k-num">
                {readyIn(c)} ready of {byCat(c)}
              </span>
            </Link>
          ))}
        </nav>
      </header>

      <div className="k-wrap mk-body">
        <div className="mk-controls">
          <form className="k-field mk-search" action="/agents" method="get" role="search">
            <Search size={18} aria-hidden="true" />
            <label htmlFor="agents-q" className="k-sr">
              Search agents
            </label>
            <input id="agents-q" name="q" defaultValue={q.q} placeholder="Search by job, protocol or name" autoComplete="off" />
            {cat ? <input type="hidden" name="category" value={cat} /> : null}
            {q.sort !== "recommended" ? <input type="hidden" name="sort" value={q.sort} /> : null}
            <button type="submit" className="k-btn">
              Search
            </button>
          </form>

          <div className="mk-bar">
            <nav className="k-tabs" aria-label="Which agents">
              {VIEWS.map((v) => (
                <Link key={v.id} rel="nofollow" prefetch={false} href={hrefFor(q, { view: v.id, n: EMPTY.n })} className="k-tab" aria-current={q.view === v.id ? "page" : undefined} scroll={false}>
                  {v.short}
                  <span className="k-tab__n">{(fixtureDir() ? (v.id === q.view ? total : "") : tabCount[v.id]).toLocaleString("en-US")}</span>
                </Link>
              ))}
            </nav>
            <div className="mk-bar__ctl">
              <details className="mk-pop mk-pop--sheet">
                <summary className="k-btn k-btn--sm">
                  <SlidersHorizontal size={16} aria-hidden="true" /> Filters{pills.length ? ` (${pills.length})` : ""}
                </summary>
                <div className="mk-pop__panel mk-filters" role="dialog" aria-label="Filters">
                  <Filters />
                </div>
              </details>
              <details className="mk-pop">
                <summary className="k-btn k-btn--sm">
                  <ArrowDownUp size={16} aria-hidden="true" /> {sortLabel}
                </summary>
                <div className="mk-pop__panel mk-sorts">
                  {SORTS.map((s) => (
                    <Link rel="nofollow" prefetch={false} key={s.id} href={hrefFor(q, { sort: s.id })} aria-current={q.sort === s.id ? "page" : undefined} scroll={false} className="mk-sort">
                      <span className="mk-sort__t">{s.label}</span>
                      <span className="mk-sort__d">{s.how}</span>
                      {q.sort === s.id ? <Check size={14} aria-hidden="true" className="mk-sort__on" /> : null}
                    </Link>
                  ))}
                </div>
              </details>
              <details className="mk-pop mk-why">
                <summary className="k-btn k-btn--sm k-btn--ghost" aria-label="Why this order?">
                  <HelpCircle size={16} aria-hidden="true" />
                  <span className="mk-why__t">Why this order?</span>
                </summary>
                <p className="mk-pop__panel mk-why__p">{q.sort === "recommended" ? RECOMMENDED_RULE : SORTS.find((x) => x.id === q.sort)?.how}</p>
              </details>
            </div>
          </div>
        </div>

        <div className="mk-summary">
          <p className="mk-summary__n">
            <strong className="k-num">{total.toLocaleString("en-US")}</strong> {total === 1 ? "agent" : "agents"}
            {q.view === "ready" ? " you can hire now" : q.view === "free" ? " you can try before paying" : q.view === "checked" ? " whose answers matched the chain" : ""}
          </p>
          <p className="k-small">{VIEW_LINE[q.view]}</p>
        </div>

        {pills.length ? (
          <ul className="mk-pills" aria-label="Active filters">
            {pills.map((p) => (
              <li key={p.label}>
                <Link rel="nofollow" prefetch={false} href={p.href} className="k-chip k-chip--on" scroll={false} aria-label={`Remove ${p.label}`}>
                  {p.label}
                  <X size={13} aria-hidden="true" />
                </Link>
              </li>
            ))}
            <li>
              <Link rel="nofollow" prefetch={false} href={hrefFor(EMPTY, { category: q.category, sort: q.sort, view: q.view })} className="k-btn k-btn--sm k-btn--ghost" scroll={false}>
                Clear all
              </Link>
            </li>
          </ul>
        ) : null}

        {intent && q.q ? (
          <p className="k-note mk-intent">
            <span>
              {intentUsed ? (
                <>
                  Showing <strong>{CATEGORY_LABEL[intent.category]}</strong> agents for “{q.q}”, because it mentions {intent.because.slice(0, 2).join(" and ")}.{" "}
                </>
              ) : null}
              <Link className="k-link" href={hrefFor(q, { category: intent.category, q: "" })}>
                Browse all {CATEGORY_LABEL[intent.category]} agents
              </Link>
            </span>
          </p>
        ) : null}

        {cat === "rebalancing" ? (
          <p className="k-small mk-aside">
            Where PancakeSwap V3 liquidity is thinnest against the demand crossing it, measured from the chain:{" "}
            <Link className="k-link" href="/pool-gaps">
              Pool gaps
            </Link>
            .
          </p>
        ) : null}

        {cards.length ? (
          <>
            <ul className="mk-grid">
              {cards.map((a, i) => (
                <li key={a.tokenId} className="k-rise" style={{ ["--i" as string]: Math.min(i, 12) }}>
                  <AgentCard a={a} />
                </li>
              ))}
            </ul>
            {total > cards.length ? (
              <div className="mk-more">
                <Link rel="nofollow" prefetch={false} href={hrefFor(q, { n: q.n + 24 })} className="k-btn" scroll={false}>
                  Show {Math.min(24, total - cards.length)} more
                </Link>
                <span className="k-small">
                  Showing {cards.length} of {total}
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <Empty
            title="No agents match these filters."
            job={cat ?? "rebalancing"}
            action={
              <Link href={hrefFor({ ...EMPTY, view: "ready" }, {})} className="k-btn k-btn--primary">
                Clear filters
              </Link>
            }
          >
            <ul className="mk-tries">
              {q.view !== "all" ? (
                <li>
                  <Link rel="nofollow" prefetch={false} className="k-link" href={hrefFor(q, { view: "all", n: EMPTY.n })} scroll={false}>
                    Look at all agents
                  </Link>
                  , including those that cannot be hired right now.
                </li>
              ) : null}
              {q.checked || q.capable || q.assayed || q.settled ? <li>Remove a Trust filter: most agents have not been fully checked yet.</li> : null}
              {q.max !== null ? <li>Raise or remove the price limit.</li> : null}
              {q.category ? <li>Show all jobs.</li> : null}
              {q.q ? <li>Search for a job rather than a name, such as “protect a loan”.</li> : null}
            </ul>
          </Empty>
        )}
      </div>
    </AppShell>
  );
}
