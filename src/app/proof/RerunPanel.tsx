"use client";

import { useState } from "react";
import { Check as Tick, HelpCircle, X } from "lucide-react";

interface Check {
  id: string;
  title: string;
  question: string;
  verdict: "pass" | "fail" | "inconclusive";
  finding: string;
  evidence: { label: string; value: string }[];
  ms: number;
}

interface Reading {
  at: string;
  block: number | null;
  note: string;
  checks: Check[];
}

const WORD: Record<Check["verdict"], string> = {
  pass: "Measured now",
  fail: "Failed",
  inconclusive: "Could not measure",
};
const STATE: Record<Check["verdict"], "proven" | "failed" | "unproven"> = { pass: "proven", fail: "failed", inconclusive: "unproven" };

function Glyph({ v }: { v: Check["verdict"] }) {
  if (v === "pass") return <Tick size={16} strokeWidth={2.5} className="x-glyph x-glyph--proven" aria-label={WORD[v]} />;
  if (v === "fail") return <X size={16} strokeWidth={2.5} className="x-glyph x-glyph--failed" aria-label={WORD[v]} />;
  return <HelpCircle size={16} className="x-glyph x-glyph--unproven" aria-label={WORD[v]} />;
}

/**
 * The button that turns the report into a lab.
 *
 * A reader looking at a results file has to decide whether to believe it. A
 * reader who presses a button and watches three chain reads come back does
 * not. These are the questions that can be asked of the head block rather
 * than of a 24,000 block window, so they finish in seconds and need no
 * archive node. Nothing is signed or spent, and the panel says so before it
 * is pressed.
 */
export default function RerunPanel() {
  const [running, setRunning] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/proof/rerun", { cache: "no-store" });
      const body = (await res.json()) as Reading & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `The re-run answered ${res.status}.`);
        setReading(null);
      } else setReading(body);
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="x-rerun">
      <div className="x-rerun__bar">
        <button type="button" className="x-btn x-btn--primary" onClick={run} disabled={running}>
          {running ? "Reading the chain…" : reading ? "Run them again" : "Run the three live checks"}
        </button>
        <p className="x-rerun__hint">Three reads of the head block. Nothing is signed, nothing is sent, and you need no wallet.</p>
      </div>

      <div aria-live="polite">
        {error ? <p className="x-rerun__err">{error}</p> : null}
        {reading ? (
          <>
            <p className="x-src">
              <span className="x-src__k">BNB Smart Chain</span>
              <span className="x-mono">block {reading.block?.toLocaleString("en-GB") ?? "unknown"}</span>
              <span>read {new Date(reading.at).toISOString().replace("T", " ").slice(0, 19)} UTC</span>
            </p>
            <div className="x-proofs">
              {reading.checks.map((c) => (
                <details key={c.id} className="x-proof" open>
                  <summary>
                    <Glyph v={c.verdict} />
                    <span className="x-proof__label">{c.id}</span>
                    <span className="x-proof__head">{c.title}</span>
                    <span className={`x-proof__state x-proof__state--${STATE[c.verdict]}`}>
                      {WORD[c.verdict]} <span className="x-mono">{c.ms} ms</span>
                    </span>
                  </summary>
                  <div className="x-proof__body">
                    <p className="x-proof__meaning">{c.question}</p>
                    <p className="x-proof__finding">{c.finding}</p>
                    {c.evidence.length ? (
                      <dl className="x-proof__ev">
                        {c.evidence.map((e, i) => (
                          <div key={`${e.label}-${i}`}>
                            <dt>{e.label}</dt>
                            <dd className="x-mono">{e.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
            <p className="x-ad-src">{reading.note}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
