/**
 * The funnel, as an instrument rather than a paragraph.
 *
 * 356,000 agents are registered on BNB Smart Chain and a few hundred answer
 * when called. Every marketplace in this field prints the big number. The
 * interesting number is the shape of the drop, and it is the one thing here
 * that cannot be faked by anybody who is not reading the registry's own
 * storage slot.
 *
 * Two rules the plan is strict about, and both are about honesty rather than
 * looks:
 *
 *   - A rung is a number or the word "unknown". Never null rendered as zero.
 *     A rung we cannot measure says so and says why, because a plausible
 *     figure would be a lie and a zero would be a worse one.
 *   - Every rung clicks through to exactly the set it counts, so a reader can
 *     check the number against the list rather than trusting it.
 */

import Link from "next/link";
import type { Rung } from "@/lib/ladder";
import { SourceChip, type Source } from "./SourceChip";

/** Where a rung's count can be inspected as a list. */
const FILTER: Record<number, string | null> = {
  0: "/agents",
  1: "/agents",
  2: "/agents?live=1",
  3: "/agents?capable=1",
  4: "/agents?hallmarked=1",
  5: "/agents?bonded=1",
  6: "/activity",
};

const SOURCE: Record<number, Source> = { 0: "chain", 1: "db", 2: "probe", 3: "probe", 4: "chain", 5: "chain", 6: "chain" };

export function Funnel({
  rungs,
  block,
  at,
  compact = false,
}: {
  rungs: Rung[];
  block?: number | string | null;
  at?: string | null;
  /** The home page shows every rung. A sidebar may not have the room. */
  compact?: boolean;
}) {
  const known = rungs.map((r) => r.population).filter((n): n is number => typeof n === "number");
  const top = known.length ? Math.max(...known) : 1;
  const shown = compact ? rungs.filter((r) => typeof r.population === "number") : rungs;

  return (
    <ol className="m-funnel" aria-label="How many agents clear each rung">
      {shown.map((r) => {
        const href = FILTER[r.n];
        const measured = typeof r.population === "number";
        // Linear against the top rung, with a floor so a rung of 1 is still
        // a visible mark rather than nothing at all.
        const pct = measured ? Math.max(0.6, ((r.population as number) / top) * 100) : 0;

        const body = (
          <>
            <span className="m-funnel__n m-mono">
              {measured ? (
                <>
                  {r.atLeast ? <span className="m-funnel__at">at least </span> : null}
                  {(r.population as number).toLocaleString("en-GB")}
                </>
              ) : (
                <span className="m-funnel__unknown">unknown</span>
              )}
            </span>
            <span className="m-funnel__name">{r.name}</span>
            <span className="m-funnel__track" aria-hidden="true">
              <span className="m-funnel__bar" style={{ width: `${pct}%` }} data-measured={measured ? "1" : "0"} />
            </span>
          </>
        );

        return (
          <li key={r.n} className="m-funnel__row" data-measured={measured ? "1" : "0"}>
            {href && measured ? (
              <Link href={href} className="m-funnel__link">
                {body}
              </Link>
            ) : (
              <span className="m-funnel__link m-funnel__link--flat">{body}</span>
            )}
            <p className="m-funnel__test">{r.test}</p>
            {!measured ? <p className="m-funnel__why">{r.source}</p> : null}
            {r.duplication ? <p className="m-funnel__why">{r.duplication}</p> : null}
            {r.discontinuity ? <p className="m-funnel__why">{r.discontinuity}</p> : null}
            <SourceChip source={SOURCE[r.n] ?? "db"} block={r.n <= 2 || r.n >= 4 ? block : null} at={at} note={r.verify} />
          </li>
        );
      })}
    </ol>
  );
}
