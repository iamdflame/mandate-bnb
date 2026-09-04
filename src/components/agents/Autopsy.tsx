import type { Autopsy } from "@/lib/autopsy";

const fmt = (v: number | null, dp = 2) => (v === null ? "—" : v.toFixed(dp));

/**
 * Official score, de-duplicated score, and the wallets responsible.
 *
 * The gap between the two numbers is the product. Rendering only the corrected
 * figure would be a second unexplained score; rendering both, with the
 * reviewers and a reproduction command, lets a reader check rather than trust.
 */
export default function AutopsyPanel({ autopsy }: { autopsy: Autopsy }) {
  const a = autopsy;
  const inflated =
    a.officialScore !== null &&
    a.dedupedScore !== null &&
    Math.abs(a.officialScore - a.dedupedScore) > 0.005;
  const wiped = a.cleanFeedbacks === 0;
  void inflated;

  return (
    <section className="autopsy" aria-labelledby="autopsy-title">
      <h2 id="autopsy-title" className="section-title">
        Reputation autopsy
      </h2>

      <div className="au-scores">
        <div className="au-score">
          <span className="au-label">As published</span>
          <span className="au-fig">{fmt(a.officialScore, 1)}</span>
          <span className="au-note">
            from {a.officialFeedbacks} feedback
            {a.officialFeedbacks === 1 ? "" : "s"} by {a.reviewers} wallet
            {a.reviewers === 1 ? "" : "s"}
          </span>
        </div>
        <div className="au-arrow" aria-hidden>
          →
        </div>
        <div className="au-score au-score--after">
          <span className="au-label">After de-duplication</span>
          <span className="au-fig">{wiped ? "—" : fmt(a.dedupedScore, 1)}</span>
          <span className="au-note">
            {wiped
              ? "nothing survives"
              : `from ${a.cleanFeedbacks} by ${a.cleanReviewers} wallet${a.cleanReviewers === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      {a.flaggedShare > 0 ? (
        <p className="au-share">
          <strong>{a.flaggedShare.toFixed(0)}%</strong> of this agent&rsquo;s
          reputation was written by wallets flagged as coordinated.
        </p>
      ) : null}

      {a.flagged.length ? (
        <>
          <p className="au-lede">
            {a.flagged.length} of this agent&rsquo;s {a.reviewers} reviewer
            {a.reviewers === 1 ? "" : "s"}{" "}
            {a.flagged.length === 1 ? "is" : "are"} part of a coordinated
            cohort, judged against {a.populationSampled.toLocaleString()}{" "}
            reviewer profiles across the registry rather than this agent alone —
            a wallet that left one review here is unremarkable until you see the
            two hundred it left elsewhere.
          </p>
          <table className="au-table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th className="num">Feedbacks</th>
                <th className="num">Agents</th>
                <th className="num">Max on one</th>
              </tr>
            </thead>
            <tbody>
              {a.flagged.slice(0, 8).map((f) => (
                <tr key={f.address}>
                  <td>
                    <code>{f.address.slice(0, 12)}…</code>
                  </td>
                  <td className="num">{f.feedbacks}</td>
                  <td className="num">{f.agentsReviewed}</td>
                  <td className="num">{f.maxPerAgent}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.reasons.length ? (
            <ul className="au-reasons">
              {a.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="au-lede">
          No coordinated cohort found among this agent&rsquo;s reviewers, judged
          against {a.populationSampled.toLocaleString()} profiles across the
          registry. {inflated ? "" : "The official score stands."}
        </p>
      )}

      <p className="au-foot">
        Thresholds: Jaccard {a.thresholds.jaccard}, cardinality tolerance{" "}
        {a.thresholds.cardinalityTolerance}, cohort minimum{" "}
        {a.thresholds.cohortMin}. Reproduce with{" "}
        <code>{a.reproduce}</code>.
      </p>
    </section>
  );
}
