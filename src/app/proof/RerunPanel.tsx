"use client";

import { useState } from "react";
import { ArrowRight, Check as Tick, Minus, X } from "lucide-react";

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

function Glyph({ v }: { v: Check["verdict"] }) {
  if (v === "pass") return <Tick size={14} strokeWidth={3} aria-label={WORD[v]} />;
  if (v === "fail") return <X size={14} strokeWidth={3} aria-label={WORD[v]} />;
  return <Minus size={14} strokeWidth={3} aria-label={WORD[v]} />;
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
    <div className="tr-rerun">
      <div className="tr-rerun__bar k-panel">
        <button type="button" className={`k-btn k-btn--primary${running ? " k-btn--busy" : ""}`} onClick={run} disabled={running}>
          {running ? "Reading the chain…" : reading ? "Run them again" : "Run the three live checks"}
          {running ? null : <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />}
        </button>
        <p className="k-small">Three reads of the head block. Nothing is signed, nothing is sent, and you need no wallet.</p>
      </div>

      <div aria-live="polite" className="tr-rerun__out">
        {error ? <p className="k-note k-note--err">{error}</p> : null}
        {reading ? (
          <>
            <p className="k-src">
              <span className="x-src__k">BNB Smart Chain</span>
              <span className="k-mono">block {reading.block?.toLocaleString("en-GB") ?? "unknown"}</span>
              <span>read {new Date(reading.at).toISOString().replace("T", " ").slice(0, 19)} UTC</span>
            </p>
            <ol className="tr-checks">
              {reading.checks.map((c) => (
                <li key={c.id} className="tr-check" data-st={c.verdict}>
                  <span className="tr-check__mark">
                    <Glyph v={c.verdict} />
                  </span>
                  <span className="tr-check__t">
                    <span className="tr-rerun__id k-num">{c.id}</span> {c.title}
                  </span>
                  <span className="tr-check__v">
                    {WORD[c.verdict]} <span className="tr-check__pts k-num">{c.ms} ms</span>
                  </span>
                  <p className="tr-check__f">
                    <span className="tr-rerun__q">{c.question}</span> {c.finding}
                  </p>
                  {c.evidence.length ? (
                    <details className="tr-check__ev">
                      <summary>Evidence ({c.evidence.length})</summary>
                      <ul>
                        {c.evidence.map((e, i) => (
                          <li key={`${e.label}-${i}`}>
                            <span className="tr-check__evl">{e.label}</span>
                            <span className="k-mono">{e.value}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="k-small">{reading.note}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
