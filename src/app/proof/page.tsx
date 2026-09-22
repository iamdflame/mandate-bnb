import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import { SourceChip } from "@/components/v2/ui/SourceChip";
import { readAdvantage, type TaskReport } from "@/lib/advantage/report";
import RerunPanel from "./RerunPanel";

export const metadata: Metadata = {
  title: "Proof | Mandate",
  description:
    "Does hiring an agent beat doing it yourself? Six tasks, specified and hashed on chain before any of them ran. Two are losses.",
};

export const revalidate = 600;

const VERDICT_WORD: Record<string, string> = {
  win: "The agent won",
  loss: "The agent lost",
  mixed: "Mixed",
  inconclusive: "Not measurable",
};

function Task({ t }: { t: TaskReport }) {
  return (
    <li className="m-task" data-verdict={t.verdict}>
      <div className="m-task__head">
        <span className="m-mono m-task__id">{t.id}</span>
        <h3 className="m-task__t">{t.title}</h3>
        <span className="m-task__v">{VERDICT_WORD[t.verdict]}</span>
      </div>
      <p className="m-task__line">{t.line}</p>
      <dl className="m-task__arms">
        <div>
          <dt className="m-label">Doing it yourself</dt>
          <dd>{t.humanArm}</dd>
        </div>
        <div>
          <dt className="m-label">The agent</dt>
          <dd>{t.agentArm}</dd>
        </div>
        <div>
          <dt className="m-label">What was measured</dt>
          <dd>{t.metric}</dd>
        </div>
      </dl>
      {t.result ? (
        <details className="m-disclose">
          <summary>The raw measurement</summary>
          <div className="m-disclose__body">
            <pre className="m-pre m-mono">{JSON.stringify(t.result, null, 2).slice(0, 4000)}</pre>
          </div>
        </details>
      ) : null}
    </li>
  );
}

/**
 * The advantage lab.
 *
 * The question a buyer actually has is whether hiring beats doing it
 * themselves, and the only honest way to answer it is to say what you will
 * measure before you measure it. So the specification for all six tasks was
 * written, hashed, and the hash put in a BNB Smart Chain transaction. Every
 * task measures the 24,000 blocks ending at the block that transaction landed
 * in. The tasks could not have been picked after the results were known, and
 * anyone can verify that by hashing the spec and reading the calldata.
 *
 * Two tasks are losses and one is mixed, at the same size as the wins. A
 * report where the agent wins everything is a report nobody should believe,
 * and the first thing a careful reader looks for is whether the losses are
 * there.
 */
export default function ProofPage() {
  const r = readAdvantage();

  if (!r) {
    return (
      <AppShell>
        <section className="m-wrap m-section">
          <h1 className="m-h1">Proof</h1>
          <div className="m-empty">
            <p className="m-empty__h">The locked results are not readable on this deployment.</p>
            <p className="m-empty__p">
              They are committed in the repository under docs/advantage. Rather than render a page of numbers we
              cannot currently open, this says so.
            </p>
          </div>
        </section>
      </AppShell>
    );
  }

  const { anchor, tasks, counts } = r;

  return (
    <AppShell>
      <section className="m-wrap m-section">
        <h1 className="m-h1">Does hiring beat doing it yourself?</h1>
        <p className="m-lede m-lede--wide">
          Six tasks. The specification for all of them was written and hashed before any measurement ran, and the
          hash was sent to BNB Smart Chain. Every task measures the {r.windowBlocks.toLocaleString("en-GB")} blocks
          ending at the block that transaction landed in, so nothing here could have been chosen after the fact.
        </p>

        <div className="m-lock">
          <div className="m-lock__row">
            <span className="m-label">Specification hash</span>
            <span className="m-mono m-lock__v">{anchor.specHash}</span>
          </div>
          <div className="m-lock__row">
            <span className="m-label">Committed in</span>
            <a className="m-link m-mono m-lock__v" href={`https://bscscan.com/tx/${anchor.txHash}`} target="_blank" rel="noreferrer">
              {anchor.txHash}
            </a>
          </div>
          <div className="m-lock__row">
            <span className="m-label">Window measured</span>
            <span className="m-mono m-lock__v">
              blocks {anchor.fromBlock.toLocaleString("en-GB")} to {anchor.anchorBlock.toLocaleString("en-GB")}
            </span>
          </div>
          <SourceChip source="chain" block={anchor.anchorBlock} at={anchor.lockedAt} note="Hash the spec and compare it to the transaction input." />
        </div>

        <p className="m-scoreline">
          <span className="m-scoreline__n m-mono">{counts.win}</span> won{" · "}
          <span className="m-scoreline__n m-mono">{counts.loss}</span> lost{" · "}
          <span className="m-scoreline__n m-mono">{counts.mixed}</span> mixed
        </p>
        <p className="m-note">
          The losses are printed at the same size as the wins. T1 is a loss for our own rebalancing agent and T2 is
          the grid book losing to doing nothing, which is why that book is now paused.
        </p>
      </section>

      {/* ------------------------------------------------------- re-runnable */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h2 className="m-h2">Run it yourself, now</h2>
          <p className="m-head__note">
            Three of these can be re-run live from this page against the chain as it is this second. The other three
            measure a 24,000 block window and need an archive node, so they stay as the locked results above.
          </p>
        </div>
        <RerunPanel />
      </section>

      {/* ------------------------------------------------------------ tasks */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h2 className="m-h2">The six tasks</h2>
          <p className="m-head__note">
            Each one states what the human arm was, what the agent arm was, and what was measured. The raw
            measurement is attached.
          </p>
        </div>
        <ol className="m-tasks">
          {tasks.map((t) => (
            <Task key={t.id} t={t} />
          ))}
        </ol>
      </section>

      <section className="m-wrap m-section">
        <p className="m-note">
          The generated report, with the full method, is in the repository as docs/AGENT_ADVANTAGE_REPORT.md. It is
          produced from the same results and the same sentences as this page, so the two cannot disagree.{" "}
          <Link className="m-link" href="/evidence">
            The rest of the method
          </Link>
          .
        </p>
      </section>
    </AppShell>
  );
}
