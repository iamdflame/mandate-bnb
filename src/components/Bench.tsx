"use client";

/**
 * The bench.
 *
 * Streams a live assay and renders each test as it resolves. The waiting is
 * the content here — a judge watching an agent's claims fail against the chain
 * one line at a time is the whole argument, so nothing is hidden behind a
 * spinner and no result is revealed before the chain has actually answered.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssayReport, AssayResult } from "@/lib/assay/types";
import { Fineness, HallmarkBadge, ResultRow } from "./Report";

type Status = "idle" | "running" | "done" | "error";

export default function Bench({
  chainId,
  suggestions,
}: {
  chainId: number;
  suggestions: { tokenId: string; name: string; fineness: number }[];
}) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<AssayResult[]>([]);
  const [report, setReport] = useState<AssayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const run = useCallback(
    (raw: string) => {
      const tokenId = parseAgentId(raw);
      if (!tokenId) {
        setError("Enter a token id, or an agent id like 56:0x8004…:153776");
        setStatus("error");
        return;
      }

      sourceRef.current?.close();
      setStatus("running");
      setResults([]);
      setReport(null);
      setError(null);
      setStage("Opening");
      setElapsed(0);

      const es = new EventSource(`/api/assay/${chainId}/${tokenId}`);
      sourceRef.current = es;

      es.addEventListener("progress", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as {
          stage: string;
          result: AssayResult | null;
          elapsed: number;
        };
        setStage(d.stage);
        setElapsed(d.elapsed);
        if (d.result) setResults((prev) => [...prev, d.result as AssayResult]);
      });

      es.addEventListener("report", (ev) => {
        setReport(JSON.parse((ev as MessageEvent).data) as AssayReport);
      });

      es.addEventListener("error", (ev) => {
        const data = (ev as MessageEvent).data;
        if (data) {
          const d = JSON.parse(data) as { message: string };
          setError(d.message);
          setStatus("error");
        }
      });

      es.addEventListener("done", () => {
        setStatus((s) => (s === "error" ? s : "done"));
        es.close();
      });

      es.onerror = () => {
        setStatus((s) => {
          if (s === "running") {
            setError("The stream closed before the assay finished.");
            return "error";
          }
          return s;
        });
        es.close();
      };
    },
    [chainId],
  );

  useEffect(() => () => sourceRef.current?.close(), []);

  const busy = status === "running";

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "stretch",
          flexWrap: "wrap",
          borderTop: "1px solid var(--ink)",
          borderBottom: "1px solid var(--rule)",
          paddingBlock: "1rem",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="153776"
          inputMode="numeric"
          aria-label="Agent token id"
          className="fig"
          style={{
            flex: "1 1 20ch",
            minWidth: 0,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--ink)",
            fontSize: "clamp(1.5rem, 4vw, 2.75rem)",
            letterSpacing: "-0.03em",
            padding: 0,
          }}
        />
        <button
          type="submit"
          disabled={busy}
          className="fig"
          style={{
            background: busy ? "transparent" : "var(--ink)",
            color: busy ? "var(--ink-45)" : "var(--paper)",
            border: "1px solid var(--ink)",
            padding: "0.75rem 1.75rem",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            cursor: busy ? "default" : "pointer",
            transition: "background .3s var(--ease), color .3s var(--ease)",
            alignSelf: "center",
          }}
        >
          {busy ? "assaying" : "assay"}
        </button>
      </form>

      {status === "idle" && suggestions.length ? (
        <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <span className="label" style={{ alignSelf: "center" }}>
            try
          </span>
          {suggestions.map((s) => (
            <button
              key={s.tokenId}
              onClick={() => {
                setInput(s.tokenId);
                run(s.tokenId);
              }}
              className="fig"
              style={{
                background: "transparent",
                border: "1px solid var(--rule)",
                color: "var(--ink-70)",
                padding: "0.35rem 0.7rem",
                fontSize: 11.5,
                cursor: "pointer",
              }}
            >
              {s.tokenId} · {s.name.slice(0, 28)}
            </button>
          ))}
        </div>
      ) : null}

      {status !== "idle" ? (
        <div
          style={{
            marginTop: "2.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div className="label">
            {busy ? `${stage}…` : status === "error" ? "halted" : "complete"}
          </div>
          <div className="fig" style={{ fontSize: 12, color: "var(--ink-45)" }}>
            {(elapsed / 1000).toFixed(1)}s · {results.length}/6 tests
          </div>
        </div>
      ) : null}

      {busy ? (
        <div
          aria-hidden
          style={{
            marginTop: "0.6rem",
            height: 1,
            background: "var(--ink-12)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${(results.length / 6) * 100}%`,
              background: "var(--ink)",
              transition: "width .6s var(--ease)",
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="prose" style={{ marginTop: "1.5rem", color: "var(--ink)" }}>
          {error}
        </p>
      ) : null}

      {results.length ? (
        <div style={{ marginTop: "2rem" }}>
          {results.map((r, i) => (
            <div
              key={r.id}
              className="rise"
              style={{ animationDelay: `${Math.min(i, 6) * 0.06}s` }}
            >
              <ResultRow result={r} />
            </div>
          ))}
        </div>
      ) : null}

      {report ? (
        <div
          className="rise"
          style={{
            marginTop: "2.5rem",
            borderTop: "1px solid var(--ink)",
            paddingTop: "1.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "2rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="label">verdict</div>
            <h2 className="display d3" style={{ marginTop: "0.3rem", maxWidth: "20ch" }}>
              {report.name ?? "Unnamed agent"}
            </h2>
            <div className="fig" style={{ fontSize: 12, color: "var(--ink-45)", marginTop: "0.6rem" }}>
              {report.agentId}
            </div>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", justifyItems: "end" }}>
            <Fineness value={report.fineness} size={1.35} />
            <HallmarkBadge report={report} />
            {report.registryScore !== null ? (
              <div className="label">registry reports {report.registryScore}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Accepts a bare token id or a full `chain:registry:token` agent id. */
function parseAgentId(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{1,20}$/.test(v)) return v;
  const parts = v.split(":");
  const last = parts.at(-1)?.trim();
  return last && /^\d{1,20}$/.test(last) ? last : null;
}
