import { Check, HelpCircle, Minus, X } from "lucide-react";
import { STATE_WORD, type Proof as ProofT, type ProofState } from "@/lib/market/trust";
import Ago from "./Ago";

/** The glyph for one of the four states. Colour is never the only signal. */
export function ProofGlyph({ state, size = 16 }: { state: ProofState; size?: number }) {
  const label = STATE_WORD[state];
  if (state === "proven") return <Check size={size} strokeWidth={2.5} className="x-glyph x-glyph--proven" aria-label={label} />;
  if (state === "failed") return <X size={size} strokeWidth={2.5} className="x-glyph x-glyph--failed" aria-label={label} />;
  if (state === "unproven") return <HelpCircle size={size} className="x-glyph x-glyph--unproven" aria-label={label} />;
  return <Minus size={size} className="x-glyph x-glyph--nodata" aria-label={label} />;
}

/**
 * One verification row. The headline says what we saw; opening it shows the
 * finding and the evidence behind it. Progressive disclosure, so the buyer
 * reads one line and the sceptic can read everything.
 */
export default function Proof({ p, open = false }: { p: ProofT; open?: boolean }) {
  const hasMore = Boolean(p.meaning || p.evidence?.items.length || p.evidence?.finding);
  const head = (
    <>
      <ProofGlyph state={p.state} />
      <span className="x-proof__label">{p.label}</span>
      <span className="x-proof__head">{p.headline}</span>
      <span className={`x-proof__state x-proof__state--${p.state}`}>{STATE_WORD[p.state]}</span>
    </>
  );
  if (!hasMore) return <div className="x-proof x-proof--flat">{head}</div>;
  return (
    <details className="x-proof" open={open}>
      <summary>{head}</summary>
      <div className="x-proof__body">
        {p.meaning ? <p className="x-proof__meaning">{p.meaning}</p> : null}
        {p.evidence?.finding ? <p className="x-proof__finding">{p.evidence.finding}</p> : null}
        {p.evidence?.items.length ? (
          <dl className="x-proof__ev">
            {p.evidence.items.map((e, i) => (
              <div key={`${e.label}-${i}`}>
                <dt>{e.label}</dt>
                <dd className="x-mono">
                  {e.url ? (
                    <a className="x-link" href={e.url} target="_blank" rel="noreferrer">
                      {e.value}
                    </a>
                  ) : (
                    e.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {p.at ? (
          <p className="x-proof__at">
            <Ago iso={p.at} prefix="Established" />
          </p>
        ) : null}
      </div>
    </details>
  );
}
