"use client";

/**
 * The bench, as a ceremony.
 *
 * Streams a live assay (GET /api/assay/{chain}/{token}, server-sent events)
 * and stages each check as it resolves: its lamp lights, its row lands with
 * the finding in the chain's own terms, the agent on the pedestal reacts, and
 * only when every check is in is the agent shown in its own family and pose,
 * with the count of checks it passed.
 *
 * The stream logic is the one the bench has always used (src/components/
 * Bench.tsx, unchanged). The stream often delivers all six results within a
 * few milliseconds of each other, so they are revealed one at a time, each
 * after it has arrived: nothing is shown before the chain answered, and a
 * halted run shows what it has at once. Under reduced motion, everything that
 * has arrived is shown at once.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import Command from "@/components/ui/Command";
import type { AssayReport, AssayResult } from "@/lib/assay/types";
import { CATEGORY_LABEL, type Category } from "@/lib/config";

type Status = "idle" | "running" | "done" | "error";

const ORDER = ["identity", "custody", "activity", "capability", "reputation", "performance"] as const;
const TITLE: Record<(typeof ORDER)[number], string> = { identity: "Identity", custody: "Custody", activity: "Activity", capability: "Capability", reputation: "Reputation", performance: "Performance" };
const WEIGHT: Record<(typeof ORDER)[number], number> = { identity: 250, custody: 150, activity: 250, capability: 200, reputation: 100, performance: 50 };
const WORD: Record<AssayResult["verdict"], string> = { pass: "Proven", fail: "Failed", inconclusive: "Not enough evidence" };

/** Hashes and addresses are elided in the middle, never truncated at the end. */
const trim = (v: string) => (v.length > 52 ? `${v.slice(0, 22)}…${v.slice(-14)}` : v);

export default function BenchStage({ chainId, suggestions }: { chainId: number; suggestions: { tokenId: string; name: string; fineness: number }[] }) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<AssayResult[]>([]);
  const [report, setReport] = useState<AssayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
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
      setShown(0);
      setTokenId(tokenId);

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

  // The reveal: one arrived result at a time; all at once on a halt or under reduced motion.
  useEffect(() => {
    if (shown >= results.length) return;
    const still = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (status === "error" || still) {
      setShown(results.length);
      return;
    }
    const t = window.setTimeout(() => setShown((s) => s + 1), shown === 0 ? 300 : 720);
    return () => window.clearTimeout(t);
  }, [results.length, shown, status]);

  const busy = status === "running";
  const visible = results.slice(0, shown);
  const byId = new Map(visible.map((r) => [r.id, r]));
  const revealed = shown >= results.length;
  const halted = status === "error";
  const finished = Boolean(report) && revealed;
  const next = ORDER.find((id) => !byId.has(id));
  const last = visible.at(-1) ?? null;
  const passed = visible.filter((r) => r.verdict === "pass").length;
  const failed = visible.filter((r) => r.verdict === "fail").length;
  const unknown = visible.filter((r) => r.verdict === "inconclusive").length;
  const category = (report?.category ?? null) as Category | null;
  const pose: CharacterState = !finished ? "awake" : failed > 0 ? "failed" : "awake";

  return (
    <div className="tr-bench" data-status={status}>
      <form
        className="tr-bench__form"
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
      >
        <label htmlFor="bench-id" className="k-label">
          An agent&apos;s token id on BNB Smart Chain
        </label>
        <div className="k-field tr-bench__field">
          <span className="tr-bench__hash" aria-hidden="true">
            #
          </span>
          <input id="bench-id" value={input} onChange={(e) => setInput(e.target.value)} placeholder="153776" inputMode="numeric" autoComplete="off" className="k-num" />
          <button type="submit" disabled={busy} className={`k-btn k-btn--primary${busy ? " k-btn--busy" : ""}`}>
            {busy ? "Checking" : "Run the six checks"}
            {busy ? null : <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />}
          </button>
        </div>
        <p className="k-small">Any agent in the ERC-8004 registry, not only ours. You can paste a full agent id too.</p>
      </form>

      {status === "idle" && suggestions.length ? (
        <div className="tr-bench__try">
          <p className="k-small">Or try one the registry rates highest, and see whether the chain agrees:</p>
          <div className="tr-bench__chips">
            {suggestions.map((s) => (
              <button
                key={s.tokenId}
                type="button"
                className="k-chip tr-bench__chip"
                onClick={() => {
                  setInput(s.tokenId);
                  run(s.tokenId);
                }}
              >
                <span>{s.name.slice(0, 28)}</span>
                <span className="tr-bench__chipid k-num">#{s.tokenId}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="k-note k-note--err tr-bench__err" role="alert">
          {error}
        </p>
      ) : null}

      {status !== "idle" ? (
        <div className="tr-bench__stage">
          {/* the pedestal: the agent, its six lamps, and the points it earns */}
          <div className="tr-spec" data-finished={finished ? "1" : undefined}>
            <div className="tr-spec__lamps" aria-hidden="true">
              {ORDER.map((id, i) => {
                const r = byId.get(id);
                const st = r ? r.verdict : halted ? "off" : busy && id === next ? "run" : "wait";
                return (
                  <span key={id} className="tr-spec__lamp" data-st={st} style={{ ["--a" as string]: `${-62 + i * 24.8}deg` }}>
                    <span className="tr-spec__bulb">{r?.verdict === "pass" ? <Check size={12} strokeWidth={3.2} /> : r?.verdict === "fail" ? <X size={12} strokeWidth={3.2} /> : r ? <Minus size={12} strokeWidth={3.2} /> : null}</span>
                  </span>
                );
              })}
            </div>
            <div className="tr-spec__pool" aria-hidden="true" />
            <span className="tr-spec__who" key={`${shown}-${finished ? "f" : "r"}`} data-react={finished ? "reveal" : last?.verdict ?? undefined}>
              {finished ? (
                <Agent job={category} seed={report!.tokenId} size={200} state={pose} slot="bench" label={`${report!.name ?? "Unnamed agent"}, ${failed > 0 ? "failed a check" : "no check failed"}`} />
              ) : (
                <span className="tr-spec__shadow" aria-hidden="true">
                  <Agent job="rebalancing" seed={tokenId ?? "bench"} size={200} state="awake" slot="benchs" />
                </span>
              )}
            </span>
            <div className="tr-spec__plinth" aria-hidden="true" />
            <p className="tr-spec__stage" aria-live="polite">
              {busy ? <span className="k-dot k-dot--live" aria-hidden="true" /> : null}
              <span>{busy || !revealed ? `${(busy ? stage : (next ? TITLE[next] : stage)) || "Opening"}…` : halted ? "Halted" : "Complete"}</span>
              <span className="tr-spec__meta k-num">
                {(elapsed / 1000).toFixed(1)} s, {shown} of 6 checks
              </span>
            </p>
            <div className="tr-points" role="img" aria-label="Points earned by each check, out of its weight">
              {ORDER.map((id) => {
                const r = byId.get(id);
                return (
                  <span key={id} className="tr-points__seg" style={{ flexGrow: WEIGHT[id] }} data-st={r?.verdict ?? undefined}>
                    <span style={{ ["--s" as string]: r ? Math.max(0, Math.min(1, r.score)) : 0 }} />
                  </span>
                );
              })}
            </div>
          </div>

          {/* the six checks, landing in turn */}
          <ol className="tr-checks">
            {ORDER.map((id) => {
              const r = byId.get(id);
              if (!r) {
                const st = halted ? "off" : (busy || !revealed) && id === next ? "run" : "wait";
                return (
                  <li key={id} className="tr-check" data-st={st}>
                    <span className="tr-check__mark" aria-hidden="true" />
                    <span className="tr-check__t">{TITLE[id]}</span>
                    <span className="tr-check__v">{st === "off" ? "not run" : st === "run" ? "checking" : "waiting"}</span>
                  </li>
                );
              }
              return (
                <li key={id} className="tr-check" data-st={r.verdict} data-na={r.notApplicable ? "1" : undefined}>
                  <span className="tr-check__mark" aria-hidden="true">
                    {r.verdict === "pass" ? <Check size={14} strokeWidth={3} /> : r.verdict === "fail" ? <X size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={3} />}
                  </span>
                  <span className="tr-check__t">{r.title}</span>
                  <span className="tr-check__v">
                    {r.notApplicable ? "Does not apply" : WORD[r.verdict]}
                    <span className="tr-check__pts k-num">
                      {Math.round(r.score * r.weight)}/{r.weight}
                    </span>
                  </span>
                  <p className="tr-check__f">{r.finding}</p>
                  {r.evidence.length ? (
                    <details className="tr-check__ev">
                      <summary>Evidence ({r.evidence.length})</summary>
                      <ul>
                        {r.evidence.map((e, i) => (
                          <li key={`${e.label}-${i}`}>
                            <span className="tr-check__evl">{e.label}</span>
                            {e.url ? (
                              <a className="k-mono" href={e.url} target="_blank" rel="noreferrer">
                                {trim(e.value)}
                              </a>
                            ) : (
                              <span className="k-mono">{trim(e.value)}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {report && finished ? (
        <section className="tr-verdict k-panel k-panel--raised" aria-labelledby="tr-verdict-h">
          <div className="tr-verdict__who">
            <p className="tr-verdict__k">Verdict</p>
            <h2 className="k-h2" id="tr-verdict-h">
              {report.name ?? "Unnamed agent"}
            </h2>
            <p className="k-src">
              <span className="k-mono">{report.agentId}</span>
              {category ? <span>{CATEGORY_LABEL[category]}</span> : null}
            </p>
          </div>
          <ul className="tr-verdict__counts">
            <li data-st="pass">
              <strong className="k-num">{passed}</strong> proven
            </li>
            <li data-st="fail">
              <strong className="k-num">{failed}</strong> failed
            </li>
            <li data-st="inconclusive">
              <strong className="k-num">{unknown}</strong> not enough evidence
            </li>
          </ul>
          <div className="tr-verdict__grade">
            <span className="tr-verdict__n k-num">{report.fineness}</span>
            <span className="tr-verdict__of">
              of 1,000 points, {report.fineness >= 375 ? `graded ${report.hallmark.name}` : "below 375, so no mark is struck"}
            </span>
            {report.registryScore !== null ? <span className="k-src">The registry reports {report.registryScore} for it. We publish what the checks found.</span> : null}
          </div>
          <div className="tr-verdict__go">
            <a className="k-btn" href={`/agents/${report.tokenId}`}>
              Its full page <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </a>
            <Command note="The same six checks, from a terminal. Neither run reads anything the other wrote.">{`npm run assay -- ${report.tokenId}`}</Command>
          </div>
        </section>
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
