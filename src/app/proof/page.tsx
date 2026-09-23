import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import Source from "@/components/x/Source";
import Empty from "@/components/x/Empty";
import { readAdvantage, type TaskReport, type Verdict } from "@/lib/advantage/report";
import { snapshot, warm } from "@/lib/data/snapshots";
import type { GridWindow } from "@/lib/grid/window";
import { pauseForSlug } from "@/lib/market/paused";
import { referenceRegistrations } from "@/lib/house";
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

function Task({ t }: { t: TaskReport }) {
  return (
    <li className="x-task" data-verdict={t.verdict}>
      <div className="x-task__top">
        <span className="x-task__id x-mono">{t.id}</span>
        <span className="x-task__cat">{t.category}</span>
        <span className={`x-verdict x-verdict--${t.verdict}`}>{VERDICT_WORD[t.verdict]}</span>
      </div>
      <h3 className="x-task__t">{t.title}</h3>
      <p className="x-task__line">{t.line}</p>
      <details className="x-task__more">
        <summary>How it was measured</summary>
        <dl className="x-kv x-task__arms">
          <div>
            <dt>Doing it yourself</dt>
            <dd>{t.humanArm}</dd>
          </div>
          <div>
            <dt>The agent</dt>
            <dd>{t.agentArm}</dd>
          </div>
          <div>
            <dt>What was measured</dt>
            <dd>{t.metric}</dd>
          </div>
        </dl>
        {t.result ? <pre className="x-pre x-mono">{JSON.stringify(t.result, null, 2).slice(0, 4000)}</pre> : null}
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

  if (!r) {
    return (
      <AppShell>
        <section className="x-wrap x-mkt-head">
          <h1 className="x-mkt-head__h">Proof</h1>
        </section>
        <div className="x-wrap x-section--tight">
          <Empty title="The locked results are not readable on this deployment.">
            They are committed in the repository under docs/advantage. Rather than render a page of numbers it cannot open, this page says so.
          </Empty>
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
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Proof</h1>
          <p className="x-mkt-head__sub">Does hiring an agent beat doing it yourself? Six tasks, locked on chain before any of them ran.</p>
        </div>
        <p className="x-proof-lede">
          The specification for every task was written and hashed first, and the hash was sent to BNB Smart Chain. Each task measures the{" "}
          {r.windowBlocks.toLocaleString("en-GB")} blocks ending at the block that transaction landed in, so none of them could have been chosen after seeing the result.
        </p>
        <ul className="x-score" aria-label="Outcomes">
          <li className="x-score__item x-score__item--win">
            <span className="x-score__n x-mono">{counts.win}</span> won
          </li>
          <li className="x-score__item x-score__item--loss">
            <span className="x-score__n x-mono">{counts.loss}</span> lost
          </li>
          <li className="x-score__item x-score__item--mixed">
            <span className="x-score__n x-mono">{counts.mixed}</span> mixed
          </li>
          {counts.inconclusive ? (
            <li className="x-score__item">
              <span className="x-score__n x-mono">{counts.inconclusive}</span> not measurable
            </li>
          ) : null}
        </ul>
      </section>

      <section className="x-wrap x-section--tight" aria-labelledby="h-lock">
        <h2 id="h-lock" className="x-proof-h">The lock</h2>
        <dl className="x-kv x-lock">
          <div>
            <dt>Specification hash</dt>
            <dd className="x-mono">{anchor.specHash}</dd>
          </div>
          <div>
            <dt>Sent to the chain in</dt>
            <dd className="x-mono">
              <a className="x-link" href={bscTx(anchor.txHash)} target="_blank" rel="noreferrer">
                {anchor.txHash.slice(0, 18)}…{anchor.txHash.slice(-8)}
              </a>
            </dd>
          </div>
          <div>
            <dt>Window measured</dt>
            <dd className="x-mono">
              blocks {anchor.fromBlock.toLocaleString("en-GB")} to {anchor.anchorBlock.toLocaleString("en-GB")}
            </dd>
          </div>
        </dl>
        <Source kind="chain" block={anchor.anchorBlock} at={anchor.lockedAt} verb="locked">
          To check it, recompute the hash from <span className="x-mono">src/advantage/lock.ts</span> and compare it with the transaction&apos;s input, which carries the hash and
          nothing else.
        </Source>
      </section>

      <section className="x-wrap x-section--tight" aria-labelledby="h-tasks">
        <h2 id="h-tasks" className="x-proof-h">The six tasks</h2>
        <p className="x-ad-src">Each states what doing it yourself meant, what the agent did, and what was measured. The raw measurement is attached to each.</p>
        <ol className="x-tasks">
          {tasks.map((t) => (
            <Task key={t.id} t={t} />
          ))}
        </ol>
      </section>

      <section className="x-wrap x-section--tight" aria-labelledby="h-rerun">
        <h2 id="h-rerun" className="x-proof-h">Run it yourself, now</h2>
        <p className="x-ad-src">
          Three of the questions can be asked again of the chain as it is this second. The other three measure a 24,000 block window and need an archive node, so they stay as
          the locked results above.
        </p>
        <RerunPanel />
      </section>

      {grid ? (
        <section className="x-wrap x-section--tight" aria-labelledby="h-stakes">
          <h2 id="h-stakes" className="x-proof-h">The record with real money on it</h2>
          <div className="x-stakes" data-verdict={grid.pnlUsd < 0 ? "loss" : "win"}>
            <div className="x-task__top">
              <span className="x-task__id x-mono">Grid-1</span>
              <span className="x-task__cat">Grid trading, live on mainnet</span>
              <span className={`x-verdict x-verdict--${grid.pnlUsd < 0 ? "loss" : "win"}`}>{grid.pnlUsd < 0 ? "Lost to holding" : "Beat holding"}</span>
            </div>
            <p className="x-task__line">
              {grid.fills.length} real fills over {minutes === null ? "its window" : `${minutes} minutes`}, {usd(grid.pnlUsd)} against simply holding, net of{" "}
              {usd(grid.gasUsd)} in gas.
              {t2?.capitalBnb && typeof t2.netAdvantageBnb === "number" && fillWbnb && fillUsd && gasPerFill && gasShare !== null
                ? ` The locked test ran the same kind of ladder on paper with ${t2.capitalBnb} BNB and ${t2.netAdvantageBnb > 0 ? "beat" : "lost to"} holding. Live, each fill was about ${fillWbnb.toFixed(4)} WBNB, ${usd(fillUsd)}, and paid about ${usd(gasPerFill)} in gas, ${Math.round((gasPerFill / fillUsd) * 100)}% of the trade. Gas was ${gasShare}% of the loss.`
                : null}
            </p>
            {pause ? (
              <p className="x-stakes__pause">
                <strong>Paused since {pause.since}.</strong> {sentence(pause.reason.replace(/^Paused:\s*/, ""))}
              </p>
            ) : null}
            <dl className="x-kv x-stakes__kv">
              <div>
                <dt>Fills</dt>
                <dd className="x-mono">{grid.fills.length}</dd>
              </div>
              <div>
                <dt>Round trips won</dt>
                <dd className="x-mono">{grid.winRate === null ? "none closed" : `${grid.wins} of ${grid.roundTrips.length}`}</dd>
              </div>
              <div>
                <dt>Against holding</dt>
                <dd className="x-mono">{usd(grid.pnlUsd)}</dd>
              </div>
              <div>
                <dt>Gas paid</dt>
                <dd className="x-mono">{usd(grid.gasUsd)}</dd>
              </div>
            </dl>
            <p className="x-stakes__links">
              {gridToken ? (
                <Link className="x-link" href={`/agents/${gridToken}`}>
                  Grid-1&apos;s page
                </Link>
              ) : null}
              {grid.fills.length ? (
                <a className="x-link" href={bscTx(grid.fills[grid.fills.length - 1].tx)} target="_blank" rel="noreferrer">
                  Its last fill on BscScan
                </a>
              ) : null}
            </p>
            <Source kind="chain" block={grid.toBlock} at={grid.readAt}>
              Every Swapped event from SwapBound from block {grid.fromBlock.toLocaleString("en-GB")}. Check it with <span className="x-mono x-src__cmd">{grid.verify}</span>
            </Source>
          </div>
        </section>
      ) : null}

      <section className="x-wrap x-section--tight">
        <p className="x-ad-src">
          The generated report, with the full method, is{" "}
          <a className="x-link" href={`${REPO}/docs/AGENT_ADVANTAGE_REPORT.md`} target="_blank" rel="noreferrer">
            docs/AGENT_ADVANTAGE_REPORT.md
          </a>
          . It is written from the same results and the same sentences as this page, so the two cannot disagree. Failures by agents we paid are kept on{" "}
          <Link className="x-link" href="/graveyard">
            the graveyard
          </Link>
          .
        </p>
      </section>
    </AppShell>
  );
}
