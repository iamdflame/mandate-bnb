import Link from "next/link";
import { EPOCHS_FROM } from "@/lib/market/epochs";
import type { Metadata } from "next";
import { formatEther } from "viem";
import AppShell from "@/components/v2/shell/AppShell";
import { ArrowRight } from "lucide-react";
import Timeline, { EVENT_POSE } from "@/components/x/Timeline";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import Empty from "@/components/x/Empty";
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

  // The faces of the latest events, in the pose each event left them in: the tape's own masthead.
  // With nothing on the tape, the calls we paid for stand in: real hires, each in the pose its outcome left it.
  const fromTape = shown
    .filter((e, i, a) => a.findIndex((x) => (x.tokenId ?? x.actor) === (e.tokenId ?? e.actor)) === i)
    .slice(0, 9)
    .map((e) => ({ key: e.id, job: e.category ?? null, seed: e.tokenId ?? e.actor, state: EVENT_POSE[e.kind], name: e.actor, kind: e.kind as string }));
  const fromPaid = paid
    .filter((c, i, a) => a.findIndex((x) => x.tokenId === c.tokenId) === i)
    .slice(0, 9)
    .map((c) => ({ key: c.id, job: null, seed: c.tokenId, state: (c.delivered ? "delivered" : "failed") as CharacterState, name: c.name, kind: c.delivered ? "paid" : "failed" }));
  const crowd = fromTape.length ? fromTape : fromPaid;
  let n = 0;

  return (
    <AppShell>
      <header className="ac-live">
        <div className="ac-live__pool" aria-hidden="true" />
        <div className="k-wrap ac-live__in">
          <div className="ac-live__copy">
            <p className="ac-live__k k-rise" style={{ ["--i" as string]: 0 }}>
              <span className="k-dot k-dot--live" aria-hidden="true" /> Live
              {feed.sources.probe ? (
                <span className="ac-live__age">
                  <Ago iso={feed.sources.probe} prefix="Checked" />
                </span>
              ) : null}
            </p>
            <h1 className="k-display k-rise" style={{ ["--i" as string]: 1 }}>
              The market, as it happens.
            </h1>
            <p className="k-lede k-rise" style={{ ["--i" as string]: 2 }}>
              Real events only: our checks, payments on chain, escrowed jobs, permissions and new agents.
            </p>
            <p className="k-small k-rise" style={{ ["--i" as string]: 3 }}>
              Most of it is our own: the census calling every agent, and our daily test purchases.
            </p>
          </div>
          {crowd.length ? (
            <ul className="ac-live__crowd" aria-label={fromTape.length ? "The latest agents on the tape" : "The latest calls we paid for"}>
              {crowd.map((e, i) => (
                <li key={e.key} style={{ ["--i" as string]: i }} data-kind={e.kind}>
                  <Agent job={e.job} seed={e.seed} size={i === 0 ? 120 : 76} state={e.state} omit={["leash"]} slot={`crowd${i}`} />
                  <span className="ac-live__tag">{e.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="k-wrap">
          <nav className="ac-filters" aria-label="Kinds of event">
            {FILTERS.map((f) => (
              <Link key={f.id} href={f.id === "all" ? "/activity" : `/activity?kind=${f.id}`} className="k-chip" aria-current={f.id === filter.id ? "page" : undefined} scroll={false}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="k-wrap ac-act">
        <div className="ac-act__main">
          {days.length ? (
            days.map((d) => {
              const start = n;
              n += d.events.length;
              return (
                <section key={d.day} className="ac-act__day" aria-label={d.day}>
                  <h2 className="ac-act__h">{d.day}</h2>
                  <Timeline events={d.events} detail start={start} />
                </section>
              );
            })
          ) : (
            <Empty title="Nothing of this kind in the last thirty days" job="grid-trading" pose="dozing">
              A quiet week is shown as a quiet week.
            </Empty>
          )}
        </div>

        <aside className="ac-act__side" aria-labelledby="ac-running">
          <div className="ac-side k-panel">
            <h2 className="k-h3" id="ac-running">
              Running now
            </h2>
            {running.length ? (
              <ol className="ac-runs2">
                {running.map((r) => {
                  const category = CATEGORIES[r.category] ?? null;
                  const pct = r.epochsTotal ? Math.min(100, Math.round((r.epochsSettled / r.epochsTotal) * 100)) : 0;
                  return (
                    <li key={`${r.deployment.label}-${r.id}`} className="ac-run" data-job={category ?? undefined}>
                      <Link href={mandatePath(r.deployment.address, r.id)} className="ac-run__t">
                        {category ? CATEGORY_LABEL[category] : "Mandate"} job #{r.id}
                      </Link>
                      <span className="k-small k-num">{bnb(r.capitalWei, 4)}</span>
                      <span className="ac-run__bar" aria-hidden="true">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <span className="k-small k-num">
                        Hour {r.epochsSettled} of {r.epochsTotal}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="k-small">No job is running right now.</p>
            )}
            {book ? (
              <dl className="ac-side__facts">
                <div>
                  <dt>Jobs ever opened</dt>
                  <dd className="k-num">{book.opened}</dd>
                </div>
                <div>
                  <dt>Capital under mandate</dt>
                  <dd className="k-num">{bnb(book.underMandateWei, 4)}</dd>
                </div>
                <div>
                  <dt>Agent money at risk</dt>
                  <dd className="k-num">{bnb(book.bondedWei, 5)}</dd>
                </div>
              </dl>
            ) : null}
            <Link href="/jobs" className="k-btn k-btn--sm k-btn--block">
              See jobs <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------ the full records */}
      <section className="k-wrap ac-sec" aria-labelledby="h-records">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2" id="h-records">
              The full records
            </h2>
            <p className="k-body">This is a young market and the amounts are small. Padding it out with simulated activity would make every other claim here worthless.</p>
          </div>
        </div>

        <details className="ac-more">
          <summary>
            <span className="ac-more__t">Every job ever opened</span>
            <span className="ac-more__n">{book?.rows.length ?? 0}</span>
          </summary>
          <div className="ac-more__body">
            {!book ? (
              <p className="k-small">The chain would not answer just now. That is our node failing, not the market.</p>
            ) : (
              <>
                {book.unread.length ? (
                  <p className="k-note k-note--warn">
                    {book.unread.join(", ")} would not answer, so {book.unread.length === 1 ? "its" : "their"} rows are missing rather than counted as zero.
                  </p>
                ) : null}
                <ol className="ac-tape ac-tape--rec">
                  {book.rows.map((r) => {
                    const category = CATEGORIES[r.category] ?? null;
                    return (
                      <li className="ac-tape__row" key={`${r.deployment.label}-${r.id}`} data-kind="job">
                        <span className="ac-tape__face" aria-hidden="true">
                          <Agent job={category} seed={`job-${r.deployment.label}-${r.id}`} size={36} state={r.state === 1 ? "working" : r.state === 0 ? "ready" : "dozing"} slot={`rec${r.deployment.label}${r.id}`} />
                        </span>
                        <span className="ac-tape__main">
                          <Link className="ac-tape__who" href={r.deployment.status === "canonical" ? `/receipts/${r.id}` : mandatePath(r.deployment.address, r.id)}>
                            {category ? CATEGORY_LABEL[category] : "Mandate"} job #{r.id}
                          </Link>{" "}
                          <span className="ac-tape__what">
                            {STATE[r.state] ?? `in state ${r.state}`}
                            {r.agent && r.agent !== "0x0000000000000000000000000000000000000000" ? `, held by ${short(r.agent)}` : ""}
                            {r.epochsSettled > 0 ? `, ${(Number(r.cumulativeAlphaBps) / 100).toFixed(2)}% against the benchmark` : ""}
                            {r.strikes > 0 ? `, ${r.strikes} strikes` : ""}
                            {r.deployment.status !== "canonical" ? `, on ${r.deployment.label}, an earlier contract we replaced` : ""}
                            {r.agent && OPERATED_WALLETS.has(r.agent.toLowerCase()) ? ". A wallet we operate holds it" : ""}
                          </span>
                        </span>
                        <span className="ac-tape__fig k-num">{bnb(r.capitalWei, 4)}</span>
                        <span className="ac-tape__at k-num">
                          {r.epochsSettled} of {r.epochsTotal} h
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </details>

        <details className="ac-more" id="paid">
          <summary>
            <span className="ac-more__t">
              Calls we paid for, one at a time
              <small>x402 payments to agents we do not operate, kept byte for byte, including the ones where the seller took the money and answered with an error.</small>
            </span>
            <span className="ac-more__n">{paid.length}</span>
          </summary>
          <div className="ac-more__body">
            <ol className="ac-tape ac-tape--rec">
              {paid.map((c, i) => (
                <li className="ac-tape__row" key={c.id} data-kind={c.delivered ? "paid" : "failed"}>
                  <span className="ac-tape__face" aria-hidden="true">
                    <Agent job={null} seed={c.tokenId} size={36} state={c.delivered ? "delivered" : "failed"} slot={`paid${i}`} />
                  </span>
                  <span className="ac-tape__main">
                    <Link className="ac-tape__who" href={`/agents/${c.tokenId}`}>
                      {c.name}
                    </Link>{" "}
                    <span className="ac-tape__what">
                      {c.delivered ? "delivered its work" : c.paid ? "settled our payment and answered with an error" : "refused the payment"}
                      {c.note ? `. ${c.fault === "ours" ? "Our mistake, not the seller's: " : ""}${c.note}` : ""}
                    </span>
                    <span className="ac-tape__links">
                      {c.tx ? (
                        <a className="k-link" href={tx(c.tx)} target="_blank" rel="noreferrer">
                          receipt
                        </a>
                      ) : null}
                      {c.evidence ? (
                        <a className="k-link" href={`https://github.com/iamdflame/mandate-bnb/blob/main/${c.evidence}`} target="_blank" rel="noreferrer">
                          the whole exchange
                        </a>
                      ) : null}
                    </span>
                  </span>
                  <span className="ac-tape__fig k-num">{c.amount ? (Number(c.amount) / 1e18).toFixed(2) : "nothing"}</span>
                  <span className="ac-tape__at">
                    <Ago iso={c.at} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="k-small">An agent that takes a payment and returns an error is not offered as hireable anywhere on this site until it delivers again, and the reason on its card is the sentence its own server sent us.</p>
          </div>
        </details>

        <details className="ac-more" id="strangers">
          <summary>
            <span className="ac-more__t">
              Jobs paid to agents we do not operate
              <small>ERC-8183 escrow in $U, funded from our Altana account. Status is read from the commerce contract as this page renders.</small>
            </span>
            <span className="ac-more__n">{strangers.length}</span>
          </summary>
          <div className="ac-more__body">
            <ol className="ac-tape ac-tape--rec">
              {strangers.map((h, i) => (
                <li className="ac-tape__row" key={h.jobId} data-kind="job">
                  <span className="ac-tape__face" aria-hidden="true">
                    <Agent job={null} seed={h.tokenId} size={36} state={h.deliverable?.hashMatches === false ? "failed" : h.deliverable?.url ? "delivered" : "working"} slot={`str${i}`} />
                  </span>
                  <span className="ac-tape__main">
                    <Link className="ac-tape__who" href={`/agents/${h.tokenId}`}>
                      {h.who}
                    </Link>{" "}
                    <span className="ac-tape__what">
                      job {h.jobId}: {describeStatus(h)}
                      {h.deliverable?.url ? (h.deliverable.hashMatches === true ? ", matching the hash they committed" : h.deliverable.hashMatches === false ? ", which does not match the hash they committed" : "") : ""}
                    </span>
                    <span className="ac-tape__links">
                      {h.deliverable?.url ? (
                        <a className="k-link" href={h.deliverable.url} target="_blank" rel="noreferrer">
                          their deliverable
                        </a>
                      ) : null}
                      {h.tx ? (
                        <a className="k-link" href={tx(h.tx)} target="_blank" rel="noreferrer">
                          funding
                        </a>
                      ) : null}
                    </span>
                  </span>
                  <span className="ac-tape__fig k-num">
                    {h.budget} {h.token}
                  </span>
                  <span className="ac-tape__at" />
                </li>
              ))}
            </ol>
          </div>
        </details>

        <details className="ac-more">
          <summary>
            <span className="ac-more__t">The first hire, transaction by transaction</span>
          </summary>
          <div className="ac-more__body">
            <ol className="ac-steps3">
              {WORKED_EXAMPLE.steps.map((s, i) => (
                <li key={s.tx}>
                  <span className="ac-steps3__n k-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="ac-tape__main">
                    <span className="ac-tape__who">{s.what}</span> <span className="ac-tape__what">{s.plain}</span>
                  </span>
                  <a className="k-link k-mono ac-tape__fig" href={tx(s.tx)} target="_blank" rel="noreferrer">
                    {s.tx.slice(0, 10)}…
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </details>
      </section>
    </AppShell>
  );
}
