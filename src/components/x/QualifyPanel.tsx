"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Clock, HelpCircle, X } from "lucide-react";
import Climb, { type Rung, type RungState } from "@/components/builders/Climb";
import { CAMPAIGN_ENDS, QUALIFIES } from "@/lib/campaign/rules";

interface Q {
  tokenId: string;
  checks: { id: string; label: string; state: "pass" | "pending" | "fail" | "unknown"; detail: string }[];
  actions: { tx: string; kind: string; fits: boolean; at: string }[];
  at: string;
  reading?: boolean;
}

const ICON = { pass: Check, pending: Clock, fail: X, unknown: HelpCircle } as const;
const WORD = { pass: "Met", pending: "Not yet", fail: "Not met", unknown: "Not read" } as const;

/**
 * BNB Chain's six as a ladder: the agent stands on the last check it meets
 * with every one below it met, and the first one it does not is the one to
 * fix next. A check met above that still counts; it reads "Met".
 */
function ladder(q: Q): { rungs: Rung[]; at: number } {
  const first = q.checks.findIndex((c) => c.state !== "pass");
  const at = first < 0 ? q.checks.length - 1 : first - 1;
  const rungs = q.checks.map((c, i): Rung => {
    const reading = c.state === "unknown" && Boolean(q.reading);
    const state: RungState = reading ? "reading" : c.state === "pass" ? (i <= at ? "held" : "later") : i === first ? "next" : "open";
    return { key: c.id, name: c.label, state, word: reading ? "Reading" : WORD[c.state], saw: c.detail };
  });
  return { rungs, at };
}

/**
 * An agent against BNB Chain's Set and Earn build checks, read now. The first
 * four arrive at once; its onchain actions take half a minute to read from an
 * archive, so the panel asks again until they are in.
 *
 * `figure` is the agent drawn by the page (its own face and pose), placed on
 * the rung it has reached. `compact` lists the six without the ladder, for a
 * page where another ladder already leads (/list).
 */
export default function QualifyPanel({ tokenId, figure, compact = false }: { tokenId: string; figure?: ReactNode; compact?: boolean }) {
  const [q, setQ] = useState<Q | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After Set and Earn closes, the reading stays useful but the "time to fix it" does not.
  const [ended, setEnded] = useState(false);
  useEffect(() => setEnded(Date.now() >= Date.parse(CAMPAIGN_ENDS)), []);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    const read = async () => {
      try {
        const r = await fetch(`/api/v1/qualify/${tokenId}`, { cache: "no-store" });
        const j = await r.json();
        if (stop) return;
        if (!r.ok) {
          setError(j?.error ?? "The checks could not be read just now.");
          return;
        }
        setQ(j.data);
        if (j.data?.reading && ++tries < 20) setTimeout(read, 8_000);
      } catch {
        if (!stop) setError("The checks could not be read just now.");
      }
    };
    void read();
    return () => {
      stop = true;
    };
  }, [tokenId]);

  const met = q?.checks.filter((c) => c.state === "pass").length ?? 0;
  const view = q ? ladder(q) : null;
  const waiting: Rung[] = QUALIFIES.map(([t]) => ({ key: t, name: t, state: "reading", word: "Reading" }));

  return (
    <section className={`bd-qual${compact ? " bd-qual--compact" : ""}`} aria-labelledby={`h-qual-${tokenId}`} aria-busy={!q && !error}>
      <div className="bd-qual__head">
        <div className="bd-qual__t">
          <h2 className="k-h3" id={`h-qual-${tokenId}`}>
            Set and Earn&apos;s checks
          </h2>
          <p className="k-small">
            {ended
              ? "BNB Chain's six, read from the chain and its endpoint now. The campaign has closed and BNB Chain decides from its own reading; this is ours."
              : "BNB Chain's six, read from the chain and its endpoint now. BNB Chain decides after the campaign closes; this shows what is missing while there is time."}
          </p>
        </div>
        {q ? (
          <p className="bd-qual__score" role="status">
            <span className="bd-qual__n k-num">{met}</span>
            <span className="bd-qual__of">
              of 6 met
              {q.reading ? (
                <span className="k-state bd-qual__reading">
                  <span className="k-dot k-dot--live" aria-hidden="true" /> reading its onchain actions
                </span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="k-note k-note--err" role="alert">
          {error}
        </p>
      ) : compact ? (
        <ul className="bd-qual__grid">
          {(q?.checks ?? QUALIFIES.map(([t]) => ({ id: t, label: t, state: "unknown" as const, detail: "Reading…" }))).map((c) => {
            const Icon = ICON[c.state];
            return (
              <li key={c.id} className="bd-qual__cell" data-state={c.state}>
                <p className="bd-qual__cell-h">
                  <span className="bd-qual__icon" aria-hidden="true">
                    <Icon size={13} strokeWidth={3} />
                  </span>
                  <span className="bd-qual__label">{c.label}</span>
                  <span className="bd-qual__word">{q ? WORD[c.state] : "Reading"}</span>
                </p>
                <p className="bd-qual__detail">{c.detail}</p>
              </li>
            );
          })}
        </ul>
      ) : view ? (
        <Climb rungs={view.rungs} at={view.at} figure={figure} label="Set and Earn's six checks, from the first to the last" />
      ) : (
        <Climb rungs={waiting} at={-1} figure={figure} label="Set and Earn's six checks, being read" />
      )}

      {q?.actions.length ? (
        <details className="bd-more">
          <summary>
            <span>Its most recent transactions</span>
            <span className="k-tag k-num">{q.actions.length}</span>
          </summary>
          <ul className="bd-acts">
            {q.actions.map((a) => (
              <li key={a.tx}>
                <span className="k-num bd-acts__at">{a.at.slice(0, 10)}</span>
                <span className="bd-acts__kind">{a.kind}</span>
                {a.fits ? <span className="k-tag k-tag--ours">fits its job</span> : <span />}
                <a className="k-mono bd-acts__tx" href={`https://bscscan.com/tx/${a.tx}`} target="_blank" rel="noreferrer">
                  {a.tx.slice(0, 10)}…
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {q ? (
        <p className="k-src bd-qual__src">
          Read {new Date(q.at).toUTCString().slice(5, 22)} UTC, kept for half an hour. The same answer at{" "}
          <a className="k-mono" href={`/api/v1/qualify/${q.tokenId}`}>
            /api/v1/qualify/{q.tokenId}
          </a>
        </p>
      ) : null}
    </section>
  );
}
