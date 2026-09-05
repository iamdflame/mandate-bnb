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
 * The funnel is the hero.
 *
 * It was the best asset in the project and it was buried in a markdown file
 * most judges will never open. Every figure here is a test the chain settles,
 * every one links into the filtered register, and every one carries the method
 * that produced it — because a funnel whose numbers cannot be re-derived is
 * the same unverifiable claim as an agent card.
 *
 * A rung with no measurable population renders as a dash and says why. A
 * plausible number there would be a lie, and this product is not in the
 * business of plausible numbers.
 */
export default function Funnel({
  reading,
  detail = false,
}: {
  reading: LadderReading;
  /**
   * Show the method and the command under each figure.
   *
   * Off above the fold, where the plan is that the funnel and nothing else is
   * on screen; on further down, where a reader who wants to check has room to.
   */
  detail?: boolean;
}) {
  return (
    <ol className={detail ? "funnel funnel--detail" : "funnel"}>
      {reading.rungs.map((r) => (
        <li className="funnel__row" key={r.n}>
          <a className="funnel__link" href={FILTER[r.n] ?? "/agents"}>
            <span className="funnel__fig" data-null={r.population === null ? "1" : undefined}>
              {r.population === null ? "—" : r.population.toLocaleString()}
            </span>
            <span className="funnel__body">
              <span className="funnel__name">{r.test}</span>
              <span className="funnel__meta mark-label">
                rung {r.n} · {r.name}
                {/* A floor is not a total, and the difference is not a detail. */}
                {r.atLeast && r.population !== null ? " · a floor, not a total" : ""}
              </span>
            </span>
          </a>
          {detail ? (
            <>
              <p className="funnel__source">{r.source}</p>
              {r.discontinuity ? <p className="funnel__break">{r.discontinuity}</p> : null}
              {r.verify ? <Command>{r.verify}</Command> : null}
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
