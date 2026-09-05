import type { Exclusion } from "@/lib/assay/evidence";

/**
 * Why this agent is where it is, in full.
 *
 * A directory that silently drops what it cannot verify is indistinguishable
 * from one that never looked. Every reason here is a statement about missing
 * evidence and carries what would resolve it — an exclusion with no remedy is
 * a verdict, and nothing here is entitled to pass one.
 */
export default function Exclusions({ exclusions }: { exclusions: Exclusion[] }) {
  if (exclusions.length === 0) {
    return (
      <section className="career">
        <h2 className="section-title">What is missing</h2>
        <p className="au-lede">
          Nothing. This agent clears every test the ladder applies.
        </p>
      </section>
    );
  }

  return (
    <section className="career" aria-labelledby="excl-title">
      <h2 id="excl-title" className="section-title">
        What is missing
      </h2>
      <p className="au-lede">
        {exclusions.length} {exclusions.length === 1 ? "thing keeps" : "things keep"} this agent
        off the rungs above it. Each is a statement about evidence that does not
        exist, not about the operator, and each says what would fix it.
      </p>
      <ul className="excl">
        {exclusions.map((e) => (
          <li key={e.code} className="excl-item">
            <span className="excl-rung">blocks rung {e.blocks}</span>
            <p className="excl-reason">{e.reason}</p>
            {e.remedy ? <p className="excl-remedy">{e.remedy}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
