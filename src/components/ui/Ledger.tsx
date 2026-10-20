import { EXPLORER } from "@/lib/config";

export interface LedgerEvent {
  /** Wall clock, when known. Rendered HH:MM, the day is in the header. */
  at?: string | number | Date | null;
  block?: number | string | bigint | null;
  /** What happened. Two to four words. */
  title: string;
  /** The figure it moved. Monospaced, tabular. */
  figure?: string | null;
  /** A consequence worth naming: SLASHED 25%, DISMISSED. */
  flag?: string | null;
  /** Metal the figure is struck in. */
  tone?: string | null;
  txHash?: string | null;
  /** Anything that needs a sentence. Sits under the row, dimmed. */
  note?: string | null;
}

/**
 * A mandate's life, in the order it happened.
 *
 * Not a chart and not a summary. A mandate is a sequence of things that
 * occurred on chain, each with a transaction anyone can open, and collapsing
 * that into a performance figure would discard exactly the evidence the
 * figure is supposed to rest on.
 *
 * Underperformance is rendered as absence of light and never as alarm. The
 * only red in this product is a defaced mark.
 */
export default function Ledger({ events }: { events: LedgerEvent[] }) {
  if (!events.length) {
    return <p className="k-small">Nothing has happened yet.</p>;
  }

  return (
    <ol className="ac-rtape ac-ledger">
      {events.map((e, i) => (
        <li className="ac-rtape__row" key={`${e.txHash ?? ""}-${i}`} style={{ ["--i" as string]: Math.min(i, 12) }}>
          <span className="ac-rtape__dot" aria-hidden="true" style={e.tone ? { background: e.tone } : undefined} />
          <div className="ac-rtape__main">
            <p className="ac-rtape__t">
              {e.title}
              {e.flag ? <span className="k-tag k-tag--err">{e.flag}</span> : null}
            </p>
            {e.note ? <div className="ac-rtape__d ac-break">{e.note}</div> : null}
          </div>
          <span className="ac-rtape__fig k-num" style={e.tone ? { color: e.tone } : undefined}>
            {e.figure ?? ""}
          </span>
          <span className="ac-rtape__at k-num">
            {clock(e.at)}
            {e.txHash ? (
              <a className="k-link" href={`${EXPLORER}/tx/${e.txHash}`} target="_blank" rel="noreferrer" title={e.txHash}>
                tx
              </a>
            ) : e.block !== undefined && e.block !== null ? (
              <a className="k-link" href={`${EXPLORER}/block/${String(e.block)}`} target="_blank" rel="noreferrer">
                block
              </a>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Day and HH:MM in UTC, so two readers in two timezones see the same ledger. */
function clock(at: LedgerEvent["at"]): string {
  if (at === null || at === undefined) return "time not recorded";
  const d = new Date(at);
  if (!Number.isFinite(d.getTime())) return "time not recorded";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}
