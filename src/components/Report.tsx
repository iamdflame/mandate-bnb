/**
 * A certificate of assay.
 *
 * Laid out as a document, not a dashboard: the claim on the left, the finding
 * on the right, evidence beneath. Every verdict is legible without colour —
 * gold marks what passed, everything else is ink at reduced weight — so the
 * page still reads correctly printed, or to anyone who cannot distinguish hue.
 */

import type { AssayReport, AssayResult, Evidence } from "@/lib/assay/types";
import { isHallmarked } from "@/lib/assay/types";

export function Fineness({
  value,
  size = 1,
}: {
  value: number;
  size?: number;
}) {
  const struck = isHallmarked(value);
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5em" }}>
      <span
        className="fig"
        style={{
          fontSize: `${2.6 * size}rem`,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: struck ? "var(--gold-deep)" : "var(--ink)",
        }}
      >
        {value}
      </span>
      <span className="label" style={{ fontSize: 10 * size }}>
        fine
      </span>
    </div>
  );
}

export function HallmarkBadge({ report }: { report: AssayReport }) {
  const struck = isHallmarked(report.fineness);
  return struck ? (
    <span className="hallmark hallmark--struck" title={report.hallmark.note}>
      {report.hallmark.mark} · {report.hallmark.name}
    </span>
  ) : (
    <span className="unstruck" title={report.hallmark.note}>
      — unstruck
    </span>
  );
}

const VERDICT_MARK: Record<AssayResult["verdict"], string> = {
  pass: "✓",
  fail: "×",
  inconclusive: "–",
};

export function ResultRow({ result }: { result: AssayResult }) {
  return (
    <article
      style={{
        borderTop: "1px solid var(--rule)",
        paddingBlock: "clamp(1.1rem, 2vw, 1.9rem)",
      }}
    >
      <div className="grid12">
        <div style={{ gridColumn: "span 3" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6em" }}>
            <span
              className={`fig verdict-${result.verdict}`}
              style={{ fontSize: 16, width: "1em" }}
              aria-hidden
            >
              {VERDICT_MARK[result.verdict]}
            </span>
            <h3
              className="display"
              style={{ fontSize: "clamp(1.3rem, 2vw, 1.75rem)", lineHeight: 1.1 }}
            >
              {result.title}
            </h3>
          </div>
          <div className="label" style={{ marginTop: "0.75rem", paddingLeft: "1.6em" }}>
            {result.verdict}
            {typeof result.ms === "number" ? ` · ${result.ms}ms` : ""}
          </div>
        </div>

        <div style={{ gridColumn: "span 4" }}>
          <div className="label">claim</div>
          <p style={{ margin: "0.4rem 0 0", color: "var(--ink-45)", fontSize: 14, lineHeight: 1.55 }}>
            {result.claim}
          </p>
        </div>

        <div style={{ gridColumn: "span 5" }}>
          <div className="label">finding</div>
          <p style={{ margin: "0.4rem 0 0", fontSize: 14.5, lineHeight: 1.55 }}>
            {result.finding}
          </p>
          {result.evidence.length ? (
            <ul
              style={{
                listStyle: "none",
                margin: "0.9rem 0 0",
                padding: 0,
                display: "grid",
                gap: "0.35rem",
              }}
            >
              {result.evidence.map((e, i) => (
                <EvidenceLine key={`${e.label}-${i}`} evidence={e} />
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EvidenceLine({ evidence }: { evidence: Evidence }) {
  const truncated =
    evidence.value.length > 46 && evidence.kind !== "note"
      ? `${evidence.value.slice(0, 14)}…${evidence.value.slice(-10)}`
      : evidence.value;

  const body = (
    <>
      <span className="label" style={{ minWidth: "14ch", flexShrink: 0 }}>
        {evidence.label}
      </span>
      <span
        className={evidence.kind === "note" ? "" : "fig"}
        style={{
          fontSize: 12,
          color: "var(--ink-70)",
          wordBreak: "break-word",
        }}
      >
        {truncated}
      </span>
    </>
  );

  return (
    <li style={{ display: "flex", gap: "0.9rem", alignItems: "baseline" }}>
      {evidence.url ? (
        <a
          href={evidence.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", gap: "0.9rem", alignItems: "baseline", width: "100%" }}
          className="link-underline"
        >
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}

export function Certificate({ report }: { report: AssayReport }) {
  return (
    <section>
      <div className="grid12" style={{ alignItems: "end", paddingBottom: "1.5rem" }}>
        <div style={{ gridColumn: "span 7" }}>
          <div className="label">certificate of assay</div>
          <h2
            className="display d2"
            style={{ marginTop: "0.3rem", maxWidth: "18ch" }}
          >
            {report.name ?? "Unnamed agent"}
          </h2>
          <div
            className="fig"
            style={{ fontSize: 12, color: "var(--ink-45)", marginTop: "0.9rem" }}
          >
            {report.agentId}
          </div>
        </div>
        <div style={{ gridColumn: "span 5", display: "grid", gap: "0.9rem" }}>
          <Fineness value={report.fineness} />
          <div>
            <HallmarkBadge report={report} />
          </div>
          {report.registryScore !== null ? (
            <div className="label">
              registry reports {report.registryScore} · assayed in {report.ms}ms
            </div>
          ) : null}
        </div>
      </div>

      {report.results.map((r) => (
        <ResultRow key={r.id} result={r} />
      ))}
    </section>
  );
}
