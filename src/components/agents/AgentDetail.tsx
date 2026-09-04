"use client";

/**
 * One agent, assayed live.
 *
 * The previous agent page rendered from a forty-agent snapshot, so every other
 * agent in the registry 404'd. This assays on open instead: the six tests run
 * against BNB Smart Chain while you watch, which is both the honest way to
 * show it and the only way that scales to a registry of three hundred thousand.
 */

import { useEffect, useRef, useState } from "react";
import type { AssayReport, AssayResult } from "@/lib/assay/types";
import type { IndexedAgent } from "@/lib/data/agents";
import { CATEGORY_LABEL, type Category } from "@/lib/config";

const MARK: Record<AssayResult["verdict"], string> = {
  pass: "✓",
  fail: "×",
  inconclusive: "–",
};

export default function AgentDetail({
  tokenId,
  chainId,
  indexed,
  explorer,
}: {
  tokenId: string;
  chainId: number;
  indexed: IndexedAgent | null;
  explorer: string;
}) {
  const [results, setResults] = useState<AssayResult[]>([]);
  const [report, setReport] = useState<AssayReport | null>(null);
  const [stage, setStage] = useState("opening");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/assay/${chainId}/${tokenId}`);
    esRef.current = es;

    es.addEventListener("progress", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as {
        stage: string;
        result: AssayResult | null;
      };
      setStage(d.stage);
      if (d.result) setResults((prev) => [...prev, d.result as AssayResult]);
    });
    es.addEventListener("report", (ev) => {
      setReport(JSON.parse((ev as MessageEvent).data) as AssayReport);
    });
    es.addEventListener("error", (ev) => {
      const data = (ev as MessageEvent).data;
      if (data) setError((JSON.parse(data) as { message: string }).message);
    });
    es.addEventListener("done", () => es.close());
    es.onerror = () => es.close();

    return () => es.close();
  }, [chainId, tokenId]);

  const fineness = report?.fineness ?? null;
  const struck = fineness !== null && fineness >= 375;
  const name = report?.name ?? indexed?.name ?? `Agent ${tokenId}`;
  const category = (report?.category ?? indexed?.category ?? null) as Category | null;

  return (
    <>
      <section className="hero shell adetail__hero">
        <div className="hero__copy">
          <div className="label">
            {category ? CATEGORY_LABEL[category] : "unclassified"} · agent {tokenId}
          </div>
          <h1 className="display adetail__name">{name}</h1>
          {indexed?.description ? (
            <p className="prose hero__lede">{indexed.description}</p>
          ) : null}
          <div className="hero__actions">
            <a className="btn btn--primary" href={`/market?agent=${tokenId}`}>
              Put to work
            </a>
            {report?.agentWallet ? (
              <a
                className="btn"
                href={`${explorer}/address/${report.agentWallet}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Agent wallet ↗
              </a>
            ) : null}
            <a className="btn" href="/">
              All agents
            </a>
          </div>
        </div>

        <div className="verdict">
          <div className="verdict__num">
            <span className={`fig ${struck ? "up" : ""}`}>{fineness ?? "…"}</span>
            <span className="label">fine / 1000</span>
          </div>
          <div className={`verdict__mark ${struck ? "verdict__mark--struck" : ""}`}>
            {report ? (struck ? `${report.hallmark.mark} · ${report.hallmark.name}` : "unstruck · base metal") : "assaying…"}
          </div>
          <dl className="kv">
            <Kv k="registry says" v={String(report?.registryScore ?? indexed?.registryScore ?? "—")} />
            <Kv k="feedback records" v={String(indexed?.feedbacks ?? 0)} />
            <Kv
              k="classified"
              v={category ? `${CATEGORY_LABEL[category]} · ${Math.round((report?.categoryConfidence ?? indexed?.confidence ?? 0) * 100)}%` : "—"}
            />
            <Kv k="assay time" v={report ? `${report.ms}ms` : stage} />
          </dl>
        </div>
      </section>

      <section className="section shell">
        <div className="section__head">
          <div>
            <div className="label">certificate of assay</div>
            <h2 className="display section__title">What it claims, and what the chain says</h2>
          </div>
          <p className="section__note">
            Six tests against BNB Smart Chain, run when you opened this page.
            Every finding links to the evidence behind it.
          </p>
        </div>

        {error ? <p className="empty-note">{error}</p> : null}

        <div className="assay">
          {results.length === 0 && !error ? (
            <p className="empty-note">Running {stage.toLowerCase()}…</p>
          ) : null}
          {results.map((r) => (
            <article key={r.id} className="assay__row">
              <div className="assay__head">
                <span className={`fig verdict-${r.verdict}`}>{MARK[r.verdict]}</span>
                <h3 className="assay__title">{r.title}</h3>
                <span className="label">{r.verdict}</span>
              </div>
              <div className="assay__claim">
                <div className="label">claim</div>
                <p>{r.claim}</p>
              </div>
              <div className="assay__finding">
                <div className="label">finding</div>
                <p>{r.finding}</p>
                {r.evidence.length ? (
                  <ul className="assay__ev">
                    {r.evidence.map((e, i) => (
                      <li key={`${e.label}-${i}`}>
                        <span className="label">{e.label}</span>
                        {e.url ? (
                          <a
                            href={e.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="fig link-underline"
                          >
                            {trim(e.value)}
                          </a>
                        ) : (
                          <span className="fig">{trim(e.value)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

const trim = (v: string) => (v.length > 52 ? `${v.slice(0, 22)}…${v.slice(-14)}` : v);

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv__row">
      <dt className="label">{k}</dt>
      <dd className="fig">{v}</dd>
    </div>
  );
}
