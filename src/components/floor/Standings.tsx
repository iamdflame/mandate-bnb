"use client";

/**
 * The book.
 *
 * Every agent that has ever held a mandate, and what it cost them. The two
 * columns on the right are the ones a directory cannot produce: capital the
 * agent lost out of its own pocket, and the number of times it was fired. Both
 * are reconstructed from contract logs, so neither can be edited by the agent
 * they describe.
 */

import { useEffect, useState } from "react";
import type { Standing, StandingsResult } from "@/lib/chain/standings";

const bnb = (wei: string, dp = 2) => (Number(BigInt(wei)) / 1e18).toFixed(dp);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const pct = (bps: number) => `${bps > 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`;

export default function Standings({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<StandingsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/standings", { cache: "no-store" });
        const json = (await res.json()) as StandingsResult & { error?: string };
        if (!live) return;
        if (json.error) setError(json.error);
        setData(json);
      } catch (e) {
        if (live) setError(String(e).slice(0, 140));
      }
    };
    void load();
    // Reconstructing the book walks the whole log history, so it refreshes on
    // a slower cadence than the floor itself.
    const timer = setInterval(load, 20_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <aside
      style={{
        position: "absolute",
        left: "var(--gutter)",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 3,
        width: "min(94vw, 40rem)",
        maxHeight: "76svh",
        overflow: "auto",
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="label">the book</div>
          <div className="display" style={{ fontSize: "1.5rem", marginTop: "0.2rem" }}>
            What each agent has cost itself.
          </div>
        </div>
        <button
          onClick={onClose}
          className="label"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ink-45)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          close
        </button>
      </div>

      <p style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-45)", marginTop: "0.8rem" }}>
        Reconstructed from contract logs, not reported by the agents. An agent
        cannot edit this.
      </p>

      {error ? (
        <p style={{ fontSize: 12, color: "var(--ink-70)", marginTop: "1rem" }}>{error}</p>
      ) : null}

      {!data ? (
        <p className="label" style={{ marginTop: "1.5rem" }}>
          reading the chain…
        </p>
      ) : data.standings.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--ink-70)", marginTop: "1.5rem" }}>
          No agent has held a mandate yet.
        </p>
      ) : (
        <div className="scroll-x" style={{ marginTop: "1.1rem" }}>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                <Th>agent</Th>
                <Th align="right">mean alpha</Th>
                <Th align="right">held</Th>
                <Th align="right">epochs</Th>
                <Th align="right">won</Th>
                <Th align="right">earned</Th>
                <Th align="right">own capital lost</Th>
                <Th align="right">fired</Th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((s) => (
                <Row key={s.agent} s={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && !data.complete ? (
        <p className="label" style={{ marginTop: "0.9rem" }}>
          partial history — the provider refused part of the range
        </p>
      ) : data ? (
        <p className="label" style={{ marginTop: "0.9rem" }}>
          blocks {data.fromBlock}–{data.toBlock}
        </p>
      ) : null}
    </aside>
  );
}

function Row({ s }: { s: Standing }) {
  const lost = BigInt(s.slashedWei) > 0n;
  return (
    <tr style={{ borderBottom: "1px solid var(--ink-06)" }} title={s.lastDismissalReason ?? ""}>
      <td className="fig" style={{ padding: "0.6rem 0.5rem 0.6rem 0" }}>
        {short(s.agent)}
      </td>
      <td
        className="fig"
        style={{
          textAlign: "right",
          padding: "0.6rem 0.5rem",
          color: s.meanAlphaBps > 0 ? "var(--gold-deep)" : "var(--ink)",
        }}
      >
        {s.epochs === 0 ? "—" : pct(s.meanAlphaBps)}
      </td>
      <Td>{s.mandatesHeld}</Td>
      <Td>{s.epochs}</Td>
      <Td>{s.epochs === 0 ? "—" : `${Math.round((s.wins / s.epochs) * 100)}%`}</Td>
      <Td>{bnb(s.feesWei)}</Td>
      <td
        className="fig"
        style={{
          textAlign: "right",
          padding: "0.6rem 0.5rem",
          color: lost ? "var(--ink)" : "var(--ink-25)",
        }}
      >
        {bnb(s.slashedWei)}
      </td>
      <td
        className="fig"
        style={{
          textAlign: "right",
          padding: "0.6rem 0 0.6rem 0.5rem",
          color: s.dismissals > 0 ? "var(--ink)" : "var(--ink-25)",
        }}
      >
        {s.dismissals}
      </td>
    </tr>
  );
}

const Td = ({ children }: { children: React.ReactNode }) => (
  <td
    className="fig"
    style={{ textAlign: "right", padding: "0.6rem 0.5rem", color: "var(--ink-45)" }}
  >
    {children}
  </td>
);

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="label"
      style={{
        textAlign: align,
        fontWeight: 400,
        fontSize: 9.5,
        padding: align === "right" ? "0 0.5rem 0.6rem" : "0 0.5rem 0.6rem 0",
      }}
    >
      {children}
    </th>
  );
}
