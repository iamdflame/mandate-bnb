/**
 * Measured settlement.
 *
 * This replaces the thing that made everything else a demo. Realized alpha was
 * previously drawn from a gaussian and reported to the contract, which then
 * slashed real BNB against a random number. Here it is a difference between
 * two measurements of the same wallet.
 *
 * The benchmark is holding. A mandate's capital, left alone, is worth exactly
 * what it was worth in BNB terms — so measuring the managed wallet in BNB and
 * comparing it to the value recorded at award time gives the agent's alpha
 * over doing nothing, which is the only comparison that means anything.
 *
 * Two honesties are built in:
 *
 *   - Gas is included. An agent that trades its way to a smaller balance has
 *     lost, and hiding execution cost is how strategies flatter themselves.
 *   - A measurement that cannot be taken returns null rather than zero. The
 *     adjudicator then declines to settle instead of reporting a made-up
 *     flat epoch.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Address } from "viem";
import { valueWallet, type Valuation } from "@/lib/chain/prices";

const DIR = ".benchmarks";
const path = (mandateId: number) => `${DIR}/mandate-${mandateId}.json`;

export interface Benchmark {
  mandateId: number;
  /** Wallet value in BNB when the mandate was awarded. */
  openBnb: number;
  /** BNB price then, recorded so a report can show the move in dollars too. */
  openPriceUsd: number;
  wallet: string;
  openedAt: string;
  /** Value at each settled epoch, so a term can be reconstructed. */
  epochs: { epoch: number; bnb: number; priceUsd: number; alphaBps: number; at: string }[];
}

/** Records where a mandate started. Nothing can be settled without this. */
export async function openBenchmark(mandateId: number, wallet: Address): Promise<Benchmark> {
  const v = await valueWallet(wallet);
  const b: Benchmark = {
    mandateId,
    openBnb: v.bnb,
    openPriceUsd: v.priceUsd,
    wallet,
    openedAt: new Date().toISOString(),
    epochs: [],
  };
  mkdirSync(DIR, { recursive: true });
  writeFileSync(path(mandateId), JSON.stringify(b, null, 2));
  return b;
}

export function readBenchmark(mandateId: number): Benchmark | null {
  const p = path(mandateId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Benchmark;
}

export interface Measurement {
  mandateId: number;
  /** Basis points against the hold benchmark. Null when unmeasurable. */
  alphaBps: number | null;
  openBnb: number;
  nowBnb: number;
  priceUsd: number;
  /** Reason, always — including when the answer is null. */
  explanation: string;
  valuation: Valuation;
  at: string;
}

/**
 * Measures a mandate's realized alpha since the previous settlement.
 *
 * Alpha is per-epoch, not cumulative: the contract adds each epoch's figure to
 * a running total itself, so reporting cumulative alpha every epoch would
 * compound it.
 */
export async function measureAlpha(mandateId: number): Promise<Measurement> {
  const bench = readBenchmark(mandateId);
  const at = new Date().toISOString();

  if (!bench) {
    return {
      mandateId,
      alphaBps: null,
      openBnb: 0,
      nowBnb: 0,
      priceUsd: 0,
      explanation:
        "no benchmark recorded for this mandate; nothing to measure against, so it cannot be settled",
      valuation: { bnb: 0, usd: 0, parts: [], priceUsd: 0, at },
      at,
    };
  }

  const v = await valueWallet(bench.wallet as Address);

  // Compare against the previous settlement, or the open if this is the first.
  const previous = bench.epochs.length
    ? bench.epochs[bench.epochs.length - 1].bnb
    : bench.openBnb;

  if (previous <= 0) {
    return {
      mandateId,
      alphaBps: null,
      openBnb: bench.openBnb,
      nowBnb: v.bnb,
      priceUsd: v.priceUsd,
      explanation:
        "the reference value is zero, so a proportional change is undefined; declining to settle",
      valuation: v,
      at,
    };
  }

  const ratio = v.bnb / previous;
  const alphaBps = Math.round((ratio - 1) * 10_000);

  return {
    mandateId,
    alphaBps,
    openBnb: bench.openBnb,
    nowBnb: v.bnb,
    priceUsd: v.priceUsd,
    explanation:
      `wallet held ${previous.toFixed(8)} BNB at the last mark and holds ${v.bnb.toFixed(8)} now, ` +
      `so ${alphaBps >= 0 ? "+" : ""}${(alphaBps / 100).toFixed(2)}% against holding — gas included`,
    valuation: v,
    at,
  };
}

/** Records a settled epoch so the next measurement compares against it. */
export function recordEpoch(mandateId: number, epoch: number, m: Measurement): void {
  const bench = readBenchmark(mandateId);
  if (!bench || m.alphaBps === null) return;
  bench.epochs.push({
    epoch,
    bnb: m.nowBnb,
    priceUsd: m.priceUsd,
    alphaBps: m.alphaBps,
    at: m.at,
  });
  writeFileSync(path(mandateId), JSON.stringify(bench, null, 2));
}
