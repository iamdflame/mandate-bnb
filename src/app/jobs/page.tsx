import Link from "next/link";
import { EPOCHS_FROM } from "@/lib/market/epochs";
import type { Metadata } from "next";
import { formatEther } from "viem";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import AgentCard from "@/components/k/AgentCard";
import PageHead from "@/components/k/PageHead";
import None from "@/components/account/None";
import Empty from "@/components/x/Empty";
import JobTile from "@/components/x/JobTile";
import Ago from "@/components/x/Ago";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { mandatePath } from "@/lib/chain/deployments";
import { marketState, type MarketMandate } from "@/lib/market/market-state";
import { hireCounts, OPERATED_WALLETS } from "@/lib/market/hires";
import { viewTakers } from "@/lib/view/jobs";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "Jobs | MANDATE",
  description: "Jobs on BNB Smart Chain waiting for an agent, the ones running now, and the agents that take them. Every bid is backed by a bond the agent can lose.",
};

export const revalidate = 60;
export const maxDuration = 60;

const STATE = ["Open", "Running", "Finished", "Cancelled", "Ended early"] as const;
const bnb = (wei: string | bigint, dp = 4) => `${Number(formatEther(BigInt(wei))).toFixed(dp)} BNB`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const catOf = (m: MarketMandate) => CATEGORIES[m.category] ?? null;
const titleOf = (m: MarketMandate) => `${catOf(m) ? CATEGORY_LABEL[catOf(m)!] : "Mandate"} job #${m.id}`;

/**
 * The job side of the marketplace.
 *
 * A job is capital a buyer puts to work under an agent that stakes a bond
 * against beating a benchmark. This page shows the jobs waiting for an agent
 * as cards with the bid one click away, the jobs running now with how far
 * through their term they are and how they are doing against the benchmark,
 * and the agents that take jobs. Everything is read from the contract as the
 * page renders; there is no "agents watching" or other figure the chain does
 * not hold.
 */
export default async function JobsPage() {
  await live();
  const state = await marketState().catch(() => null);
  const hc = await hireCounts();
  const takers = viewTakers(hc, 8);

  const all = state?.mandates ?? [];
  const open = all.filter((m) => m.canonical && m.state === 0);
  // Books left on contracts we replaced still read as "running" there, but
  // nothing will ever settle them, so they belong with the history.
  // Our own September tests are halted, not running: the clock leaves them as they stand (see lib/market/epochs).
  const halted = (m: (typeof all)[number]) => m.canonical && m.state === 1 && m.id < EPOCHS_FROM;
  const running = all.filter((m) => m.canonical && m.state === 1 && !halted(m));
  const over = all.filter((m) => m.state >= 2 || (!m.canonical && m.state === 1) || halted(m));

  const pose = (m: MarketMandate) => (m.state === 1 && !halted(m) && m.canonical ? "working" : m.state === 0 ? "ready" : "dozing");
  const signed = (m: MarketMandate) => {
    const alpha = m.cumulativeAlphaBps / 100;
    return m.epochsSettled ? `${alpha >= 0 ? "+" : "−"}${Math.abs(alpha).toFixed(2)}%` : null;
  };

  return (
    <AppShell>
      <PageHead
        crumbs={[{ href: "/activity", label: "Live" }]}
        title="Jobs with capital"
        lede="Capital put to work by an agent that stakes a bond it loses if it falls short."
        agent={{ job: "grid-trading", seed: "jobs-board", state: "working" }}
        source={
          state ? (
            <>
              <span className="k-dot k-dot--live" aria-hidden="true" /> BNB Smart Chain, block {Number(state.blockNumber).toLocaleString("en-GB")}, <Ago iso={state.at} prefix="read" />
            </>
          ) : (
            "The chain did not answer this time"
          )
        }
      >
        {state ? (
          <div className="k-figs ac-jb__figs k-rise" style={{ ["--i" as string]: 4 }}>
            <div className="k-fig">
              <span className="k-fig__n">{open.length}</span>
              <span className="k-fig__l">open for bids</span>
            </div>
            <div className="k-fig">
              <span className="k-fig__n">{running.length}</span>
              <span className="k-fig__l">running now</span>
            </div>
            <div className="k-fig">
              <span className="k-fig__n">{state.totals.opened}</span>
              <span className="k-fig__l">ever opened</span>
            </div>
          </div>
        ) : null}
        {state ? (
          <p className="k-small">
            {bnb(state.totals.underMandateWei)} under mandate, {bnb(state.totals.bondedWei, 5)} of bonds at stake. The amounts are small, and most of the books are held by wallets we operate.
          </p>
        ) : null}
        {state?.unread.length ? (
          <p className="k-small">
            {state.unread.join(", ")} did not answer, so {state.unread.length === 1 ? "its" : "their"} jobs are missing from these figures rather than counted as zero.
          </p>
        ) : null}
      </PageHead>

      {/* -------------------------------------------------------- open jobs */}
      <section className="k-wrap ac-sec" aria-labelledby="h-open">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2" id="h-open">
              Open for bids
            </h2>
            <p className="k-body">Any wallet can bid. The bond is what makes a stranger&rsquo;s bid believable.</p>
          </div>
        </div>
        {!state ? (
          <Empty title="The market could not be read just now" job="grid-trading" pose="dozing">
            That is our node failing, not the market. Reload in a moment.
          </Empty>
        ) : open.length ? (
          <div className="ac-jobgrid">
            {open.map((m, i) => (
              <JobTile key={m.id} m={m} title={titleOf(m)} viewHref={mandatePath(m.deploymentAddress, m.id)} art={<Agent job={catOf(m)} seed={`job:${m.id}`} size={104} state="ready" slot={`open${i}`} />} />
            ))}
          </div>
        ) : (
          <Empty
            title="No open jobs right now"
            job="yield-optimisation"
            pose="ready"
            action={
              <>
                <Link href="/agents?rail=job" className="k-btn k-btn--primary">
                  Create a job
                </Link>
                {running.length ? (
                  <a href="#running" className="k-btn k-btn--ghost">
                    See running jobs
                  </a>
                ) : null}
              </>
            }
          >
            A job appears here the moment someone commits capital to one, and any wallet can bid on it. Start one by choosing an agent that takes jobs.
          </Empty>
        )}
      </section>

      {/* ---------------------------------------------------------- running */}
      <section className="k-wrap ac-sec" aria-labelledby="h-running" id="running">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2" id="h-running">
              Running now
            </h2>
            <p className="k-body">Marked against the benchmark every hour, on chain.</p>
          </div>
        </div>
        {running.length ? (
          <ol className="ac-jruns">
            {running.map((m, i) => {
              const pct = m.epochsTotal ? Math.min(100, Math.round((m.epochsSettled / m.epochsTotal) * 100)) : 0;
              const alpha = m.cumulativeAlphaBps / 100;
              const ours = OPERATED_WALLETS.has(m.agent.toLowerCase());
              return (
                <li key={`${m.deployment}-${m.id}`} className="ac-jrun" data-job={catOf(m) ?? undefined}>
                  <span className="ac-jrun__art" aria-hidden="true">
                    <Agent job={catOf(m)} seed={`job:${m.id}`} size={56} state={pose(m)} slot={`run${i}`} />
                  </span>
                  <span className="ac-jrun__main">
                    <Link href={mandatePath(m.deploymentAddress, m.id)} className="ac-jrun__t">
                      {titleOf(m)}
                    </Link>
                    <span className="k-small">
                      <span className="k-num">{bnb(m.capitalWei)}</span>, held by <span className="k-mono">{short(m.agent)}</span>
                      {ours ? " (one of ours)" : ""}
                      {m.canonical ? "" : `, on ${m.deployment}`}
                    </span>
                  </span>
                  <span className="ac-jrun__prog">
                    <span className="ac-run__bar" aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="k-small k-num">
                      Hour {m.epochsSettled} of {m.epochsTotal}
                    </span>
                  </span>
                  <span className={`ac-alpha k-num${m.epochsSettled ? (alpha >= 0 ? " ac-alpha--up" : " ac-alpha--down") : ""}`}>{signed(m) ?? "None yet"}</span>
                  <span className="k-small">{m.strikes ? `${m.strikes} strike${m.strikes === 1 ? "" : "s"}` : "No strikes"}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <None job="rebalancing" seed="jobs-running">
            Nothing is running right now.
          </None>
        )}

        {over.length ? (
          <details className="ac-more ac-jb__over">
            <summary>
              <span className="ac-more__t">Finished, cancelled and on earlier contracts</span>
              <span className="ac-more__n">{over.length}</span>
            </summary>
            <div className="ac-more__body">
              <ol className="ac-jruns">
                {over.map((m, i) => {
                  const alpha = m.cumulativeAlphaBps / 100;
                  return (
                    <li key={`${m.deployment}-${m.id}`} className="ac-jrun ac-jrun--over" data-job={catOf(m) ?? undefined}>
                      <span className="ac-jrun__art" aria-hidden="true">
                        <Agent job={catOf(m)} seed={`job:${m.id}`} size={44} state="dozing" slot={`over${i}`} />
                      </span>
                      <span className="ac-jrun__main">
                        <Link href={mandatePath(m.deploymentAddress, m.id)} className="ac-jrun__t">
                          {titleOf(m)}
                        </Link>
                        <span className="k-small">
                          {halted(m) ? "Our own test, halted in September" : m.canonical ? (STATE[m.state] ?? `State ${m.state}`) : `Left on ${m.deployment}, a contract we replaced`}, <span className="k-num">{bnb(m.capitalWei)}</span>
                        </span>
                      </span>
                      <span className="k-small k-num">
                        {m.epochsSettled} of {m.epochsTotal} hours
                      </span>
                      <span className={`ac-alpha k-num${m.epochsSettled ? (alpha >= 0 ? " ac-alpha--up" : " ac-alpha--down") : ""}`}>{signed(m) ?? "None settled"}</span>
                      <span className="k-small">{m.strikes ? `${m.strikes} strike${m.strikes === 1 ? "" : "s"}` : ""}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </details>
        ) : null}
      </section>

      {/* ----------------------------------------------------------- takers */}
      <section className="k-wrap ac-sec" aria-labelledby="h-takers">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2" id="h-takers">
              Agents that take jobs
            </h2>
            <p className="k-body">These take jobs with capital in this market, with a bond behind every bid.</p>
          </div>
          <Link href="/agents?rail=job" className="k-btn k-btn--ghost">
            All of them <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
          </Link>
        </div>
        {takers.length ? (
          <ul className="ac-takers">
            {takers.map((a, i) => (
              <li key={a.tokenId}>
                <AgentCard a={a} i={i} slot={`tk${i}`} />
              </li>
            ))}
          </ul>
        ) : (
          <None job="health-factor" seed="jobs-takers">
            No agent takes jobs in this market yet.
          </None>
        )}
      </section>

      <section className="k-wrap ac-sec">
        <div className="ac-seller">
          <div className="ac-seller__art" aria-hidden="true">
            <Agent job="grid-trading" seed="seller-bond" size={96} state="awake" slot="seller" />
          </div>
          <div className="k-stack" style={{ ["--gap" as string]: "8px" }}>
            <h2 className="k-h3">Run an agent?</h2>
            <p className="k-small">Bid on an open job by naming the return you will beat the benchmark by and staking BNB against it. A quarter of the bond is taken for every hour you fall behind, and all of it comes back if you serve the term.</p>
          </div>
          <Link href="/list" className="k-btn">
            List your agent
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
