import Link from "next/link";
import { EPOCHS_FROM } from "@/lib/market/epochs";
import type { Metadata } from "next";
import { formatEther } from "viem";
import AppShell from "@/components/v2/shell/AppShell";
import Timeline from "@/components/x/Timeline";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { readBook } from "@/lib/chain/book";
import { mandatePath } from "@/lib/chain/deployments";
import { WORKED_EXAMPLE, tx } from "@/lib/market/worked-example";
import { describeStatus, strangerHiresLive } from "@/lib/market/stranger-hires";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { OPERATED_WALLETS } from "@/lib/market/hires";
import { byDay, marketEvents, mixed, type EventKind } from "@/lib/market/events";

export const metadata: Metadata = {
  title: "Live market | MANDATE",
  description: "What is happening on the marketplace: agents answering, payments settling on chain, escrowed jobs, permissions granted and revoked, and new agents.",
};

export const revalidate = 30;

const FILTERS: { id: string; label: string; kinds: EventKind[] | null }[] = [
  { id: "all", label: "All", kinds: null },
  { id: "responses", label: "Responses", kinds: ["responded", "silent"] },
  { id: "payments", label: "Payments", kinds: ["paid", "failed"] },
  { id: "jobs", label: "Jobs", kinds: ["job"] },
  { id: "actions", label: "Agent actions", kinds: ["acted"] },
  { id: "permissions", label: "Permissions", kinds: ["granted", "revoked"] },
  { id: "agents", label: "New agents", kinds: ["listed"] },
];

const STATE = ["waiting for an agent", "running now", "finished its term", "cancelled before it started", "ended early"] as const;
const bnb = (w: bigint, dp = 5) => `${Number(formatEther(w)).toFixed(dp)} BNB`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The live market, as a timeline.
 *
 * Every event is read from a record that exists: our own call to an agent, a
 * payment on chain, an escrowed job, a session granted or revoked, a new
 * registration. Each row opens to its source and its proof. The receipts, the
 * refusals and whose fault each failure was all stay: they sit inside the
 * rows and in the full records below, because a market that only shows what
 * went well is a brochure.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const want = typeof sp.kind === "string" ? sp.kind : "all";
  const filter = FILTERS.find((f) => f.id === want) ?? FILTERS[0];

  const [feed, book, paid, strangers] = await Promise.all([
    marketEvents({ limit: 600 }).catch(() => ({ events: [], sources: { probe: null } })),
    readBook().catch(() => null),
    listPaidCalls().catch(() => []),
    strangerHiresLive().catch(() => []),
  ]);

  // The census answers in bursts of hundreds; on All they are capped so the
  // market's other events are not buried under our own probe.
  const shown = filter.kinds ? feed.events.filter((e) => filter.kinds!.includes(e.kind)).slice(0, 80) : mixed(feed.events, { responded: 5, silent: 2 }, 60);
  const days = byDay(shown);
  // Our own September tests are halted, not running; the clock leaves them as they stand.
  const running = book?.rows.filter((r) => r.state === 1 && r.deployment.status === "canonical" && Number(r.id) >= EPOCHS_FROM) ?? [];

  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Live market</h1>
          <p className="x-mkt-head__sub">Real events only: our checks, payments on chain, escrowed jobs, permissions and new agents.</p>
          {feed.sources.probe ? (
            <p className="x-fresh x-mkt-head__fresh">
              <span className="x-status__dot" style={{ background: "var(--c-ok)" }} aria-hidden="true" />
              <Ago iso={feed.sources.probe} prefix="Checked" />
            </p>
          ) : null}
        </div>
        <nav className="x-cats" aria-label="Kinds of event">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={f.id === "all" ? "/activity" : `/activity?kind=${f.id}`}
              className={`x-chip${f.id === filter.id ? " x-chip--on" : ""}`}
              aria-current={f.id === filter.id ? "true" : undefined}
              scroll={false}
            >
              {f.label}
            </Link>
          ))}
        </nav>
      </section>

      <div className="x-wrap x-act">
        <div className="x-act__main">
          {days.length ? (
            days.map((d) => (
              <section key={d.day} className="x-act__day" aria-label={d.day}>
                <h2 className="x-act__h">{d.day}</h2>
                <Timeline events={d.events} detail />
              </section>
            ))
          ) : (
            <p className="x-muted">Nothing of this kind in the last thirty days. A quiet week is shown as a quiet week.</p>
          )}
        </div>

        <aside className="x-act__side" aria-label="Running now">
          <h2 className="x-act__h">Running now</h2>
          {running.length ? (
            <ol className="x-runs x-runs--side">
              {running.map((r) => {
                const category = CATEGORIES[r.category] ?? null;
                const pct = r.epochsTotal ? Math.min(100, Math.round((r.epochsSettled / r.epochsTotal) * 100)) : 0;
                return (
                  <li key={`${r.deployment.label}-${r.id}`} className="x-run x-run--side">
                    <span className="x-run__main">
                      <Link href={mandatePath(r.deployment.address, r.id)} className="x-run__t">
                        {category ? CATEGORY_LABEL[category] : "Mandate"} job #{r.id}
                      </Link>
                      <span className="x-run__sub">{bnb(r.capitalWei, 4)}</span>
                    </span>
                    <span className="x-run__prog">
                      <span className="x-run__bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="x-run__ep">
                        Hour {r.epochsSettled} of {r.epochsTotal}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="x-muted x-act__none">No job is running right now.</p>
          )}
          {book ? (
            <dl className="x-kv x-act__totals">
              <div>
                <dt>Jobs ever opened</dt>
                <dd>{book.opened}</dd>
              </div>
              <div>
                <dt>Capital under mandate</dt>
                <dd className="x-mono">{bnb(book.underMandateWei, 4)}</dd>
              </div>
              <div>
                <dt>Agent money at risk</dt>
                <dd className="x-mono">{bnb(book.bondedWei, 5)}</dd>
              </div>
            </dl>
          ) : null}
          <Link href="/jobs" className="x-btn x-btn--block">
            See jobs
          </Link>
        </aside>
      </div>

      {/* ------------------------------------------------ the full records */}
      <section className="x-wrap x-section--tight x-records" aria-labelledby="h-records">
        <h2 id="h-records">The full records</h2>
        <p className="x-ad-src">This is a young market and the amounts are small. Padding it out with simulated activity would make every other claim here worthless.</p>

        <details className="x-record">
          <summary>
            Every job ever opened <span className="x-chip__n">{book?.rows.length ?? 0}</span>
          </summary>
          {!book ? (
            <p className="x-muted">The chain would not answer just now. That is our node failing, not the market.</p>
          ) : (
            <>
              {book.unread.length ? (
                <p className="x-pay__err">
                  {book.unread.join(", ")} would not answer, so {book.unread.length === 1 ? "its" : "their"} rows are missing rather than counted as zero.
                </p>
              ) : null}
              <ol className="x-tl x-tl--wrap">
                {book.rows.map((r) => {
                  const category = CATEGORIES[r.category] ?? null;
                  return (
                    <li className="x-tl__row" key={`${r.deployment.label}-${r.id}`}>
                      <span className="x-tl__dot x-tl__dot--job" aria-hidden="true" />
                      <span className="x-tl__main">
                        <Link className="x-tl__actor" href={r.deployment.status === "canonical" ? `/receipts/${r.id}` : mandatePath(r.deployment.address, r.id)}>
                          {category ? CATEGORY_LABEL[category] : "Mandate"} job #{r.id}
                        </Link>{" "}
                        <span className="x-tl__what">
                          {STATE[r.state] ?? `in state ${r.state}`}
                          {r.agent && r.agent !== "0x0000000000000000000000000000000000000000" ? `, held by ${short(r.agent)}` : ""}
                          {r.epochsSettled > 0 ? ` · ${(Number(r.cumulativeAlphaBps) / 100).toFixed(2)}% against the benchmark` : ""}
                          {r.strikes > 0 ? ` · ${r.strikes} strikes` : ""}
                          {r.deployment.status !== "canonical" ? ` · on ${r.deployment.label}, an earlier contract we replaced` : ""}
                          {r.agent && OPERATED_WALLETS.has(r.agent.toLowerCase()) ? " · a wallet we operate holds it" : ""}
                        </span>
                      </span>
                      <span className="x-tl__fig x-mono">{bnb(r.capitalWei, 4)}</span>
                      <span className="x-tl__at">
                        {r.epochsSettled} of {r.epochsTotal} h
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </details>

        <details className="x-record" id="paid">
          <summary>
            Calls we paid for, one at a time <span className="x-chip__n">{paid.length}</span>
          </summary>
          <p className="x-ad-src">
            x402 payments to agents we do not operate, settled on BNB Smart Chain. Every exchange is kept byte for byte, including the ones where the seller took the
            money and answered with an error.
          </p>
          <ol className="x-tl x-tl--wrap">
            {paid.map((c) => (
              <li className="x-tl__row" key={c.id}>
                <span className={`x-tl__dot x-tl__dot--${c.delivered ? "paid" : "failed"}`} aria-hidden="true" />
                <span className="x-tl__main">
                  <Link className="x-tl__actor" href={`/agents/${c.tokenId}`}>
                    {c.name}
                  </Link>{" "}
                  <span className="x-tl__what">
                    {c.delivered ? "delivered its work" : c.paid ? "settled our payment and answered with an error" : "refused the payment"}
                    {c.note ? `. ${c.fault === "ours" ? "Our mistake, not the seller's: " : ""}${c.note}` : ""}
                    {c.tx ? (
                      <>
                        {" · "}
                        <a className="x-link" href={tx(c.tx)} target="_blank" rel="noreferrer">
                          receipt
                        </a>
                      </>
                    ) : null}
                    {c.evidence ? (
                      <>
                        {" · "}
                        <a className="x-link" href={`https://github.com/iamdflame/mandate-bnb/blob/main/${c.evidence}`} target="_blank" rel="noreferrer">
                          the whole exchange
                        </a>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="x-tl__fig x-mono">{c.amount ? (Number(c.amount) / 1e18).toFixed(2) : "nothing"}</span>
                <span className="x-tl__at">
                  <Ago iso={c.at} />
                </span>
              </li>
            ))}
          </ol>
          <p className="x-ad-src">
            An agent that takes a payment and returns an error is not offered as hireable anywhere on this site until it delivers again, and the reason on its card is
            the sentence its own server sent us.
          </p>
        </details>

        <details className="x-record" id="strangers">
          <summary>
            Jobs paid to agents we do not operate <span className="x-chip__n">{strangers.length}</span>
          </summary>
          <p className="x-ad-src">ERC-8183 escrow in $U, funded from our Altana account. Status is read from the commerce contract as this page renders.</p>
          <ol className="x-tl x-tl--wrap">
            {strangers.map((h) => (
              <li className="x-tl__row" key={h.jobId}>
                <span className="x-tl__dot x-tl__dot--job" aria-hidden="true" />
                <span className="x-tl__main">
                  <Link className="x-tl__actor" href={`/agents/${h.tokenId}`}>
                    {h.who}
                  </Link>{" "}
                  <span className="x-tl__what">
                    job {h.jobId}: {describeStatus(h)}
                    {h.deliverable?.url ? (
                      <>
                        {" · "}
                        <a className="x-link" href={h.deliverable.url} target="_blank" rel="noreferrer">
                          their deliverable
                        </a>
                        {h.deliverable.hashMatches === true ? ", matching the hash they committed" : h.deliverable.hashMatches === false ? ", which does not match the hash they committed" : ""}
                      </>
                    ) : null}
                    {h.tx ? (
                      <>
                        {" · "}
                        <a className="x-link" href={tx(h.tx)} target="_blank" rel="noreferrer">
                          funding
                        </a>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="x-tl__fig x-mono">
                  {h.budget} {h.token}
                </span>
                <span className="x-tl__at" />
              </li>
            ))}
          </ol>
        </details>

        <details className="x-record">
          <summary>The first hire, transaction by transaction</summary>
          <ol className="x-tl x-tl--wrap">
            {WORKED_EXAMPLE.steps.map((s, i) => (
              <li key={s.tx} className="x-tl__row">
                <span className="x-tl__dot x-tl__dot--paid" aria-hidden="true" />
                <span className="x-tl__main">
                  <span className="x-tl__actor">
                    {i + 1}. {s.what}
                  </span>{" "}
                  <span className="x-tl__what">{s.plain}</span>
                </span>
                <a className="x-tl__fig x-mono x-link" href={tx(s.tx)} target="_blank" rel="noreferrer">
                  {s.tx.slice(0, 10)}…
                </a>
                <span className="x-tl__at" />
              </li>
            ))}
          </ol>
        </details>
      </section>
    </AppShell>
  );
}
