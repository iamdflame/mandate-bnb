"use client";

import { useState } from "react";

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

const MARK: Record<Check["verdict"], string> = {
  pass: "Measured",
  fail: "Failed",
  inconclusive: "Not measurable now",
};

/**
 * The button that makes the report a lab rather than a document.
 *
 * A judge reading a results file has to decide whether to believe it. A judge
 * who presses a button and watches three chain reads happen in front of them
 * does not. These are the three of the six questions that can be asked of the
 * head block rather than of a 24,000 block window, so they finish in seconds
 * and need no archive node.
 *
 * Nothing here signs anything or spends anything, and the panel says so
 * before it is pressed rather than after.
 */
export default function RerunPanel() {
  const [state, setState] = useState<"idle" | "running">("idle");
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState("running");
    setError(null);
    try {
      const res = await fetch("/api/proof/rerun", { cache: "no-store" });
      const body = (await res.json()) as Reading & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `The re-run answered ${res.status}.`);
        setReading(null);
      } else {
        setReading(body);
      }
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="m-rerun">
      <div className="m-rerun__bar">
        <button className="m-btn m-btn--primary" onClick={run} disabled={state === "running"}>
          {state === "running" ? "Reading the chain…" : "Run the three live checks"}
        </button>
        <p className="m-field__hint">
          Three reads of the head block. Nothing is signed, nothing is sent, and you do not need a wallet.
        </p>
      </div>

      {error ? <p className="m-error">{error}</p> : null}

      {reading ? (
        <>
          <p className="m-note m-rerun__stamp">
            Read at block {reading.block?.toLocaleString("en-GB") ?? "unknown"},{" "}
            {new Date(reading.at).toISOString().replace("T", " ").slice(0, 19)} UTC. {reading.note}
          </p>
          <ol className="m-tasks">
            {reading.checks.map((c) => (
              <li key={c.id} className="m-task" data-verdict={c.verdict === "pass" ? "win" : c.verdict === "fail" ? "loss" : "inconclusive"}>
                <div className="m-task__head">
                  <span className="m-mono m-task__id">{c.id}</span>
                  <h3 className="m-task__t">{c.title}</h3>
                  <span className="m-task__v">
                    {MARK[c.verdict]} · {c.ms} ms
                  </span>
                </div>
                <p className="m-note">{c.question}</p>
                <p className="m-task__line">{c.finding}</p>
                {c.evidence.length ? (
                  <dl className="m-kv">
                    {c.evidence.map((e, i) => (
                      <div key={`${e.label}-${i}`}>
                        <dt className="m-label">{e.label}</dt>
                        <dd className="m-mono">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
