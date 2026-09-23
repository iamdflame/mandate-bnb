/**
 * What an agent has actually done, where we hold the record.
 *
 * A performance section is the easiest place on an agent page to invent
 * something: a sparkline, a win rate, a return. So this only ever returns a
 * record that exists. Our reference agents act on the demo account and every
 * action they took is a mainnet transaction, so theirs are read from the
 * stored chain readings, losses included. Any other agent has a record only
 * once somebody paid it here and it delivered. Everything else is "not enough
 * settled history", with the reason, which is the honest state of almost
 * every agent in the registry.
 */

import type { GridWindow } from "@/lib/grid/window";
import { snapshot } from "@/lib/data/snapshots";
import { recenterRecord } from "@/lib/demo";
import { referenceRegistrations } from "@/lib/house";
import { pauseForSlug } from "@/lib/market/paused";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Figure {
  label: string;
  value: string;
  /** Good, bad or neither, so a loss is never styled like a gain. */
  tone?: "up" | "down";
}

export interface Performance {
  kind: "grid" | "recenter" | "run" | "settled" | "none";
  /** One line: what this record is. */
  title: string;
  figures: Figure[];
  /** A sentence in plain words, when the figures need one. */
  summary?: string;
  proof: { label: string; url: string }[];
  at: string | null;
  /** Where it was read from. */
  source: string;
}

const bsc = (tx: string) => `https://bscscan.com/tx/${tx}`;
const money = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(Math.abs(n) < 1 ? 4 : 2)}`;

function stored<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "src/data", name), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Which of our reference agents a token is, if any. */
export function houseSlug(tokenId: string): "range-1" | "grid-1" | "yield-1" | "guard-1" | null {
  const regs = referenceRegistrations();
  for (const slug of ["range-1", "grid-1", "yield-1", "guard-1"] as const) if (regs[slug]?.tokenId === tokenId) return slug;
  return null;
}

export function performanceOf(tokenId: string, settled: number): Performance {
  const slug = houseSlug(tokenId);

  if (slug === "grid-1") {
    const snap = snapshot<GridWindow>("grid-window");
    const g = snap?.payload ?? stored<GridWindow>("grid-window.json");
    if (g) {
      const last = g.fills[g.fills.length - 1];
      return {
        kind: "grid",
        title: `${g.fills.length} real fills over ${g.window.hours === null ? "its window" : `${g.window.hours < 1 ? `${Math.round(g.window.hours * 60)} minutes` : `${g.window.hours.toFixed(1)} hours`}`}`,
        figures: [
          { label: "Fills", value: String(g.fills.length) },
          { label: "Round trips won", value: g.winRate === null ? "none closed" : `${g.wins} of ${g.roundTrips.length}` },
          { label: "Against holding", value: money(g.pnlUsd), tone: g.pnlUsd >= 0 ? "up" : "down" },
          { label: "Worst drawdown", value: money(-g.maxDrawdownUsd), tone: g.maxDrawdownUsd > 0 ? "down" : undefined },
          { label: "Gas paid", value: money(g.gasUsd) },
        ],
        summary:
          g.pnlUsd < 0
            ? `It lost to simply holding over this window, mostly to gas on very small trades. The loss is published rather than hidden.${pauseForSlug("grid-1") ? " Grid-1 is paused: it is not offered for hire until a new window beats holding." : ""}`
            : "It beat simply holding over this window, net of gas.",
        proof: last ? [{ label: "Latest fill", url: bsc(last.tx) }] : [],
        at: g.readAt,
        source: `Every Swapped event from SwapBound between blocks ${g.fromBlock.toLocaleString("en-GB")} and ${g.toBlock.toLocaleString("en-GB")}`,
      };
    }
  }

  if (slug === "range-1") {
    const r = recenterRecord()?.latest;
    if (r) {
      return {
        kind: "recenter",
        title: "Recentered a drifted position, same owner throughout",
        figures: [
          { label: "Old position", value: `#${r.before.tokenId}` },
          { label: "New position", value: `#${r.after.tokenId}` },
          { label: "Now in range", value: r.after.inRange ? "Yes" : "No", tone: r.after.inRange ? "up" : "down" },
          { label: "Owner changed", value: r.sameOwnerThroughout ? "Never" : "Yes", tone: r.sameOwnerThroughout ? "up" : "down" },
        ],
        summary: "It took liquidity out of a range the price had left, collected it to the owner, and opened a new range around the price, through a contract that cannot pay anyone else.",
        proof: [
          { label: "Withdraw", url: bsc(r.txs.decreaseLiquidity) },
          { label: "Collect", url: bsc(r.txs.collect) },
          { label: "New position", url: bsc(r.txs.mint) },
        ],
        at: r.at,
        source: "Three mainnet transactions from its session on the demo account",
      };
    }
  }

  if (slug === "yield-1" || slug === "guard-1") {
    const run = stored<{ tx: string; summary: string; at?: string; before?: string; after?: string; trigger?: string }>(`${slug}.json`);
    if (run) {
      const figures: Figure[] =
        slug === "guard-1" && run.before && run.after
          ? [
              { label: "Health factor before", value: Number(run.before).toFixed(2), tone: "down" },
              { label: "After its repay", value: Number(run.after).toFixed(2), tone: "up" },
              { label: "Its trigger", value: run.trigger ? Number(run.trigger).toFixed(2) : "not set" },
            ]
          : [];
      return {
        kind: "run",
        title: slug === "guard-1" ? "Repaid a loan before it could be liquidated" : "Moved capital to the better rate",
        figures,
        summary: run.summary,
        proof: [{ label: "Transaction", url: bsc(run.tx) }],
        at: run.at ?? null,
        source: "A mainnet transaction from its session on the demo account",
      };
    }
  }

  if (settled > 0) {
    return {
      kind: "settled",
      title: `${settled} paid job${settled === 1 ? "" : "s"} delivered through this marketplace`,
      figures: [{ label: "Paid and delivered", value: String(settled), tone: "up" }],
      proof: [],
      at: null,
      source: "Payments settled on chain whose answer came back",
    };
  }

  return {
    kind: "none",
    title: "Not enough settled history",
    figures: [],
    summary:
      "Nobody has paid it through this marketplace and had the work delivered yet, so there is no result to measure. We will not draw one. When it is hired, the outcome appears here whether it flatters the agent or not.",
    proof: [],
    at: null,
    source: "Paid calls and escrowed jobs on this marketplace",
  };
}
