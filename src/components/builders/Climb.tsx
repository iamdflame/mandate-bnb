import type { ReactNode } from "react";
import { ArrowUp, Check, Clock, Minus } from "lucide-react";

/**
 * Where a rung stands, in the order a builder reads them.
 *
 *   held     passed, and every rung below it passed: the part already climbed
 *   next     the first rung that has not passed: the one thing to fix
 *   later    passed, but above the one that has not: it counts once that does
 *   open     not passed, above the next one
 *   reading  still being read
 */
export type RungState = "held" | "next" | "later" | "open" | "reading";

export interface Rung {
  key: string;
  /** The rung's number, when the ladder numbers them. */
  n?: number;
  name: string;
  state: RungState;
  /** The state in words, as the page's own vocabulary has it. */
  word: string;
  test?: ReactNode;
  saw?: ReactNode;
}

const GLYPH = { held: Check, later: Check, next: ArrowUp, open: Minus, reading: Clock } as const;
const TAG = { held: "k-tag k-tag--ours", later: "k-tag", next: "k-tag k-tag--warn", open: "k-tag", reading: "k-tag" } as const;

/**
 * The checks as a ladder, with the agent standing on the highest rung it has
 * climbed: every rung below its feet has passed, and the one above it is
 * what to fix next. /check and /list both draw their verdicts with it, so a
 * builder reads the same picture for BNB Chain's checks and for ours.
 *
 * `at` is the index of the rung the agent stands on, or -1 for the ground.
 * The ladder is drawn bottom up; the list stays in reading order for a
 * screen reader. The bars light from the bottom and the agent arrives at its
 * rung once, on mount; under reduced motion it is simply there.
 */
export default function Climb({
  rungs,
  at,
  figure,
  label,
  compact = false,
}: {
  rungs: Rung[];
  at: number;
  /** The agent, drawn (an `Agent`), placed on its rung. */
  figure?: ReactNode;
  label: string;
  compact?: boolean;
}) {
  const fig = figure ? (
    <span className="bd-fig" aria-hidden="true">
      <span className="bd-fig__in">{figure}</span>
    </span>
  ) : null;
  return (
    <div className={`bd-climb${compact ? " bd-climb--compact" : ""}${figure ? "" : " bd-climb--bare"}`} style={{ ["--at" as string]: Math.max(0, at + 1) }}>
      <ol className="bd-climb__rungs" aria-label={label}>
        {at < 0 ? (
          <li className="bd-rung bd-rung--ground" aria-hidden="true">
            <span className="bd-rung__fig">{fig}</span>
            <span className="bd-rung__rail" />
            <span className="bd-rung__body" />
          </li>
        ) : null}
        {rungs.map((r, i) => {
          const Icon = GLYPH[r.state];
          return (
            <li key={r.key} className="bd-rung" data-state={r.state} data-at={i === at ? "1" : undefined} style={{ ["--i" as string]: i }}>
              <span className="bd-rung__fig">{i === at ? fig : null}</span>
              <span className="bd-rung__rail" aria-hidden="true">
                <span className="bd-rung__bar" />
              </span>
              <div className="bd-rung__body">
                <p className="bd-rung__head">
                  <span className="bd-rung__glyph" aria-hidden="true">
                    <Icon size={13} strokeWidth={3} />
                  </span>
                  {typeof r.n === "number" ? <span className="bd-rung__n k-num">{r.n}</span> : null}
                  <span className="bd-rung__name">{r.name}</span>
                  <span className={`${TAG[r.state]} bd-rung__word`}>{r.word}</span>
                </p>
                {r.test && !compact ? <p className="bd-rung__test">{r.test}</p> : null}
                {r.saw && !compact ? <p className="bd-rung__saw">{r.saw}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
