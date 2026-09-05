import Link from "next/link";
import type { LadderReading, Rung } from "@/lib/ladder";

/**
 * The funnel, as navigation.
 *
 * The counts span the whole registry down to zero, so a linear bar would
 * render every rung but the first as nothing. The widths are logarithmic and
 * say so — a scale that flatters the small numbers without admitting it would
 * be the same dishonesty this page is about.
 *
 * The top of the scale is the live rung-0 count, not a constant: the registry
 * grows by hundreds a day, and a hardcoded denominator would drift.
 */
const widthAgainst = (top: number) => (n: number | null): string => {
  if (n === null) return "0%";
  if (n <= 0) return "1.5%";
  const max = Math.log10(Math.max(top, 10) + 1);
  return `${Math.max(1.5, (Math.log10(n + 1) / max) * 100)}%`;
};

function Count({ rung }: { rung: Rung }) {
  if (rung.population === null) {
    return <span className="rung-count rung-count--unknown">not measured</span>;
  }
  return (
    <span className="rung-count">
      {rung.atLeast ? <span className="rung-atleast">≥</span> : null}
      {rung.population.toLocaleString()}
    </span>
  );
}

export default function Ladder({ reading }: { reading: LadderReading }) {
  const registered = reading.rungs[0]?.population ?? 0;
  const live = reading.rungs[2]?.population ?? 0;
  const width = widthAgainst(registered);

  return (
    <section className="ladder" aria-labelledby="ladder-title">
      <header className="ladder-head shell">
        <p className="eyebrow">The trust ladder</p>
        <h1 id="ladder-title" className="ladder-title">
          {registered.toLocaleString()} agents are registered on BNB Smart Chain.
          <br />
          <em>{live}</em> have an endpoint that answers.
        </h1>
        <p className="ladder-sub">
          Every agent appears here. None are ranked by what they say about
          themselves. Each sits on a rung, and every rung is a test the chain
          settles — so the emptiness further down is not a gap in the data, it
          is the finding.
        </p>
      </header>

      <ol className="rungs shell">
        {reading.rungs.map((rung) => (
          <li key={rung.n} className="rung">
            <Link href={`/agents?rung=${rung.n}`} className="rung-link">
              <span className="rung-n">{rung.n}</span>
              <span className="rung-body">
                <span className="rung-top">
                  <span className="rung-name">{rung.name}</span>
                  <Count rung={rung} />
                </span>
                <span className="rung-bar" aria-hidden>
                  <span className="rung-fill" style={{ width: width(rung.population) }} />
                </span>
                <span className="rung-test">{rung.test}</span>
                <span className="rung-source">{rung.source}</span>
                {rung.discontinuity ? (
                  <span className="rung-break">{rung.discontinuity}</span>
                ) : null}
                {rung.verify ? (
                  <code className="rung-verify">{rung.verify}</code>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <p className="ladder-foot shell">
        Widths are logarithmic, or every rung below the first would be
        invisible. Registry counts read from{" "}
        {reading.source === "postgres" ? "the index" : "a committed snapshot"} of{" "}
        <time dateTime={reading.capturedAt}>{reading.capturedAt.slice(0, 10)}</time>;
        on-chain rungs read at block {reading.blockNumber ?? "—"}.
      </p>
    </section>
  );
}
