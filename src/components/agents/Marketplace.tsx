"use client";

/**
 * The marketplace.
 *
 * This is the front door the brief asks for: land, find an agent by category,
 * put it to work. An earlier version made the capital market the homepage,
 * which meant a visitor looking for agents found three mandates and two
 * anonymous wallets instead.
 *
 * The four categories are surfaced at equal depth by construction — each is a
 * section with the same controls and the same columns — and every agent is
 * shown with the evidence behind its classification rather than a bare label.
 */

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_BLURB, CATEGORY_LABEL, RUNG_NAMES, type Category } from "@/lib/config";
import type { AgentIndex, IndexedAgent } from "@/lib/data/agents";

const PAGE = 12;

export default function Marketplace({
  index,
  initialCategory = "all",
  initialRung = "all",
}: {
  index: AgentIndex;
  initialCategory?: Category | "all";
  initialRung?: number | "all";
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Category | "all">(initialCategory);
  const [rung, setRung] = useState<number | "all">(initialRung);
  const [shown, setShown] = useState<Record<string, number>>({});

  const needle = query.trim();
  const [matched, setMatched] = useState<IndexedAgent[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Searches the whole index server-side, debounced. The page only holds the
  // classified agents it renders.
  useEffect(() => {
    if (needle.length < 2) {
      setMatched(null);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agents/search?q=${encodeURIComponent(needle)}`);
        const json = (await res.json()) as { agents: IndexedAgent[] };
        setMatched(json.agents);
      } catch {
        setMatched([]);
      } finally {
        setSearching(false);
      }
    }, 260);
    return () => clearTimeout(t);
  }, [needle]);

  // Rung filters before category, because the ladder is the organising idea:
  // "show me everything on rung 2" is a more useful question than any
  // category slice of a population nobody has verified.
  const pool = useMemo(
    () => (rung === "all" ? index.agents : index.agents.filter((a) => (a.rung ?? 0) === rung)),
    [index.agents, rung],
  );

  const rungCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of index.agents) counts.set(a.rung ?? 0, (counts.get(a.rung ?? 0) ?? 0) + 1);
    return counts;
  }, [index.agents]);

  const byCategory = useMemo(() => {
    const map = {} as Record<Category, IndexedAgent[]>;
    for (const c of CATEGORIES) {
      map[c] = pool
        .filter((a) => a.category === c)
        .sort(
          (a, b) =>
            b.confidence - a.confidence ||
            b.feedbacks - a.feedbacks ||
            (b.registryScore ?? 0) - (a.registryScore ?? 0),
        );
    }
    return map;
  }, [pool]);

  const sections = active === "all" ? CATEGORIES : [active];
  const { registered, withEndpoint, withFeedback } = index.registry;

  return (
    <>
      {/* ------------------------------------------------------------ header */}
      <section className="reg-head shell">
        <p className="eyebrow">The registry</p>
        <h1 className="reg-title">
          All {index.registry.registered.toLocaleString()} agents, each on the
          rung its evidence earns.
        </h1>
        <p className="reg-sub">
          {index.counts.indexed.toLocaleString()} have been fetched and parsed
          so far; the rest are unindexed, not disproven. Nothing here is ranked
          by what an agent says about itself — see{" "}
          <a href="/">the ladder</a> for what each rung tests.
        </p>

        <label className="search">
          <span className="label">
            search {index.counts.indexed.toLocaleString()} indexed agents
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name, description, or token id"
            aria-label="Search agents"
          />
        </label>
      </section>

      {/* ------------------------------------------------------------- rungs */}
      <div className="catbar catbar--rungs shell">
        <button
          className={`chip ${rung === "all" ? "chip--on" : ""}`}
          onClick={() => setRung("all")}
        >
          Every rung
        </button>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            className={`chip ${rung === n ? "chip--on" : ""}`}
            onClick={() => setRung(n)}
            disabled={(rungCounts.get(n) ?? 0) === 0}
          >
            {n} {RUNG_NAMES[n]}
            <span className="chip__n">{rungCounts.get(n) ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------ chips */}
      <div className="catbar shell">
        <button
          className={`chip ${active === "all" ? "chip--on" : ""}`}
          onClick={() => setActive("all")}
        >
          All categories
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${active === c ? "chip--on" : ""}`}
            onClick={() => setActive(c)}
          >
            {CATEGORY_LABEL[c]}
            <span className="chip__n">{index.counts.byCategory[c] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------- search */}
      {matched ? (
        <section className="section shell">
          <div className="section__head">
            <div>
              <div className="label">search</div>
              <h2 className="display section__title">
                {searching
                  ? "Searching…"
                  : `${matched.length} ${matched.length === 1 ? "match" : "matches"} for “${needle}”`}
              </h2>
            </div>
          </div>
          <AgentGrid agents={matched} />
        </section>
      ) : (
        sections.map((c) => {
          const all = byCategory[c];
          const n = shown[c] ?? PAGE;
          return (
            <section key={c} id={c} className="section shell">
              <div className="section__head">
                <div>
                  <div className="label">{CATEGORY_LABEL[c]}</div>
                  <h2 className="display section__title">{CATEGORY_BLURB[c]}</h2>
                </div>
                <p className="section__note">
                  {all.length} agents describe themselves this way. Classification
                  is derived from each agent&apos;s own words, and shown with the
                  terms that produced it.
                </p>
              </div>

              {all.length === 0 ? (
                <p className="empty-note">
                  Nothing in the index describes itself as {CATEGORY_LABEL[c].toLowerCase()} yet.
                </p>
              ) : (
                <>
                  <AgentGrid agents={all.slice(0, n)} />
                  {n < all.length ? (
                    <button
                      className="btn more"
                      onClick={() => setShown((s) => ({ ...s, [c]: n + PAGE * 2 }))}
                    >
                      Show {Math.min(PAGE * 2, all.length - n)} more
                    </button>
                  ) : null}
                </>
              )}
            </section>
          );
        })
      )}
    </>
  );
}

function AgentGrid({ agents }: { agents: IndexedAgent[] }) {
  return (
    <div className="agrid">
      {agents.map((a) => (
        <AgentCard key={a.tokenId} a={a} />
      ))}
    </div>
  );
}

function AgentCard({ a }: { a: IndexedAgent }) {
  const desc = (a.description ?? "").trim();
  return (
    <article className="acard">
      <header className="acard__head">
        <h3 className="acard__name">{a.name?.trim() || `Agent ${a.tokenId}`}</h3>
        <span className="fig acard__id">#{a.tokenId}</span>
      </header>

      <p className="acard__desc">
        {desc ? (desc.length > 190 ? `${desc.slice(0, 190)}…` : desc) : "No description on file."}
      </p>

      {a.matched.length ? (
        <p className="acard__why">
          <span className="label">classified on</span> {a.matched.slice(0, 3).join(", ")}
        </p>
      ) : null}

      <dl className="acard__stats">
        <div>
          <dt className="label">registry</dt>
          <dd className="fig">{a.registryScore ?? "—"}</dd>
        </div>
        <div>
          <dt className="label">feedback</dt>
          <dd className="fig">{a.feedbacks}</dd>
        </div>
        <div>
          <dt className="label">protocols</dt>
          <dd className="fig">{a.protocols.length ? a.protocols.join("·") : "—"}</dd>
        </div>
        <div>
          <dt className="label">x402</dt>
          <dd className="fig">{a.x402 ? "yes" : "—"}</dd>
        </div>
      </dl>

      <div className="acard__actions">
        <a className="btn btn--sm" href={`/agent/${a.tokenId}`}>
          Assay
        </a>
        <a className="btn btn--sm btn--primary" href={`/market?agent=${a.tokenId}`}>
          Put to work
        </a>
      </div>
    </article>
  );
}

function FunnelRow({
  label,
  value,
  of,
  accent,
}: {
  label: string;
  value: number;
  of: number;
  accent?: boolean;
}) {
  // A linear bar renders 5-of-301,784 as nothing at all, which hides the point.
  // Log scale keeps three orders of magnitude legible in one column.
  const pct = of > 0 ? Math.max(1.5, (Math.log10(Math.max(value, 1)) / Math.log10(of)) * 100) : 0;
  return (
    <div className="funnel__row">
      <div className="funnel__meta">
        <span className="label">{label}</span>
        <span className={`fig funnel__v ${accent ? "up" : ""}`}>{value.toLocaleString()}</span>
      </div>
      <div className="funnel__track">
        <div
          className={`funnel__fill ${accent ? "funnel__fill--accent" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
