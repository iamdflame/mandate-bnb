/**
 * The advantage lab, read once and rendered anywhere.
 *
 * The method is the valuable part and it is unusual: the specification for
 * every task was written first, hashed, and the hash sent to BNB Smart Chain
 * in a transaction, before a single measurement ran. The window each task
 * measures is the 24,000 blocks ending at the block that transaction landed
 * in. So the tasks cannot have been chosen after seeing which ones we won,
 * and anybody can check that by hashing the spec themselves and comparing it
 * to the calldata.
 *
 * The verdicts below used to live inside the report generator script, which
 * meant a page rendering the same results would have had to restate them and
 * could have drifted from the markdown. They live here now and the script
 * imports them, so there is one sentence per task in the whole codebase.
 *
 * Two of the six are losses and one is mixed. They stay exactly as prominent
 * as the wins, because a report where the agent wins everything is a report
 * nobody should believe.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Verdict = "win" | "loss" | "mixed" | "inconclusive";

export interface Anchor {
  specHash: string;
  txHash: string;
  anchorBlock: number;
  anchorTimestamp: number;
  fromBlock: number;
  gasPriceWei: string;
  lockedAt: string;
}

export interface SpecTask {
  id: string;
  title: string;
  category: string;
  humanArm: string;
  agentArm: string;
  metric: string;
  inputs?: Record<string, unknown>;
}

export interface TaskReport {
  id: string;
  title: string;
  category: string;
  humanArm: string;
  agentArm: string;
  metric: string;
  verdict: Verdict;
  /** One sentence, the same one the markdown report prints. */
  line: string;
  /** The raw measurement, for the reader who wants to check the sentence. */
  result: Record<string, unknown> | null;
}

export interface AdvantageReading {
  anchor: Anchor;
  tasks: TaskReport[];
  counts: Record<Verdict, number>;
  windowBlocks: number;
}

const root = () => process.cwd();

function readJson<T>(rel: string): T | null {
  try {
    return JSON.parse(readFileSync(join(root(), rel), "utf8")) as T;
  } catch {
    return null;
  }
}

const n = (v: number, d = 2) => v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number, d = 1) => `${n(v, d)}%`;

/**
 * One sentence per task, computed from the measurement rather than written.
 *
 * Kept as functions so a result that is missing says "not run" instead of
 * rendering a claim about numbers nobody took.
 */
export function verdictFor(id: string, r: Record<string, unknown> | null): { verdict: Verdict; line: string } {
  const t = r as never as Record<string, number & string>;
  if (!r) return { verdict: "inconclusive", line: "Not run in this window." };

  switch (id) {
    case "T1":
      return {
        verdict: "loss",
        line: `Loss. ${t.pastTrigger} of ${t.sampled} sampled positions were past the agent's trigger, and the one that crossed it during the window recovered unaided.`,
      };
    case "T2":
      return {
        verdict: Number(t.netAdvantageBnb) > 0 ? "win" : "loss",
        line: `${Number(t.netAdvantageBnb) > 0 ? "Win." : "Loss."} ${n(Number(t.netAdvantageBnb), 8)} BNB against holding over a ${n(Number(t.trendPct), 2)}% window, with gas and pool fees charged against the agent.`,
      };
    case "T3":
      return {
        verdict: "mixed",
        line: `Mixed. The locked metric turned out to be unusable and is published anyway. On the ${(t.liquid as unknown as { count: number })?.count} markets deep enough to supply into, the spread is ${n((t.liquid as unknown as { spreadPct: number })?.spreadPct, 2)} points and rotation repays its gas above $${n(Number(t.breakEvenUsd), 2)}.`,
      };
    case "T4":
      return {
        verdict: "win",
        line: `Win. Being early costs $${n(Number(t.repayGasUsd), 4)}. Being late costs ${pct(Number(t.penaltyPct))} of seized collateral, which is ${Math.round(Number(t.ratio)).toLocaleString("en-GB")} times more on the worked example.`,
      };
    case "T5":
      return {
        verdict: "mixed",
        line: `Win on correctness, loss on coverage. ${t.contradicted} of ${t.sampled} cards were contradicted by the chain, but ${t.inconclusiveChecks} checks could not be answered at all.`,
      };
    case "T6":
      return {
        verdict: "win",
        line: `Win. ${Number(t.feedbacksAnalysed).toLocaleString("en-GB")} feedbacks from ${t.distinctReviewers} wallets, and ${pct(Number(t.flaggedShareOfFeedback))} of them were written by the ${t.flaggedReviewers} wallets flagged as coordinated.`,
      };
    default:
      return { verdict: "inconclusive", line: "No verdict is defined for this task." };
  }
}

export function readAdvantage(): AdvantageReading | null {
  const lock = readJson<{ anchor: Anchor; specification: { windowBlocks: number; tasks: SpecTask[] } }>("docs/advantage/INPUT_LOCK.json");
  if (!lock) return null;

  const tasks: TaskReport[] = lock.specification.tasks.map((spec) => {
    const result = readJson<Record<string, unknown>>(`docs/advantage/results/${spec.id}.json`);
    const { verdict, line } = verdictFor(spec.id, result);
    return {
      id: spec.id,
      title: spec.title,
      category: spec.category,
      humanArm: spec.humanArm,
      agentArm: spec.agentArm,
      metric: spec.metric,
      verdict,
      line,
      result,
    };
  });

  const counts = tasks.reduce(
    (acc, t) => ({ ...acc, [t.verdict]: (acc[t.verdict] ?? 0) + 1 }),
    { win: 0, loss: 0, mixed: 0, inconclusive: 0 } as Record<Verdict, number>,
  );

  return { anchor: lock.anchor, tasks, counts, windowBlocks: lock.specification.windowBlocks };
}
