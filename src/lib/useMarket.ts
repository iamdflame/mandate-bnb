"use client";

/**
 * One live subscription to the market, shared by every section of the page.
 *
 * Previously each panel opened its own stream. One connection, one source of
 * truth, and the derived tape is computed once rather than per component.
 */

import { useEffect, useRef, useState } from "react";
import type { FloorMandate, FloorSnapshot } from "@/app/api/floor/route";

export type TapeTone = "settle" | "gain" | "loss" | "slash" | "dismissal" | "award";

export interface TapeEntry {
  key: string;
  mandateId: number;
  text: string;
  tone: TapeTone;
  at: string;
}

const ZERO = "0x0000000000000000000000000000000000000000";
const short = (a: string) => (a && a !== ZERO ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
const pct = (bps: number) => `${bps > 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`;

export function bnb(wei: string | bigint | undefined, dp?: number): string {
  if (wei === undefined) return "—";
  const n = Number(BigInt(wei)) / 1e18;
  if (dp !== undefined) return n.toFixed(dp);
  if (n === 0) return "0";
  // Precision follows magnitude: a 0.0025 BNB position is real, not zero.
  const places = n >= 100 ? 1 : n >= 1 ? 2 : n >= 0.01 ? 3 : n >= 0.0001 ? 5 : 7;
  return n.toFixed(places);
}

export interface MarketState {
  snapshot: FloorSnapshot | null;
  tape: TapeEntry[];
  connected: boolean;
  /** Mandate ids dismissed since the renderer last consumed them. */
  ruptures: number[];
  settlementTick: number;
}

export function useMarket() {
  const [snapshot, setSnapshot] = useState<FloorSnapshot | null>(null);
  const [tape, setTape] = useState<TapeEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const previous = useRef<Map<number, FloorMandate>>(new Map());
  const signals = useRef({ ruptures: [] as number[], settlementTick: 0 });

  useEffect(() => {
    const es = new EventSource("/api/floor");

    es.addEventListener("state", (ev) => {
      setConnected(true);
      const next = JSON.parse((ev as MessageEvent).data) as FloorSnapshot;
      setSnapshot(next);

      const entries: TapeEntry[] = [];
      for (const m of next.mandates) {
        const before = previous.current.get(m.id);
        if (!before) continue;

        if (m.epochsSettled > before.epochsSettled) {
          const delta = m.cumulativeAlphaBps - before.cumulativeAlphaBps;
          entries.push({
            key: `${m.id}-e${m.epochsSettled}`,
            mandateId: m.id,
            text: `epoch ${m.epochsSettled} settled ${pct(delta)}`,
            tone: delta >= 0 ? "gain" : "loss",
            at: next.at,
          });
        }

        if (BigInt(m.bondWei) < BigInt(before.bondWei)) {
          const slashed = BigInt(before.bondWei) - BigInt(m.bondWei);
          entries.push({
            key: `${m.id}-s${m.epochsSettled}`,
            mandateId: m.id,
            text: `bond slashed ${bnb(slashed.toString())} BNB`,
            tone: "slash",
            at: next.at,
          });
        }

        if (m.agent.toLowerCase() !== before.agent.toLowerCase()) {
          const wasHeld = before.agent !== ZERO;
          const isHeld = m.agent !== ZERO;
          // Only a change of holder is a dismissal; unheld to held is an award.
          if (wasHeld) signals.current.ruptures.push(m.id);
          entries.push({
            key: `${m.id}-a${m.epochsSettled}-${m.agent}`,
            mandateId: m.id,
            text: !wasHeld
              ? `awarded to ${short(m.agent)}`
              : isHeld
                ? `${short(before.agent)} dismissed · ${short(m.agent)} takes over`
                : `${short(before.agent)} dismissed · no successor`,
            tone: wasHeld ? "dismissal" : "award",
            at: next.at,
          });
        }
      }

      previous.current = new Map(next.mandates.map((m) => [m.id, m]));
      if (entries.length) {
        signals.current.settlementTick += 1;
        setTape((t) => [...entries.reverse(), ...t].slice(0, 60));
      }
    });

    es.addEventListener("stale", () => setConnected(false));
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return { snapshot, tape, connected, signals };
}
