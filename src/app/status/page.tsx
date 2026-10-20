import "@/styles/trust.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check as Tick, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import TrustHead from "@/components/trust/TrustHead";
import HashOpen from "@/components/trust/HashOpen";
import { live } from "@/lib/data/live";
import { hireableByCategory, judgePathChecks, THIN_BELOW } from "@/lib/ops/status";
import { overdueEpochs } from "@/lib/market/epochs";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { health } from "@/lib/chain/rpc";
import { readHeartbeats } from "@/lib/heartbeat";
import { getProbes } from "@/lib/data/probes";
import { ageOf } from "@/lib/data/snapshots";
import { roles } from "@/lib/chain/marketV2";
import { withTimeout } from "@/lib/cache";
import { bscscanAddress, short } from "@/lib/demo";
import { score, type Box } from "@/lib/ops/definition-of-done";
import { snapshot } from "@/lib/data/snapshots";
import { scheduleState } from "@/lib/ops/schedule";
import { uptime } from "@/lib/ops/history";

export const metadata: Metadata = {
  title: "Status | Mandate",
  description: "Whether every part of MANDATE works right now, checked from the inside, with the providers, clocks and roles behind it.",
};

export const dynamic = "force-dynamic";
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

/** Mandate's own agent in each job, drawn beside its job's depth. */
const FOUNDER: Record<string, string> = { rebalancing: "344119", "grid-trading": "344121", "yield-optimisation": "344122", "health-factor": "344123" };

/**
 * Status, in three layers: whether the site works now (the beats, the depth
 * of each job, the clock on capital jobs, fourteen days of history), what is
 * under the hood (providers, clocks, roles), and, folded, the campaign's
 * requirements and the definition of done for judges. Every anchor
 * (#depth, #epochs, #requirements, #definition, #history) still lands, and
 * a folded one opens itself.
 */
export default async function StatusPage() {
  await live(["status-checks"]);
  let checkedAt = new Date().toISOString();
  const [checks, depth, late, rpcs, beats, who, boxes, reqs, up, schedule] = await Promise.all([
    // The scheduled tick asks every five minutes and keeps the answer; asked here only when that is over ten minutes old.
    (async () => {
      const kept = snapshot<Awaited<ReturnType<typeof judgePathChecks>>>("status-checks");
      if (kept && Date.now() - Date.parse(kept.capturedAt) < 10 * 60_000) {
        checkedAt = kept.capturedAt;
        return kept.payload;
      }
      return judgePathChecks();
    })(),
    withTimeout(hireableByCategory().catch(() => null), 8_000),
    withTimeout(overdueEpochs().catch(() => null), 8_000),
    health(),
    readHeartbeats().catch(() => null),
    withTimeout(roles().catch(() => null), 6_000),
    /*
      Read, never computed here. The definition asks the chain, the ladder and
      the database, which took longer than this page's whole budget and turned
      /status into a timeout. The scheduled tick computes it every five minutes
      and stores it; if nothing is stored yet the page says so.
    */
    Promise.resolve(snapshot<Box[]>("definition")),
    Promise.resolve(snapshot<Box[]>("requirements")),
    withTimeout(uptime(14).catch(() => null), 6_000),
    withTimeout(scheduleState().catch(() => []), 6_000),
  ]);
  const definition = boxes?.payload ?? [];
  const required = reqs?.payload ?? [];
  const requiredScore = score(required);
  const definitionAt = boxes?.capturedAt ?? null;
  const done = score(definition);
  const probes = getProbes();
  const ok = checks.every((c) => c.ok);
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local build";

  // The fourteen days the history covers, and where each incident falls on them.
  const spanTo = Date.now();
  const spanFrom = up?.since ? Math.max(Date.parse(up.since), spanTo - 14 * 86_400_000) : spanTo - 14 * 86_400_000;
  const at = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - spanFrom) / Math.max(1, spanTo - spanFrom)) * 100));
  const passing = checks.filter((c) => c.ok).length;
  const boxWord = (b: Box, kind: "req" | "def") => (b.state === "done" ? (kind === "req" ? "met" : "true") : b.state === "partly" ? "part way" : kind === "req" ? "not met" : "not yet");
  const boxTone = (b: Box) => (b.state === "done" ? "pass" : b.state === "partly" ? "warn" : "fail");

  return (
    <AppShell>
      <div className="tr">
        <HashOpen />
        <TrustHead
          title={ok ? "Everything is working." : "Something is not working."}
          lede="Each check reads what a page needs, from the chain and from our own services, every five minutes."
          art={
            <div className="tr-pulse" data-ok={ok ? "1" : "0"} aria-hidden="true">
              <div className="tr-pulse__ring" />
              <Agent job="rebalancing" seed="status-watch" size={150} state={ok ? "awake" : "failed"} slot="pulse" />
              <div className="tr-pulse__beats">
                {checks.map((c, i) => (
                  <span key={c.beat} data-ok={c.ok ? "1" : "0"} style={{ ["--i" as string]: i }} />
                ))}
              </div>
            </div>
          }
          source={
            <>
              <span>
                Read at {new Date(checkedAt).toUTCString().slice(17, 22)} UTC, {passing} of {checks.length} working
              </span>
              <span>Commit {commit}</span>
              <span>checked {new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span>
            </>
          }
        >
          <p className="k-small">
            The same checks answer at{" "}
            <a className="k-link k-mono" href="/api/status">
              /api/status
            </a>{" "}
            with 200 or 503, for an uptime monitor.
          </p>
        </TrustHead>

        <section className="tr-sec tr-sec--first" aria-labelledby="st-checks">
          <div className="k-wrap">
            <h2 className="k-h2 tr-sec__h" id="st-checks">
              The checks.
            </h2>
            <ol className="tr-checks">
              {checks.map((c) => (
                <li key={c.beat} className="tr-check" data-st={c.ok ? "pass" : "fail"}>
                  <span className="tr-check__mark" aria-hidden="true">
                    {c.ok ? <Tick size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                  </span>
                  <span className="tr-check__t">
                    <span className="tr-rerun__id k-num">{c.beat}</span> {c.name}
                  </span>
                  <span className="tr-check__v">
                    {c.ok ? "working" : "broken"} <span className="tr-check__pts k-num">{(c.ms / 1000).toFixed(1)} s</span>
                  </span>
                  <p className="tr-check__f">{c.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/*
          How deep each job is: agents a buyer can hire right now, by the hire
          law. Kept apart from the beats above, which say whether the site
          works; a thin job is a market to grow, not a page that is broken.
        */}
        <section className="tr-sec" id="depth" aria-labelledby="st-depth">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h2" id="st-depth">
                  Agents you can hire, per job.
                </h2>
                <p className="k-small">Counted by the same rule as the agents page. Under {THIN_BELOW} is flagged.</p>
              </div>
            </div>
            {depth ? (
              <ul className="tr-depth">
                {CATEGORIES.map((c) => (
                  <li key={c} data-job={c}>
                    <Link className="tr-depth__card" href={`/agents?category=${c}&hireable=1`}>
                      <span className="tr-depth__art" aria-hidden="true">
                        <Agent job={c} seed={FOUNDER[c] ?? c} house size={64} state="ready" slot="depth" />
                      </span>
                      <span className="tr-depth__n k-num">{depth[c].length}</span>
                      <span className="tr-depth__t">{CATEGORY_LABEL[c]}</span>
                      <span className={`tr-v tr-v--${depth[c].length >= THIN_BELOW ? "pass" : "warn"}`}>{depth[c].length >= THIN_BELOW ? "deep enough" : "thin"}</span>
                      <span className="tr-depth__names">{depth[c].join(", ") || "Nobody right now"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-note">The count did not come back in time on this request.</p>
            )}
          </div>
        </section>

        {/* Jobs with capital: any epoch the clock has not settled in time is named here. */}
        <section className="tr-sec" id="epochs" aria-labelledby="st-epochs">
          <div className="k-wrap">
            <h2 className="k-h3 tr-sec__h" id="st-epochs">
              Jobs with capital
            </h2>
            {late === null ? (
              <p className="k-note">The market did not answer in time on this request.</p>
            ) : late.length === 0 ? (
              <p className="k-note k-note--ok">
                <Tick size={16} strokeWidth={2.8} aria-hidden="true" />
                <span>On time. No active job has an epoch waiting past its window. Every epoch is proposed and finalised on the site&apos;s clock.</span>
              </p>
            ) : (
              <ul className="tr-late">
                {late.map((l) => (
                  <li key={l.id} className="k-note k-note--warn">
                    <span className="tr-v tr-v--warn">late</span> Job #{l.id}, epoch {l.epoch}: {l.minutesLate} minutes past due.
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="tr-sec" id="history" aria-labelledby="st-history">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h2" id="st-history">
                  The last fourteen days.
                </h2>
                <p className="k-small">Samples taken every five minutes by the external pinger that calls this deployment&rsquo;s tick.</p>
              </div>
            </div>
            {up && up.samples > 0 ? (
              <figure className="tr-uptime k-panel">
                <div className="k-fig">
                  <span className="k-fig__n k-num">{(100 * (up.ratio ?? 0)).toFixed(1)}%</span>
                  <span className="k-fig__l">
                    of {up.samples} samples had every beat green, since {up.since ? new Date(up.since).toISOString().slice(0, 16).replace("T", " ") : "unknown"} UTC
                  </span>
                </div>
                <div className="tr-uptime__strip" role="img" aria-label={up.incidents.length ? `${up.incidents.length} incidents` : "No incidents"}>
                  {up.incidents.map((inc) => (
                    <span key={inc.from} className="tr-uptime__inc" style={{ left: `${at(inc.from)}%`, width: `${Math.max(0.6, at(inc.to) - at(inc.from))}%` }} />
                  ))}
                </div>
                <figcaption className="k-src">
                  {up.incidents.length === 0
                    ? "Incidents: none recorded."
                    : `Incidents: ${up.incidents.map((i) => `${i.from.slice(5, 16).replace("T", " ")} to ${i.to.slice(11, 16)} UTC (${i.samples} samples)`).join("; ")}`}
                </figcaption>
              </figure>
            ) : (
              <div className="k-empty">
                <Agent job="rebalancing" seed="status-history" size={88} state="dozing" slot="hist" />
                <p className="k-empty__t">No history yet.</p>
                <p className="k-empty__d">
                  The site keeps a sample every five minutes once an external pinger calls <span className="k-mono">/api/cron/tick</span> with this deployment&rsquo;s CRON_SECRET. Until then this page can say what is true now, but not what was true yesterday.
                </p>
              </div>
            )}
            {schedule?.length ? (
              <details className="tr-fold tr-sec__more">
                <summary>
                  <span className="tr-fold__s">
                    <span className="tr-fold__t">Scheduled jobs</span>
                    <span className="tr-fold__d">
                      {schedule.length} jobs, {schedule.filter((j) => j.overdue).length} overdue
                    </span>
                  </span>
                </summary>
                <div className="tr-fold__body">
                  <div className="k-table-wrap">
                    <table className="k-table">
                      <thead>
                        <tr>
                          <th>Scheduled job</th>
                          <th>Every</th>
                          <th>Last run</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((j) => (
                          <tr key={j.name}>
                            <td className="k-table__main">{j.name}</td>
                            <td className="k-num">{j.everyMinutes} min</td>
                            <td className={j.overdue ? "tr-neg" : undefined}>
                              {j.lastRunAt ? `${ageOf(j.lastRunAt)}${j.ok === false ? ", and it failed" : ""}` : "never"}
                              {j.overdue ? " (the clock has stopped)" : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="st-hood">
          <div className="k-wrap">
            <h2 className="k-h2 tr-sec__h" id="st-hood">
              Under the hood.
            </h2>
            <div className="tr-hood">
              <div className="tr-hood__block tr-hood__block--wide">
                <h3 className="k-h3">Chain providers</h3>
                <p className="k-small">Every read rotates across these. A provider that fails is skipped for a minute, so one dead node costs one failed call.</p>
                <div className="k-table-wrap">
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Answered</th>
                        <th>Block</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rpcs.map((r) => (
                        <tr key={r.url}>
                          <td className="k-mono">{new URL(r.url).host}</td>
                          <td>
                            <span className={`tr-v tr-v--${r.ok ? "pass" : "fail"}`}>{r.ok ? "yes" : "no"}</span>
                            {r.error ? <div className="k-small">{r.error}</div> : null}
                          </td>
                          <td className="k-num">{r.block ? r.block.toLocaleString("en-GB") : "-"}</td>
                          <td className="k-num">{r.ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="tr-hood__block">
                <h3 className="k-h3">Clocks</h3>
                <p className="k-small">How old each reading behind the site is. The census refreshes from visitors&rsquo; own requests when it is older than fifteen minutes.</p>
                <dl className="k-facts">
                  <div>
                    <dt>Agent census</dt>
                    <dd>
                      {probes.answered} of {probes.probed} answered, taken {ageOf(probes.at)}
                    </dd>
                  </div>
                  {beats
                    ? (Object.entries(beats) as [string, { at: string; alive: boolean } | null][]).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k} heartbeat</dt>
                          <dd className={v && !v.alive ? "tr-neg" : undefined}>{v ? `${ageOf(v.at)}${v.alive ? "" : " (overdue)"}` : "never written"}</dd>
                        </div>
                      ))
                    : null}
                </dl>
              </div>

              <div className="tr-hood__block">
                <h3 className="k-h3">Who holds which role</h3>
                <p className="k-small">Read from the market contract now.</p>
                {who ? (
                  <dl className="k-facts">
                    <div>
                      <dt>Owner</dt>
                      <dd>
                        <a className="k-mono tr-addr" href={bscscanAddress(who.owner)} target="_blank" rel="noreferrer">
                          {short(who.owner)}
                        </a>
                        <div className="k-small">an EOA; a Safe transfer is prepared and not run</div>
                      </dd>
                    </div>
                    <div>
                      <dt>Adjudicator</dt>
                      <dd>
                        <a className="k-mono tr-addr" href={bscscanAddress(who.adjudicator)} target="_blank" rel="noreferrer">
                          {short(who.adjudicator)}
                        </a>
                        <div className="k-small">{who.adjudicator.toLowerCase() === who.owner.toLowerCase() ? "the same key as the owner" : "a different key from the owner"}</div>
                      </dd>
                    </div>
                    <div>
                      <dt>Read at</dt>
                      <dd className="k-num">block {who.block.toLocaleString("en-GB")}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="k-note">The market did not answer just now.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="st-judges">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h3" id="st-judges">
                  For judges and the campaign
                </h2>
                <p className="k-small">Worked out from our own pages, the registry, the chain and the public repository, not ticked by hand.</p>
              </div>
            </div>
            <div className="tr-judge">
              {/* BNB's own requirements for Set and Earn, each worked out from what the site can read. */}
              <details className="tr-fold" id="requirements">
                <summary>
                  <span className="tr-fold__s">
                    <span className="tr-fold__t">BNB&apos;s requirements</span>
                    <span className="tr-fold__d">
                      {required.length ? `${requiredScore.done} of ${requiredScore.total} met, ${requiredScore.partly} part way, ${requiredScore.open} not met, checked ${ageOf(reqs!.capturedAt)}` : "Not checked yet on this deployment"}
                    </span>
                  </span>
                </summary>
                <div className="tr-fold__body">
                  <p className="k-small">
                    Each line quotes the Set and Earn requirements document. Also at <span className="k-mono">/api/requirements</span>.
                  </p>
                  {required.length ? (
                    <ul className="tr-boxes">
                      {required.map((b) => (
                        <li key={b.id}>
                          <span className={`tr-v tr-v--${boxTone(b)}`}>{boxWord(b, "req")}</span>
                          <span className="tr-boxes__c">
                            {b.link ? (
                              <Link className="k-link" href={b.link}>
                                {b.claim}
                              </Link>
                            ) : (
                              <span>{b.claim}</span>
                            )}
                            <span className="k-small">{b.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>

              {/*
                The plan's Definition of Done, computed here rather than ticked by
                hand. Anything open is open in our own words.
              */}
              <details className="tr-fold" id="definition">
                <summary>
                  <span className="tr-fold__s">
                    <span className="tr-fold__t">Definition of done</span>
                    <span className="tr-fold__d">
                      {definition.length ? `${done.done} of ${done.total} true, ${done.partly} part way, ${done.open} not started${definitionAt ? `, ${ageOf(definitionAt)}` : ""}` : "Not computed yet on this deployment"}
                    </span>
                  </span>
                </summary>
                <div className="tr-fold__body">
                  {definition.length === 0 ? (
                    <p className="k-small">
                      The scheduled tick works this list out every five minutes and stores it. Until an external pinger is calling <span className="k-mono">/api/cron/tick</span>, this page can show the beats but not the whole definition.
                    </p>
                  ) : (
                    <ul className="tr-boxes">
                      {definition.map((b) => (
                        <li key={b.id}>
                          <span className={`tr-v tr-v--${boxTone(b)}`}>{boxWord(b, "def")}</span>
                          <span className="tr-boxes__c">
                            {b.link ? (
                              <Link className="k-link" href={b.link}>
                                {b.claim}
                              </Link>
                            ) : (
                              <span>{b.claim}</span>
                            )}
                            <span className="k-small">{b.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="tr-tail">
          <div className="k-wrap tr-tail__in">
            <p className="k-small">Every address these checks read is on Contracts.</p>
            <Link className="k-btn" href="/contracts">
              Contracts <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
