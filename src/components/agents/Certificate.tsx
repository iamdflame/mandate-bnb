"use client";

import { useEffect, useRef, useState } from "react";
import type { AssayReport, AssayResult } from "@/lib/assay/types";
import type { IndexedAgent } from "@/lib/data/agents";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import Hallmark from "@/components/mark/Hallmark";
import Strike from "@/components/mark/Strike";
import AssayBar from "@/components/ui/AssayBar";
import Command from "@/components/ui/Command";
import Observation from "@/components/ui/Observation";
import CountUp from "@/components/ui/CountUp";
import { gradeOf } from "@/components/mark/geometry";

const ORDER = ["identity", "custody", "activity", "capability", "reputation", "performance"];

/**
 * The certificate of assay.
 *
 * Structured as the document it actually is: the struck hallmark at the head,
 * the fineness it earned, and the six tests that produced it with every
 * failure reason on the page rather than behind a control.
 *
 * The assay runs live when the page opens rather than being read from a
 * snapshot. That is the honest way to show it — a fineness cached last week is
 * a claim about last week — and it is the only way that scales to a registry
 * of three hundred thousand, where a snapshot could only ever cover the few
 * agents somebody thought to include.
 */
export default function Certificate({
  tokenId,
  chainId,
  indexed,
}: {
  tokenId: string;
  chainId: number;
  indexed: IndexedAgent | null;
}) {
  const [results, setResults] = useState<AssayResult[]>([]);
  const [report, setReport] = useState<AssayReport | null>(null);
  const [stage, setStage] = useState("opening");
  const [error, setError] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/assay/${chainId}/${tokenId}`);
    source.current = es;

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
  const grade = gradeOf(fineness ?? 0);
  const name = report?.name ?? indexed?.name ?? `Agent ${tokenId}`;
  const category = (report?.category ?? indexed?.category ?? null) as Category | null;
  const done = new Set(results.map((r) => r.id));
  const pending = report ? [] : ORDER.filter((id) => !done.has(id as AssayResult["id"]));

  return (
    <article className="cert">
      <header className="cert__head">
        {/*
          The strike fires when the assay lands, not on page load. Nothing
          moves unless the chain moved.
        */}
        <Strike when={report?.assayedAt ?? null}>
          <Hallmark
            size={96}
            labels
            sponsor
            record={{
              chainId,
              tokenId,
              fineness,
              category,
              assayedAt: report?.assayedAt ?? null,
            }}
          />
        </Strike>

        <div className="cert__id">
          <h1 className="h1 cert__name">{name}</h1>
          <p className="mark-label">
            ERC-8004 · {chainId}:{tokenId}
            {category ? ` · ${CATEGORY_LABEL[category]}` : " · unclassified"}
          </p>
          {indexed?.description ? (
            <p className="small cert__desc">{indexed.description}</p>
          ) : null}
        </div>

        <div className="cert__verdict">
          <span className="mark-label">Fineness</span>
          <span className="cert__fig num" style={{ color: grade.metal }}>
            {fineness === null ? (
              // Not a dash: at this size an em dash reads as a rule drawn
              // across the certificate rather than as an absent figure.
              <span className="cert__reading" aria-label="reading">
                · · ·
              </span>
            ) : (
              <CountUp value={fineness} />
            )}
            <span className="cert__denom"> / 999</span>
          </span>
          <span className="mark-label">
            {error ? "assay halted" : fineness === null ? stage.toLowerCase() : grade.label}
          </span>
          {fineness !== null && !grade.shape ? (
            <p className="cert__unstruck">
              No hallmark is struck below 375. This agent is described, not accused.
            </p>
          ) : null}
        </div>
      </header>

      <section className="panel cert__assay" aria-labelledby="assay-title">
        <div className="panel__head">
          <h2 id="assay-title" className="mark-label">
            Assay — six tests against BNB Smart Chain
          </h2>
          <Observation
            size="small"
            at={report?.assayedAt ?? null}
            value={report ? `${report.ms} ms` : undefined}
          />
        </div>
        <div className="panel__body">
          {error ? (
            <p className="small assay__halted">
              The assay stopped: {error}. The six tests read the ERC-8004 index and the
              chain; when the index is unavailable the identity claim cannot be fetched
              and nothing downstream of it can be tested. Nothing is assumed in its
              place — the dimensions below are marked unrun, not failed.
            </p>
          ) : null}
          <AssayBar
            results={results}
            fineness={fineness}
            pending={pending}
            halted={Boolean(error)}
          />
        </div>
        <div className="panel__body">
          <Command note="Runs the same six tests from a terminal. The page and the command read the same chain and share no state.">
            {`npm run assay -- ${tokenId}`}
          </Command>
        </div>
      </section>
    </article>
  );
}
