"use client";

import { useEffect, useRef, useState } from "react";
import type { LadderReading } from "@/lib/ladder";
import Command from "@/components/ui/Command";

/** Where each rung's population lives in the register. */
const FILTER: Record<number, string> = {
  0: "/agents",
  1: "/agents?rung=1",
  2: "/agents?endpoint=answering",
  3: "/agents?rung=3",
  4: "/agents?marked=struck",
  5: "/agents?rung=5",
  6: "/agents?rung=6",
};

/**
 * The funnel is the hero, and it is drawn to scale.
 *
 * It used to be a list of right-aligned numerals, which meant the single most
 * important fact about this registry — that three hundred thousand
 * registrations collapse to five reachable agents and then to nothing — had to
 * be worked out by reading. Now the bar does it: rung 0 fills the track, rung 1
 * is a one-percent sliver, and everything below it is a hairline. Nobody has to
 * be told.
 *
 * The scale is linear and deliberately not logarithmic. A log axis would make
 * the lower rungs comfortably visible and would be a kindness to the data at
 * the cost of the truth: the collapse really is that severe, and softening it
 * would be arguing for ourselves.
 */
export default function Funnel({
  reading,
  detail = false,
}: {
  reading: LadderReading;
  detail?: boolean;
}) {
  const max = Math.max(1, ...reading.rungs.map((r) => r.population ?? 0));

  return (
    <ol className={detail ? "funnel funnel--detail" : "funnel"}>
      {reading.rungs.map((r, i) => (
        <Rung key={r.n} rung={r} max={max} index={i} detail={detail} href={FILTER[r.n] ?? "/agents"} />
      ))}
    </ol>
  );
}

function Rung({
  rung: r,
  max,
  index,
  detail,
  href,
}: {
  rung: LadderReading["rungs"][number];
  max: number;
  index: number;
  detail: boolean;
  href: string;
}) {
  const measured = r.population !== null;
  const share = measured ? (r.population as number) / max : 0;
  const shown = useCountUp(r.population, index);
  const [drawn, setDrawn] = useState(false);

  /*
    The bar draws when the reading arrives, not on a timer.

    This figure comes from the chain and streams in after the page paints, so
    its arrival is a real data event — the one thing the motion doctrine here
    allows to move. Staggered by rung so the collapse is legible as a sequence
    rather than appearing all at once.
  */
  useEffect(() => {
    const id = setTimeout(() => setDrawn(true), 60 + index * 55);
    return () => clearTimeout(id);
  }, [index]);

  return (
    <li className="funnel__row" data-measured={measured ? "1" : undefined}>
      <a className="funnel__link" href={href}>
        <span className="funnel__meta mark-label">
          <span className="funnel__n">{r.n}</span>
          {r.name}
        </span>

        {/*
          A rung the index can only bound from below is written as a bound.
          This used to be a "· a floor" tag beside the rung name, which pushed
          the label past its column and, worse, put the qualification a long
          way from the number it qualifies. Here it cannot be read without it.
        */}
        <span
          className="funnel__fig num"
          title={r.atLeast && measured ? "A floor: the true figure is at least this" : undefined}
        >
          {measured ? (
            <>
              {r.atLeast ? <span className="funnel__floor">≥</span> : null}
              {shown.toLocaleString()}
            </>
          ) : (
            <span className="funnel__none">not measurable</span>
          )}
        </span>

        <span className="funnel__track">
          <span
            className="funnel__fill"
            style={{
              // A measured rung never renders as nothing: below a pixel it is
              // pinned to a hairline, because "few" and "none" are different
              // claims and this bar must not blur them.
              width: drawn ? `max(${measured && r.population! > 0 ? "2px" : "0px"}, ${(share * 100).toFixed(4)}%)` : "0%",
            }}
          />
        </span>

        <span className="funnel__test">{r.test}</span>
      </a>

      {detail ? (
        <>
          <p className="funnel__source">{r.source}</p>
          {r.discontinuity ? <p className="funnel__break">{r.discontinuity}</p> : null}
          {r.verify ? <Command>{r.verify}</Command> : null}
        </>
      ) : null}
    </li>
  );
}

/**
 * Counts to the figure once, when it arrives.
 *
 * Not an entrance flourish: these numbers are read from the chain after the
 * page has painted, so the count is the arrival being shown. It runs once per
 * value and never on a re-render, and `prefers-reduced-motion` skips straight
 * to the answer.
 */
function useCountUp(target: number | null, index: number): number {
  const [value, setValue] = useState(0);
  const done = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    if (done.current === target) return;
    done.current = target;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }

    const duration = 620;
    const delay = 60 + index * 55;
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 4;
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, index]);

  return target === null ? 0 : value;
}
