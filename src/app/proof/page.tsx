import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Lock } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import { FOUNDERS } from "@/components/builders/house";
import Source from "@/components/x/Source";
import Empty from "@/components/x/Empty";
import TrustHead from "@/components/trust/TrustHead";
import { readAdvantage, type TaskReport, type Verdict } from "@/lib/advantage/report";
import { snapshot, warm } from "@/lib/data/snapshots";
import type { GridWindow } from "@/lib/grid/window";
import { pauseForSlug } from "@/lib/market/paused";
import { referenceRegistrations } from "@/lib/house";
import { viewMarket } from "@/lib/view/market";
import { poseOf } from "@/lib/view/state";
import { withTimeout } from "@/lib/cache";
import RerunPanel from "./RerunPanel";

export const metadata: Metadata = {
  title: "Proof | MANDATE",
  description: "Does hiring an agent beat doing it yourself? Six tasks, specified and hashed on BNB Smart Chain before any of them ran, with the losses at the same size as the wins.",
};

export const revalidate = 600;

const REPO = "https://github.com/iamdflame/mandate-bnb/blob/main";
const bscTx = (h: string) => `https://bscscan.com/tx/${h}`;
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(Math.abs(n) < 1 ? 3 : 2)}`;

const VERDICT_WORD: Record<Verdict, string> = {
  win: "The agent won",
  loss: "The agent lost",
  mixed: "Mixed",
  inconclusive: "Not measurable",
};
const TONE: Record<Verdict, string> = { win: "pass", loss: "fail", mixed: "warn", inconclusive: "none" };
/** The job family each task belongs to, for its drawing; security tasks have none. */
const JOB: Record<string, string | null> = { Rebalancing: "rebalancing", Grid: "grid-trading", Yield: "yield-optimisation", "Health Factor": "health-factor" };

function Task({ t, i }: { t: TaskReport; i: number }) {
  return (
    <li className="tr-task" data-verdict={t.verdict} style={{ ["--i" as string]: i }}>
      <div className="tr-task__top">
        <span className="tr-task__id k-num">{t.id}</span>
        <span className="tr-task__cat">{t.category}</span>
        <span className={`tr-v tr-v--${TONE[t.verdict]}`}>{VERDICT_WORD[t.verdict]}</span>
      </div>
      <h3 className="tr-task__t">{t.title}</h3>
      <p className="tr-task__line">{t.line}</p>
      <details className="tr-task__more">
        <summary>How it was measured</summary>
        <dl className="tr-arms">
          <div>
            <dt>Doing it yourself</dt>
            <dd>{t.humanArm}</dd>
          </div>
          <div>
            <dt>The agent</dt>
            <dd>{t.agentArm}</dd>
          </div>
          <div className="tr-arms__wide">
            <dt>What was measured</dt>
            <dd>{t.metric}</dd>
          </div>
        </dl>
        {t.result ? (
          <details className="tr-raw">
            <summary>The raw measurement</summary>
            <pre className="k-code">{JSON.stringify(t.result, null, 2).slice(0, 4000)}</pre>
          </details>
        ) : null}
      </details>
    </li>
  );
}

/**
 * The advantage lab.
 *
 * The question a buyer actually has is whether hiring beats doing it
 * themselves, and the only honest way to answer it is to say what will be
 * measured before measuring it. The specification for all six tasks was
 * written, hashed, and the hash put in a BNB Smart Chain transaction; every
 * task measures the 24,000 blocks ending at the block that transaction landed
 * in. So the tasks could not have been picked after the results were known,
 * and anyone can check that by hashing the spec and reading the calldata.
 *
 * The losses are printed at the same size as the wins, and the highest-stakes
 * record on the site, Grid-1 losing to holding with real money, is on this
 * page rather than buried on its own. A report where the agent wins
 * everything is a report nobody should believe.
 */
export default async function ProofPage() {
  const r = readAdvantage();
  await warm(["grid-window"]).catch(() => undefined);
  const grid = snapshot<GridWindow>("grid-window")?.payload ?? null;
  const pause = pauseForSlug("grid-1");
  const gridToken = referenceRegistrations()["grid-1"]?.tokenId ?? null;
  // Grid-1 is drawn in the pose our last call found, never one chosen for the page.
  const gridCard = gridToken ? ((await withTimeout(viewMarket({ view: "all", q: "Grid-1", limit: 10 }).catch(() => null), 6_000))?.agents.find((a) => a.tokenId === gridToken) ?? null) : null;

  if (!r) {
    return (
      <AppShell>
        <div className="tr">
          <TrustHead title="Proof" lede="Does hiring an agent beat doing it yourself? Six tasks, locked on chain before any of them ran." />
          <div className="k-wrap tr-sec tr-sec--first">
            <Empty title="The locked results are not readable on this deployment." job="grid-trading">
              They are committed in the repository under docs/advantage. Rather than render a page of numbers it cannot open, this page says so.
            </Empty>
          </div>
        </div>
      </AppShell>
    );
  }

  const { anchor, tasks, counts } = r;
  const t2 = tasks.find((t) => t.id === "T2")?.result as { capitalBnb?: number; netAdvantageBnb?: number } | undefined;
  // Per fill: its size, its gas, and the gas as a share of the trade. All from the same window.
  const n = grid?.fills.length ?? 0;
  const fillWbnb = n ? grid!.fills.reduce((s, f) => s + f.wbnb, 0) / n : null;
  const fillUsd = n ? grid!.fills.reduce((s, f) => s + f.usdt, 0) / n : null;
  const gasPerFill = n ? grid!.gasUsd / n : null;
  const gasShare = grid && grid.pnlUsd < 0 ? Math.min(100, Math.round((grid.gasUsd / -grid.pnlUsd) * 100)) : null;
  const minutes = grid?.window.hours ? Math.round(grid.window.hours * 60) : null;

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          title="Does hiring an agent beat doing it yourself?"
          lede="Six tasks, specified and hashed on BNB Smart Chain before any of them ran. The losses are printed as large as the wins."
          art={
            <figure className="tr-board" aria-label={`${counts.win} won, ${counts.loss} lost, ${counts.mixed} mixed${counts.inconclusive ? `, ${counts.inconclusive} not measurable` : ""}`}>
              <span className="tr-board__seal" aria-hidden="true">
                <Lock size={16} strokeWidth={2.4} />
                <span className="k-num">block {anchor.anchorBlock.toLocaleString("en-GB")}</span>
              </span>
              <ol className="tr-board__grid" aria-hidden="true">
                {tasks.map((t, i) => (
                  <li key={t.id} className="tr-board__cell" data-verdict={t.verdict} style={{ ["--i" as string]: i }}>
                    <span className="tr-board__id k-num">{t.id}</span>
                    {JOB[t.category] ? (
                      <span className="tr-board__who">
                        <Agent job={JOB[t.category]} seed={FOUNDERS.find((f) => f.job === JOB[t.category])?.id ?? `proof-${t.id}`} house={FOUNDERS.some((f) => f.job === JOB[t.category])} size={48} state={t.verdict === "win" ? "delivered" : "awake"} slot={`board${i}`} />
                      </span>
                    ) : null}
                    <span className="tr-board__v">{t.verdict === "win" ? "won" : t.verdict === "loss" ? "lost" : t.verdict === "mixed" ? "mixed" : "not measurable"}</span>
                    <span className="tr-board__cat">{t.category}</span>
                  </li>
                ))}
              </ol>
              <figcaption className="tr-board__sum">
                <span data-v="win">
                  <strong className="k-num">{counts.win}</strong> won
                </span>
                <span data-v="loss">
                  <strong className="k-num">{counts.loss}</strong> lost
                </span>
                <span data-v="mixed">
                  <strong className="k-num">{counts.mixed}</strong> mixed
                </span>
                {counts.inconclusive ? (
                  <span>
                    <strong className="k-num">{counts.inconclusive}</strong> not measurable
                  </span>
                ) : null}
              </figcaption>
            </figure>
          }
        />

        <section className="tr-sec tr-sec--first" aria-labelledby="h-lock">
          <div className="k-wrap">
            <div className="tr-lock k-panel">
              <span className="tr-lock__icon" aria-hidden="true">
                <Lock size={22} strokeWidth={2.2} />
              </span>
              <div className="tr-lock__copy">
                <h2 id="h-lock" className="k-h3">
                  Locked before it ran.
                </h2>
                <p className="k-body">
                  The specification for every task was hashed and the hash sent to the chain. Each task measures the {r.windowBlocks.toLocaleString("en-GB")} blocks ending where that transaction landed, so none could be chosen after seeing its result.
                </p>
              </div>
              <dl className="k-facts tr-lock__facts">
                <div>
                  <dt>Specification hash</dt>
                  <dd className="k-mono">{anchor.specHash}</dd>
                </div>
                <div>
                  <dt>Sent to the chain in</dt>
                  <dd className="k-mono">
                    <a className="tr-addr" href={bscTx(anchor.txHash)} target="_blank" rel="noreferrer">
                      {anchor.txHash.slice(0, 18)}…{anchor.txHash.slice(-8)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Window measured</dt>
                  <dd className="k-num">
                    blocks {anchor.fromBlock.toLocaleString("en-GB")} to {anchor.anchorBlock.toLocaleString("en-GB")}
                  </dd>
                </div>
              </dl>
              <div className="tr-lock__src">
                <Source kind="chain" block={anchor.anchorBlock} at={anchor.lockedAt} verb="locked">
                  To check it, recompute the hash from <span className="k-mono">src/advantage/lock.ts</span> and compare it with the transaction&apos;s input, which carries the hash and nothing else.
                </Source>
              </div>
            </div>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="h-tasks">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-tasks" className="k-h2">
                  The six tasks.
                </h2>
                <p className="k-body">Each states what doing it yourself meant, what the agent did, and what was measured. The raw measurement is one tap away.</p>
              </div>
            </div>
            <ol className="tr-tasks">
              {tasks.map((t, i) => (
                <Task key={t.id} t={t} i={i} />
              ))}
            </ol>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="h-rerun">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-rerun" className="k-h2">
                  Run it yourself, now.
                </h2>
                <p className="k-body">Three of the questions can be asked again of the chain as it is this second. The other three measure a 24,000 block window and need an archive node, so they stay as locked above.</p>
              </div>
            </div>
            <RerunPanel />
          </div>
        </section>

        {grid ? (
          <section className="tr-sec" aria-labelledby="h-stakes">
            <div className="k-wrap">
              <div className="k-shead">
                <div className="k-shead__copy">
                  <h2 id="h-stakes" className="k-h2">
                    The record with real money on it.
                  </h2>
                </div>
              </div>
              <div className="tr-stakes k-panel" data-verdict={grid.pnlUsd < 0 ? "loss" : "win"}>
                <div className="tr-stakes__who">
                  {gridCard ? (
                    <span className="tr-stakes__art" aria-hidden="true">
                      <Agent job="grid-trading" seed={gridCard.tokenId} house size={132} state={poseOf(gridCard)} slot="stakes" />
                    </span>
                  ) : null}
                  <div>
                    <p className="tr-stakes__name">Grid-1</p>
                    <p className="k-small">Grid trading, live on mainnet</p>
                  </div>
                </div>
                <div className="tr-stakes__main">
                  <div className="tr-stakes__head">
                    <span className={`tr-v tr-v--${grid.pnlUsd < 0 ? "fail" : "pass"}`}>{grid.pnlUsd < 0 ? "Lost to holding" : "Beat holding"}</span>
                    <span className={`tr-stakes__pnl k-num${grid.pnlUsd < 0 ? " tr-stakes__pnl--loss" : ""}`}>{usd(grid.pnlUsd)}</span>
                    <span className="k-small">against simply holding, net of gas</span>
                  </div>
                  <p className="k-body">
                    {grid.fills.length} real fills over {minutes === null ? "its window" : `${minutes} minutes`}, {usd(grid.pnlUsd)} against simply holding, net of {usd(grid.gasUsd)} in gas.
                    {t2?.capitalBnb && typeof t2.netAdvantageBnb === "number" && fillWbnb && fillUsd && gasPerFill && gasShare !== null
                      ? ` The locked test ran the same kind of ladder on paper with ${t2.capitalBnb} BNB and ${t2.netAdvantageBnb > 0 ? "beat" : "lost to"} holding. Live, each fill was about ${fillWbnb.toFixed(4)} WBNB, ${usd(fillUsd)}, and paid about ${usd(gasPerFill)} in gas, ${Math.round((gasPerFill / fillUsd) * 100)}% of the trade. Gas was ${gasShare}% of the loss.`
                      : null}
                  </p>
                  {pause ? (
                    <p className="k-note k-note--warn">
                      <span>
                        <strong>Paused since {pause.since}.</strong> {sentence(pause.reason.replace(/^Paused:\s*/, ""))}
                      </span>
                    </p>
                  ) : null}
                  <ul className="tr-figs tr-stakes__figs">
                    <li className="k-fig">
                      <span className="k-fig__n k-num">{grid.fills.length}</span>
                      <span className="k-fig__l">fills</span>
                    </li>
                    <li className="k-fig">
                      <span className="k-fig__n k-num">{grid.winRate === null ? "none closed" : `${grid.wins} of ${grid.roundTrips.length}`}</span>
                      <span className="k-fig__l">round trips won</span>
                    </li>
                    <li className={`k-fig${grid.pnlUsd < 0 ? " tr-fig--err" : ""}`}>
                      <span className="k-fig__n k-num">{usd(grid.pnlUsd)}</span>
                      <span className="k-fig__l">against holding</span>
                    </li>
                    <li className="k-fig">
                      <span className="k-fig__n k-num">{usd(grid.gasUsd)}</span>
                      <span className="k-fig__l">gas paid</span>
                    </li>
                  </ul>
                  <div className="k-row">
                    {gridToken ? (
                      <Link className="k-btn k-btn--sm" href={`/agents/${gridToken}`}>
                        Grid-1&apos;s page
                      </Link>
                    ) : null}
                    {grid.fills.length ? (
                      <a className="k-btn k-btn--sm k-btn--ghost" href={bscTx(grid.fills[grid.fills.length - 1].tx)} target="_blank" rel="noreferrer">
                        Its last fill on BscScan
                      </a>
                    ) : null}
                  </div>
                  <Source kind="chain" block={grid.toBlock} at={grid.readAt}>
                    Every Swapped event from SwapBound from block {grid.fromBlock.toLocaleString("en-GB")}. Check it with <span className="k-mono">{grid.verify}</span>
                  </Source>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="tr-tail">
          <div className="k-wrap tr-tail__in">
            <p className="k-small">
              The generated report, with the full method, is{" "}
              <a className="k-link" href={`${REPO}/docs/AGENT_ADVANTAGE_REPORT.md`} target="_blank" rel="noreferrer">
                docs/AGENT_ADVANTAGE_REPORT.md
              </a>
              , written from the same results and the same sentences as this page, so the two cannot disagree.
            </p>
            <Link className="k-btn" href="/graveyard">
              Failures by agents we paid <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
