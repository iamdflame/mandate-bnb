"use client";

/**
 * The floor.
 *
 * A live view of the market: every body is a mandate, its size is capital under
 * management, its ring is the bond the holder still has at risk, and it dims
 * and trembles as that agent falls behind. Nothing here is on a timer — the
 * page moves when the chain does.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import FloorCanvas, { type FloorBody, type FloorState } from "./FloorCanvas";
import {
  BidPanel,
  OpenMandatePanel,
  WalletChip,
  WithdrawButton,
} from "./Actions";
import Standings from "./Standings";
import type { FloorMandate, FloorSnapshot } from "@/app/api/floor/route";

const CATEGORY_NAMES = [
  "Rebalancing",
  "Grid Trading",
  "Yield Optimisation",
  "Health Factor",
];
const STATE_NAMES = ["Open", "Active", "Closed", "Abandoned"];
const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Formats wei with enough precision to be worth reading.
 *
 * A fixed 2-3 places renders every real mainnet amount as "0.00": a mandate of
 * 0.0025 BNB is a genuine position, not zero. Precision therefore follows
 * magnitude, so small real balances stay legible without giving large ones a
 * meaningless tail.
 */
const bnb = (wei: string, dp?: number) => {
  const n = Number(BigInt(wei)) / 1e18;
  if (dp !== undefined) return n.toFixed(dp);
  if (n === 0) return "0";
  const places = n >= 100 ? 1 : n >= 1 ? 2 : n >= 0.01 ? 3 : n >= 0.0001 ? 5 : 7;
  return n.toFixed(places);
};
const short = (a: string) => (a && a !== ZERO ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const pct = (bps: number) => `${bps > 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`;

interface TapeEntry {
  key: string;
  text: string;
  tone: "neutral" | "gain" | "loss" | "event";
  at: string;
}

export default function Floor({ initial }: { initial: FloorSnapshot | null }) {
  const [snap, setSnap] = useState<FloorSnapshot | null>(initial);
  const [connected, setConnected] = useState(false);
  const [tape, setTape] = useState<TapeEntry[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [book, setBook] = useState(false);
  const previous = useRef<Map<number, FloorMandate>>(new Map());

  const stateRef = useRef<FloorState>({
    bodies: [],
    stress: 0,
    flow: 0,
    settlementTick: 0,
    ruptures: [],
  });

  // ---- live feed
  useEffect(() => {
    const es = new EventSource("/api/floor");
    es.addEventListener("state", (ev) => {
      setConnected(true);
      const next = JSON.parse((ev as MessageEvent).data) as FloorSnapshot;
      setSnap(next);

      // Diff against the last frame to produce the tape. The contract emits
      // events, but diffing state is what keeps the tape honest about what
      // actually changed rather than what was merely re-read.
      const entries: TapeEntry[] = [];
      for (const m of next.mandates) {
        const before = previous.current.get(m.id);
        if (!before) continue;
        if (m.epochsSettled > before.epochsSettled) {
          const delta = m.cumulativeAlphaBps - before.cumulativeAlphaBps;
          entries.push({
            key: `${m.id}-e${m.epochsSettled}`,
            text: `mandate ${m.id} · epoch ${m.epochsSettled} settled · ${pct(delta)}`,
            tone: delta >= 0 ? "gain" : "loss",
            at: next.at,
          });
        }
        if (BigInt(m.bondWei) < BigInt(before.bondWei)) {
          const slashed = BigInt(before.bondWei) - BigInt(m.bondWei);
          entries.push({
            key: `${m.id}-s${m.epochsSettled}`,
            text: `mandate ${m.id} · bond slashed ${bnb(slashed.toString())} BNB`,
            tone: "loss",
            at: next.at,
          });
        }
        if (m.agent.toLowerCase() !== before.agent.toLowerCase()) {
          const wasHeld = before.agent !== ZERO;
          const isHeld = m.agent !== ZERO;

          // Only a change of holder is a dismissal. A mandate moving from
          // unheld to held is an award, and firing the shockwave for it
          // reported a firing that never happened.
          if (wasHeld) stateRef.current.ruptures.push(m.id);

          entries.push({
            key: `${m.id}-a${m.epochsSettled}-${m.agent}`,
            text: !wasHeld
              ? `mandate ${m.id} · awarded to ${short(m.agent)}`
              : isHeld
                ? `mandate ${m.id} · ${short(before.agent)} dismissed · ${short(m.agent)} takes over`
                : `mandate ${m.id} · ${short(before.agent)} dismissed · no successor`,
            tone: wasHeld ? "event" : "neutral",
            at: next.at,
          });
        }
      }
      previous.current = new Map(next.mandates.map((m) => [m.id, m]));
      if (entries.length) {
        setTape((t) => [...entries.reverse(), ...t].slice(0, 40));
        stateRef.current.settlementTick += 1;
      }
    });
    es.addEventListener("stale", () => setConnected(false));
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  // ---- layout: four category columns, mandates stacked within them
  const bodies = useMemo<FloorBody[]>(() => {
    if (!snap) return [];
    // Only live mandates stand on the floor. Closed and abandoned ones are
    // book history and belong in the ledger, not underfoot.
    const live = snap.mandates.filter((m) => m.state === 0 || m.state === 1);
    const byCategory = new Map<number, FloorMandate[]>();
    for (const m of live) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }
    const maxCapital = Math.max(
      1,
      ...live.map((m) => Number(BigInt(m.capitalWei)) / 1e18),
    );

    const out: FloorBody[] = [];
    for (let c = 0; c < 4; c++) {
      const list = byCategory.get(c) ?? [];
      // Columns sit at -0.66, -0.22, 0.22, 0.66 across the floor.
      const x = -0.66 + c * 0.44;
      list.forEach((m, i) => {
        const y = list.length === 1 ? -0.16 : 0.06 - (i / Math.max(list.length - 1, 1)) * 0.52;
        const capital = Number(BigInt(m.capitalWei)) / 1e18;
        const radius = 0.06 + 0.10 * Math.sqrt(capital / maxCapital);
        const perEpoch =
          m.epochsSettled > 0 ? m.cumulativeAlphaBps / m.epochsSettled : 0;
        out.push({
          id: m.id,
          x,
          y,
          radius: m.state === 1 ? radius : radius * 0.62,
          bond: m.state === 1 ? Math.max(0, Math.min(1, m.bondFraction)) : 0,
          alpha: Math.max(-1, Math.min(1, perEpoch / 400)),
          strikes: Math.min(1, m.strikes / 3),
        });
      });
    }
    return out;
  }, [snap]);

  // Feed the renderer without re-rendering it.
  useEffect(() => {
    const s = stateRef.current;
    s.bodies = bodies;
    if (snap) {
      const losing = snap.mandates.filter((m) => m.cumulativeAlphaBps < 0).length;
      const total = Math.max(snap.mandates.length, 1);
      const distress =
        snap.mandates.reduce((sum, m) => sum + m.strikes, 0) / (total * 3);
      s.stress = Math.min(1, (losing / total) * 0.6 + distress * 0.8);
      s.flow = Math.min(1, snap.totals.active / total);
    }
  }, [bodies, snap]);

  const totals = snap?.totals;
  const chosen = selected === null ? null : snap?.mandates.find((m) => m.id === selected);

  return (
    <div style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
      <FloorCanvas
        state={stateRef}
        style={{ position: "absolute", inset: 0, zIndex: 0 }}
      />

      {/* Bodies are drawn on the GPU; their labels are DOM, so they stay
          selectable, translatable and legible to a screen reader. */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
        {bodies.map((b) => {
          const m = snap?.mandates.find((x) => x.id === b.id);
          if (!m) return null;
          const left = `${(b.x * 0.5 + 0.5) * 100}%`;
          // Drop the label clear of the body's halo instead of centring it in
          // the glow, where it was unreadable.
          const top = `${(1 - (b.y * 0.5 + 0.5)) * 100 + b.radius * 52}%`;
          return (
            <button
              key={b.id}
              onClick={() => setSelected(selected === b.id ? null : b.id)}
              className="fig"
              style={{
                position: "absolute",
                left,
                top,
                transform: "translate(-50%, 0)",
                pointerEvents: "auto",
                background: "transparent",
                border: 0,
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: "center",
                padding: "0.4rem",
                lineHeight: 1.3,
              }}
              aria-label={`Mandate ${m.id}, ${CATEGORY_NAMES[m.category]}, ${bnb(m.capitalWei)} BNB`}
            >
              <span style={{ display: "block", fontSize: 13, letterSpacing: "-0.02em" }}>
                {bnb(m.capitalWei)}
              </span>
              <span
                className="label"
                style={{
                  display: "block",
                  fontSize: 9,
                  opacity: selected === b.id ? 1 : 0.62,
                }}
              >
                {short(m.agent)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ chrome */}
      <header
        className="shell"
        style={{
          position: "absolute",
          insetInline: 0,
          top: 0,
          zIndex: 2,
          paddingTop: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "1rem",
          pointerEvents: "none",
        }}
      >
        <span className="fig" style={{ fontSize: 13, letterSpacing: "0.34em", fontWeight: 500 }}>
          MANDATE
        </span>
        <span
          style={{
            display: "flex",
            gap: "1.25rem",
            alignItems: "center",
            pointerEvents: "auto",
          }}
        >
          <span className="label">
            {connected ? "live" : "reconnecting"} · block {snap?.blockNumber ?? "—"}
          </span>
          <WalletChip />
        </span>
      </header>

      <div
        className="shell"
        style={{
          position: "absolute",
          insetInline: 0,
          top: "4.5rem",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <h1
          className="display"
          style={{
            fontSize: "clamp(2rem, 5.5vw, 5rem)",
            maxWidth: "14ch",
            lineHeight: 0.95,
          }}
        >
          Agents bid for your capital with their own.
        </h1>
      </div>

      {/* Category rails, so the floor reads as sections rather than a scatter */}
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: "13rem",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          pointerEvents: "none",
          paddingInline: "var(--gutter)",
        }}
      >
        {CATEGORY_NAMES.map((c) => (
          <div key={c} className="label" style={{ textAlign: "center", fontSize: 9.5 }}>
            {c}
          </div>
        ))}
      </div>

      {/* -------------------------------------------------------------- tape */}
      <div
        className="shell"
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          zIndex: 2,
          paddingBottom: "1.25rem",
          display: "grid",
          gap: "0.75rem",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "clamp(1rem, 4vw, 3rem)",
            flexWrap: "wrap",
            borderTop: "1px solid var(--rule)",
            paddingTop: "0.85rem",
          }}
        >
          <Figure label="under mandate" value={`${bnb(totals?.underMandate ?? "0")} BNB`} />
          <Figure label="bonded by agents" value={`${bnb(totals?.bonded ?? "0")} BNB`} accent />
          <Figure label="mandates active" value={String(totals?.active ?? 0)} />
          <Figure
            label="contract"
            value={snap ? `${snap.market.slice(0, 10)}…` : "—"}
            mono
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <button
              onClick={() => setBook((v) => !v)}
              className="label"
              style={{
                background: "transparent",
                border: "1px solid var(--rule)",
                color: "var(--ink-70)",
                padding: "0.4rem 0.9rem",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            >
              the book
            </button>
            <WithdrawButton />
            <button
              onClick={() => {
                setOpening(true);
                setSelected(null);
              }}
              className="label"
              style={{
                background: "var(--ink)",
                border: "1px solid var(--ink)",
                color: "var(--paper)",
                padding: "0.4rem 0.9rem",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            >
              open a mandate
            </button>
          </div>
        </div>

        <div
          className="scroll-x"
          style={{
            display: "flex",
            gap: "1.5rem",
            fontSize: 11.5,
            fontFamily: "var(--font-mono)",
            color: "var(--ink-45)",
            whiteSpace: "nowrap",
            minHeight: "1.4em",
          }}
        >
          {tape.length === 0 ? (
            <span>waiting for the next settlement…</span>
          ) : (
            tape.slice(0, 12).map((t) => (
              <span
                key={t.key}
                style={{
                  color:
                    t.tone === "gain"
                      ? "var(--gold-deep)"
                      : t.tone === "event"
                        ? "var(--ink)"
                        : "var(--ink-45)",
                }}
              >
                {t.text}
              </span>
            ))
          )}
        </div>
      </div>

      {book ? <Standings onClose={() => setBook(false)} /> : null}

      {opening ? (
        <aside
          style={{
            position: "absolute",
            right: "var(--gutter)",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 3,
            width: "min(92vw, 22rem)",
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            padding: "1.25rem",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          <div className="label">open a mandate</div>
          <div className="display" style={{ fontSize: "1.4rem", lineHeight: 1.1 }}>
            Put capital on the floor.
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <OpenMandatePanel onDone={() => setOpening(false)} />
          </div>
          <button
            onClick={() => setOpening(false)}
            className="label"
            style={{
              justifySelf: "start",
              marginTop: "0.4rem",
              background: "transparent",
              border: 0,
              color: "var(--ink-45)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            close
          </button>
        </aside>
      ) : null}

      {/* ------------------------------------------------------------ detail */}
      {chosen ? (
        <aside
          style={{
            position: "absolute",
            right: "var(--gutter)",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 3,
            width: "min(92vw, 22rem)",
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            padding: "1.25rem",
            display: "grid",
            gap: "0.6rem",
          }}
        >
          <div className="label">mandate {chosen.id}</div>
          <div className="display" style={{ fontSize: "1.5rem" }}>
            {CATEGORY_NAMES[chosen.category]}
          </div>
          <Row k="state" v={STATE_NAMES[chosen.state]} />
          <Row k="capital" v={`${bnb(chosen.capitalWei)} BNB`} />
          <Row k="holder" v={short(chosen.agent)} />
          <Row k="bond at risk" v={`${bnb(chosen.bondWei)} BNB`} />
          <Row
            k="cumulative alpha"
            v={pct(chosen.cumulativeAlphaBps)}
            accent={chosen.cumulativeAlphaBps > 0}
          />
          <Row k="epochs" v={`${chosen.epochsSettled}/${chosen.epochsTotal}`} />
          <Row k="strikes" v={`${chosen.strikes}/3`} />
          <Row k="successor" v={short(chosen.successor ?? ZERO)} />

          <div
            style={{
              marginTop: "0.6rem",
              paddingTop: "0.9rem",
              borderTop: "1px solid var(--ink)",
            }}
          >
            <BidPanel mandate={chosen} />
          </div>

          <button
            onClick={() => setSelected(null)}
            className="label"
            style={{
              justifySelf: "start",
              marginTop: "0.4rem",
              background: "transparent",
              border: 0,
              color: "var(--ink-45)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            close
          </button>
        </aside>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        className="fig"
        style={{
          fontSize: mono ? "0.95rem" : "clamp(1.1rem, 2vw, 1.6rem)",
          letterSpacing: "-0.02em",
          color: accent ? "var(--gold-deep)" : "var(--ink)",
        }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        borderTop: "1px solid var(--ink-06)",
        paddingTop: "0.4rem",
      }}
    >
      <span className="label">{k}</span>
      <span
        className="fig"
        style={{ fontSize: 12, color: accent ? "var(--gold-deep)" : "var(--ink)" }}
      >
        {v}
      </span>
    </div>
  );
}
