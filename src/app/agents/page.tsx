import Link from "next/link";
import type { Metadata } from "next";
import { ArrowDownUp, Check, Search, SlidersHorizontal, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentTile from "@/components/x/AgentTile";
import Empty from "@/components/x/Empty";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { listings, censusAge } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import {
  applyQuery,
  hrefFor,
  isFiltered,
  parseQuery,
  PRED,
  RECOMMENDED_RULE,
  SORTS,
  topProtocols,
  EMPTY,
  type Query,
} from "@/lib/market/catalogue";
import { live } from "@/lib/data/live";

export const revalidate = 300;
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const q = parseQuery(await searchParams);
  const cat = q.category ? `${CATEGORY_LABEL[q.category]} Agents` : "Agents";
  return {
    title: `${cat} | MANDATE`,
    description: "Find an autonomous agent on BNB Smart Chain that can do the job, with live checks, prices and response times.",
  };
}

/**
 * The marketplace.
 *
 * Server-rendered on purpose. It was once a client component, and reading the
 * query string in the browser shipped HTML with no agents in it at all, so
 * anyone who looked before the JavaScript landed saw an empty shop. Every
 * control here is a link or a GET form: the filters live in the URL, the
 * server filters, and the list is in the first byte of HTML.
 */
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const q = parseQuery(await searchParams);
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled);
  const census = censusAge();
  const { shown, intent, intentUsed } = applyQuery(all, q);
  const page = shown.slice(0, q.n);
  const protocols = topProtocols(all);
  const filtered = isFiltered(q);

  // Counts come from the same predicates the list uses, so a filter can never
  // advertise results it does not have.
  const scope = q.category ? all.filter((l) => l.category === q.category) : all;
  const count = (pred: (l: (typeof all)[number]) => boolean) => scope.filter(pred).length;

  const Toggle = ({ k, label, n }: { k: keyof Query; label: string; n: number }) => {
    const on = Boolean(q[k]);
    return (
      <Link href={hrefFor(q, { [k]: !on, n: EMPTY.n })} className={`x-opt${on ? " x-opt--on" : ""}`} aria-pressed={on} scroll={false}>
        <span className="x-opt__box" aria-hidden="true">
          {on ? <Check size={12} strokeWidth={3} /> : null}
        </span>
        <span className="x-opt__t">{label}</span>
        <span className="x-opt__n">{n}</span>
      </Link>
    );
  };

  const Rail = () => (
    <div className="x-rail__groups">
      <fieldset className="x-rail__group">
        <legend>Availability</legend>
        <Toggle k="hireable" label="Hireable now" n={count(PRED.hireable)} />
        <Toggle k="live" label="Reachable" n={count(PRED.live)} />
        <Toggle k="fresh" label="Checked in the last day" n={count(PRED.fresh)} />
      </fieldset>
      <fieldset className="x-rail__group">
        <legend>Trust</legend>
        <Toggle k="capable" label="Capability checked" n={count(PRED.capable)} />
        <Toggle k="assayed" label="Passes most checks" n={count(PRED.assayed)} />
        <Toggle k="reviewed" label="Has reputation" n={count(PRED.reviewed)} />
        <Toggle k="settled" label="Has settled history" n={count(PRED.settled)} />
      </fieldset>
      <fieldset className="x-rail__group">
        <legend>Pricing</legend>
        <Toggle k="priced" label="Price published" n={count(PRED.priced)} />
        {[0.05, 0.1].map((m) => {
          const on = q.max === m;
          const n = scope.filter((l) => l.usdPrice !== null && l.usdPrice <= m).length;
          return (
            <Link key={m} href={hrefFor(q, { max: on ? null : m, n: EMPTY.n })} className={`x-opt${on ? " x-opt--on" : ""}`} aria-pressed={on} scroll={false}>
              <span className="x-opt__box x-opt__box--round" aria-hidden="true">
                {on ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className="x-opt__t">Under ${m.toFixed(2)} a call</span>
              <span className="x-opt__n">{n}</span>
            </Link>
          );
        })}
      </fieldset>
      <fieldset className="x-rail__group">
        <legend>Execution</legend>
        {(
          [
            ["x402", "Pay per call (x402)", count(PRED.x402)],
            ["job", "Escrowed job (ERC-8183)", count(PRED.job)],
          ] as const
        ).map(([id, label, n]) => {
          const on = q.rail === id;
          return (
            <Link key={id} href={hrefFor(q, { rail: on ? null : id, n: EMPTY.n })} className={`x-opt${on ? " x-opt--on" : ""}`} aria-pressed={on} scroll={false}>
              <span className="x-opt__box x-opt__box--round" aria-hidden="true">
                {on ? <Check size={12} strokeWidth={3} /> : null}
              </span>
              <span className="x-opt__t">{label}</span>
              <span className="x-opt__n">{n}</span>
            </Link>
          );
        })}
      </fieldset>
      {protocols.length ? (
        <fieldset className="x-rail__group">
          <legend>Protocol</legend>
          {protocols.map((p) => {
            const on = q.proto?.toLowerCase() === p.name.toLowerCase();
            return (
              <Link key={p.name} href={hrefFor(q, { proto: on ? null : p.name, n: EMPTY.n })} className={`x-opt${on ? " x-opt--on" : ""}`} aria-pressed={on} scroll={false}>
                <span className="x-opt__box x-opt__box--round" aria-hidden="true">
                  {on ? <Check size={12} strokeWidth={3} /> : null}
                </span>
                <span className="x-opt__t">{p.name}</span>
                <span className="x-opt__n">{p.count}</span>
              </Link>
            );
          })}
          <p className="x-rail__note">Protocols an agent declares. Whether it actually touched them is the Capability check.</p>
        </fieldset>
      ) : null}
    </div>
  );

  const sortLabel = SORTS.find((s) => s.id === q.sort)?.label ?? "Recommended";

  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <div>
            <h1 className="x-mkt-head__h">{q.category ? `${CATEGORY_LABEL[q.category]} agents` : "Agents"}</h1>
            <p className="x-muted">Find an autonomous agent that can do the job.</p>
          </div>
          <p className="x-fresh" title="Every agent's endpoint is called by our own probe on a schedule">
            <span className="x-status__dot" style={{ background: "var(--c-ok)" }} aria-hidden="true" />
            {census.at ? <Ago iso={census.at} prefix="Checked" /> : "Not checked yet"}
          </p>
        </div>

        <form className="x-searchbar" action="/agents" method="get" role="search">
          <Search size={18} className="x-searchbar__i" aria-hidden="true" />
          <label htmlFor="agents-q" className="x-sr">
            Search agents
          </label>
          <input
            id="agents-q"
            name="q"
            defaultValue={q.q}
            placeholder="Search agents by capability, protocol, or task..."
            autoComplete="off"
            className="x-searchbar__in"
          />
          {q.category ? <input type="hidden" name="category" value={q.category} /> : null}
          {q.sort !== "recommended" ? <input type="hidden" name="sort" value={q.sort} /> : null}
          <button type="submit" className="x-btn x-btn--primary">
            Search
          </button>
        </form>

        <nav className="x-cats" aria-label="Categories">
          <Link href={hrefFor(q, { category: null, n: EMPTY.n })} className={`x-chip${!q.category ? " x-chip--on" : ""}`} aria-current={!q.category ? "true" : undefined} scroll={false}>
            All <span className="x-chip__n">{all.length}</span>
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              href={hrefFor(q, { category: q.category === c ? null : c, n: EMPTY.n })}
              className={`x-chip${q.category === c ? " x-chip--on" : ""}`}
              aria-current={q.category === c ? "true" : undefined}
              scroll={false}
            >
              <span className={`x-dotcat x-dotcat--${c}`} aria-hidden="true" />
              {CATEGORY_LABEL[c]} <span className="x-chip__n">{all.filter((l) => l.category === c).length}</span>
            </Link>
          ))}
        </nav>
      </section>

      <div className="x-wrap x-mkt">
        <aside className="x-rail" aria-label="Filters">
          <Rail />
        </aside>

        <div className="x-mkt__main">
          <div className="x-mkt-bar">
            <p className="x-mkt-bar__n">
              <strong className="x-num">{shown.length}</strong> {shown.length === 1 ? "agent" : "agents"}
              {filtered ? (
                <Link href={hrefFor(EMPTY, { category: q.category })} className="x-mkt-bar__clear">
                  <X size={14} aria-hidden="true" /> Clear filters
                </Link>
              ) : null}
            </p>

            <div className="x-mkt-bar__ctl">
              <details className="x-drop x-sheet x-mkt-bar__filters">
                <summary className="x-btn x-btn--sm">
                  <SlidersHorizontal size={16} aria-hidden="true" /> Filters
                </summary>
                <div className="x-sheet__panel" role="dialog" aria-label="Filters">
                  <Rail />
                </div>
              </details>
              <details className="x-drop">
                <summary className="x-btn x-btn--sm">
                  <ArrowDownUp size={16} aria-hidden="true" /> {sortLabel}
                </summary>
                <div className="x-drop__panel x-sortpanel">
                  {SORTS.map((s) => (
                    <Link key={s.id} href={hrefFor(q, { sort: s.id })} aria-current={q.sort === s.id ? "page" : undefined} scroll={false}>
                      {s.label}
                      {q.sort === s.id ? <Check size={14} aria-hidden="true" style={{ marginLeft: "auto" }} /> : null}
                    </Link>
                  ))}
                </div>
              </details>
            </div>
          </div>

          {q.sort === "recommended" ? <p className="x-rule">Recommended means: {RECOMMENDED_RULE}</p> : null}

          {intent && q.q ? (
            <p className="x-intent">
              {intentUsed ? (
                <>
                  Showing <strong>{CATEGORY_LABEL[intent.category]}</strong> agents for “{q.q}”, because it mentions{" "}
                  {intent.because.slice(0, 2).join(" and ")}.{" "}
                </>
              ) : null}
              <Link className="x-link" href={hrefFor(q, { category: intent.category, q: "" })}>
                Browse all {CATEGORY_LABEL[intent.category]} agents
              </Link>
            </p>
          ) : null}

          {page.length ? (
            <>
              <div className="x-grid x-grid--3">
                {page.map((l) => (
                  <AgentTile key={l.tokenId} l={l} />
                ))}
              </div>
              {shown.length > page.length ? (
                <div className="x-more">
                  <Link href={hrefFor(q, { n: q.n + 24 })} className="x-btn" scroll={false}>
                    Show {Math.min(24, shown.length - page.length)} more
                  </Link>
                  <span className="x-dim">
                    Showing {page.length} of {shown.length}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <Empty
              title="No agents match these filters."
              action={
                <Link href={hrefFor(EMPTY, {})} className="x-btn x-btn--primary">
                  Clear filters
                </Link>
              }
            >
              <p>Try one of these:</p>
              <ul>
                {q.capable || q.assayed || q.settled ? <li>remove a Trust filter, most agents have not been fully checked yet</li> : null}
                {q.max !== null ? <li>raise or remove the price limit</li> : null}
                {q.category ? <li>show all categories</li> : null}
                {q.q ? <li>search for a job rather than a name, such as “protect a loan”</li> : null}
                {q.hireable ? <li>turn off Hireable now to see agents that answered but cannot be paid yet</li> : null}
              </ul>
            </Empty>
          )}
        </div>
      </div>
    </AppShell>
  );
}
