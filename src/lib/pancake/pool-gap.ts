/**
 * Where PancakeSwap V3 liquidity is thin against the demand crossing it.
 *
 * PancakeSwap's brief asked for exactly this: "researching market movements
 * to find demand where creating PancakeSwap pools could improve liquidity
 * efficiency." The method is deliberately narrow, because a wide one would be
 * a guess. For every V3 pool that traded in a window of blocks, two things are
 * read from the chain: how much of token0 crossed it, from every Swap event,
 * and how deep it stands at the current price, from its liquidity and price.
 *
 * Turnover is the first over the second: how many times the pool's depth at
 * the current price traded through it in the window. Liquidity alone carries
 * the pair's price in its units, so volume over liquidity ranks pairs by their
 * price level as much as by their demand; dividing by the virtual token0
 * reserve instead, L / sqrt(P), makes the figure a plain multiple that means
 * the same thing for every pair.
 *
 * What this does not claim: that a high-turnover pool is mispriced, that adding
 * liquidity there would pay, or that its fee tier is wrong. Turnover says where
 * demand is arriving faster than depth, which is where to look, and nothing more.
 *
 * A window of all V3 swaps on BSC is large, about 24,000 swaps and 24 MB per
 * thousand blocks, so the scheduled reading walks it in chunks with a cursor
 * kept in the database, and publishes only once the whole window is read.
 */

import { parseAbi, type Address } from "viem";
import { LOG_RPCS, marketClient } from "@/lib/chain/market";
import { snapshot, store, warm } from "@/lib/data/snapshots";
import { withLease } from "@/lib/db/lease";

export const SWAP_TOPIC = "0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83";
/** Pools with fewer swaps than this in the window are left out: too little traffic to rank. */
export const MIN_SWAPS = 20;
/** The busiest pools by swap count whose state is read. */
export const MAX_POOLS = 60;
export const TOP = 12;

export interface RawSwapLog {
  address: string;
  data: string;
}

/** Swaps and absolute token0 flow per pool, with volumes as decimal strings so the tally survives JSON. */
export type Tally = Record<string, { swaps: number; volume0: string }>;

/** Adds a chunk of Swap logs into a running tally. amount0 is the first data word, a signed int256. */
export function tallySwaps(logs: RawSwapLog[], into: Tally = {}): Tally {
  for (const l of logs) {
    const body = l.data.startsWith("0x") ? l.data.slice(2) : l.data;
    if (body.length < 64) continue;
    let a0 = BigInt(`0x${body.slice(0, 64)}`);
    if (a0 >= 1n << 255n) a0 -= 1n << 256n;
    const key = l.address.toLowerCase();
    const prior = into[key] ?? { swaps: 0, volume0: "0" };
    into[key] = { swaps: prior.swaps + 1, volume0: (BigInt(prior.volume0) + (a0 < 0n ? -a0 : a0)).toString() };
  }
  return into;
}

/** The pools worth reading state for: at least MIN_SWAPS, busiest first. */
export function candidatesOf(tally: Tally, min = MIN_SWAPS, max = MAX_POOLS): string[] {
  return Object.entries(tally)
    .filter(([, v]) => v.swaps >= min)
    .sort((a, b) => b[1].swaps - a[1].swaps)
    .slice(0, max)
    .map(([pool]) => pool);
}

const Q96 = 2n ** 96n;

/**
 * How many times the pool's depth at the current price traded through it.
 *
 * The virtual token0 reserve of a V3 pool at price P is L / sqrt(P), with
 * sqrt(P) = sqrtPriceX96 / 2^96 in raw units. Volume over that reserve is a
 * plain multiple. Null when the pool has no liquidity in range, which is a
 * different finding from a small number and is reported apart.
 */
export function turnoverOf(volume0: bigint, liquidity: bigint, sqrtPriceX96: bigint): number | null {
  if (liquidity === 0n || sqrtPriceX96 === 0n) return null;
  // volume0 * sqrtP / L, kept in integers until the last step so large pools do not lose precision.
  const scaled = (volume0 * sqrtPriceX96 * 1_000_000n) / (liquidity * Q96);
  return Number(scaled) / 1_000_000;
}

export interface PoolRow {
  pool: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  /** Fee in hundredths of a basis point, as the pool stores it: 500 is 0.05%. */
  fee: number;
  swaps: number;
  /** token0 that crossed the pool in the window, in whole tokens. */
  volume0: number;
  /** Null when nothing was in range at the current price. */
  turnover: number | null;
}

/** Highest turnover first. Pools with nothing in range are not ranked; they are listed separately. */
export function rankPools(rows: PoolRow[], top = TOP): { ranked: PoolRow[]; empty: PoolRow[] } {
  const ranked = rows
    .filter((r): r is PoolRow & { turnover: number } => r.turnover !== null && Number.isFinite(r.turnover))
    .sort((a, b) => b.turnover - a.turnover || b.swaps - a.swaps)
    .slice(0, top);
  const empty = rows.filter((r) => r.turnover === null).sort((a, b) => b.swaps - a.swaps);
  return { ranked, empty };
}

/** A window being read, chunk by chunk. */
export interface Progress {
  from: number;
  to: number;
  /** The next block to read. Past `to` means the logs are done. */
  cursor: number;
  /** Blocks per request, adapted to how fast the provider is answering today. */
  span: number;
  tally: Tally;
  swaps: number;
  startedAt: string;
}

/** A request that failed gets half the blocks next time; one that answered gets half as many again, up to the cap. */
export function nextSpan(span: number, ok: boolean, max: number, min = 20): number {
  return ok ? Math.min(max, Math.ceil(span * 1.5)) : Math.max(min, Math.floor(span / 2));
}

export type Step =
  | { kind: "idle"; why: string }
  | { kind: "start" }
  | { kind: "read"; from: number; to: number }
  | { kind: "publish" };

/**
 * What the next slice of work is.
 *
 * A window in progress is always finished before another starts, so a slow
 * week never leaves two half-read windows. A new one starts only when the last
 * published reading is older than the cadence.
 */
export function nextStep(progress: Progress | null, lastPublished: string | null, now: number, opts: { cadenceMs: number }): Step {
  if (progress) {
    if (progress.cursor > progress.to) return { kind: "publish" };
    return { kind: "read", from: progress.cursor, to: Math.min(progress.to, progress.cursor + progress.span - 1) };
  }
  const age = lastPublished ? now - Date.parse(lastPublished) : Number.POSITIVE_INFINITY;
  if (age < opts.cadenceMs) return { kind: "idle", why: `the last reading is ${Math.round(age / 3_600_000)} h old` };
  return { kind: "start" };
}

// ---------------------------------------------------------------------------
// Reading the chain, a slice at a time
// ---------------------------------------------------------------------------


/** About half an hour of BSC at 0.45 seconds a block, some 95,000 swaps. The page states whatever window was read. */
export const WINDOW_BLOCKS = Number(process.env.POOL_GAP_BLOCKS ?? 4_000);
/**
 * Blocks per request, at most and to start with. A thousand blocks of V3 swaps
 * is about 24,000 logs, and the one free provider that serves a query across
 * every pool answers at around a thousand logs a second on a good day and
 * times out on a bad one, so requests start small and adapt.
 */
export const CHUNK_BLOCKS = 1_000;
export const FIRST_SPAN = 200;
export const CADENCE_MS = 12 * 3_600_000;

export interface PoolGapReading {
  from: number;
  to: number;
  blocks: number;
  /** Wall-clock length of the window, from its first and last block. */
  hours: number | null;
  swaps: number;
  poolsTraded: number;
  poolsRead: number;
  ranked: PoolRow[];
  empty: PoolRow[];
  readAt: string;
}

const POOL = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
]);
const ERC20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

const hex = (n: number) => `0x${n.toString(16)}`;
// A provider's error without the provider's URL: a configured log RPC can carry a key.
const scrub = (e: unknown) => ((e as Error)?.message ?? String(e)).split("\n")[0]!.replace(/https?:\/\/\S+/g, "<rpc>").slice(0, 160);

/**
 * One chunk of Swap logs from every V3 pool, from the first log provider that answers.
 *
 * A query across every pool is refused by most free providers outright, so a
 * refusal comes back fast and the next one is tried; the one that serves it
 * gets twenty seconds, and a slower answer counts as no answer.
 */
export async function swapLogs(from: number, to: number, timeoutMs = 20_000): Promise<RawSwapLog[]> {
  let last = "no log provider is configured";
  for (const url of LOG_RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getLogs", params: [{ fromBlock: hex(from), toBlock: hex(to), topics: [SWAP_TOPIC] }] }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json()) as { result?: RawSwapLog[]; error?: { message?: string } };
      if (Array.isArray(body.result)) return body.result;
      last = body.error?.message ?? `answered ${res.status}`;
    } catch (e) {
      last = scrub(e);
    }
  }
  throw new Error(`no provider served the logs for blocks ${from} to ${to}: ${last.slice(0, 120)}`);
}

/** State at head for the busiest pools, and the names of their tokens, in a few multicalls. */
export async function readPools(pools: string[], tally: Tally): Promise<PoolRow[]> {
  const calls = pools.flatMap((p) =>
    (["token0", "token1", "fee", "liquidity", "slot0"] as const).map((functionName) => ({ address: p as Address, abi: POOL, functionName })),
  );
  const state = await marketClient.multicall({ contracts: calls, allowFailure: true, batchSize: 4_096 });
  const at = (i: number, k: number) => state[i * 5 + k];
  const tokens = new Set<string>();
  pools.forEach((_, i) => {
    for (const k of [0, 1]) if (at(i, k)?.status === "success") tokens.add(String(at(i, k)!.result).toLowerCase());
  });
  const list = [...tokens];
  const meta = await marketClient.multicall({
    contracts: list.flatMap((t) => [
      { address: t as Address, abi: ERC20, functionName: "symbol" as const },
      { address: t as Address, abi: ERC20, functionName: "decimals" as const },
    ]),
    allowFailure: true,
    batchSize: 4_096,
  });
  const names = new Map(
    list.map((t, j) => [
      t,
      {
        // A token that will not name itself is still a token.
        symbol: meta[j * 2]?.status === "success" ? String(meta[j * 2]!.result).slice(0, 16) : `${t.slice(0, 6)}…`,
        decimals: meta[j * 2 + 1]?.status === "success" ? Number(meta[j * 2 + 1]!.result) : 18,
      },
    ]),
  );

  const rows: PoolRow[] = [];
  pools.forEach((pool, i) => {
    const parts = [0, 1, 2, 3, 4].map((k) => at(i, k));
    if (parts.some((p) => p?.status !== "success")) return;
    const [t0, t1, fee, liquidity, slot0] = parts.map((p) => p!.result) as [string, string, number, bigint, readonly [bigint, ...unknown[]]];
    const n0 = names.get(t0.toLowerCase()) ?? { symbol: `${t0.slice(0, 6)}…`, decimals: 18 };
    const n1 = names.get(t1.toLowerCase()) ?? { symbol: `${t1.slice(0, 6)}…`, decimals: 18 };
    const v = BigInt(tally[pool]?.volume0 ?? "0");
    rows.push({
      pool,
      token0: t0,
      token1: t1,
      symbol0: n0.symbol,
      symbol1: n1.symbol,
      fee: Number(fee),
      swaps: tally[pool]?.swaps ?? 0,
      volume0: Number(v) / 10 ** n0.decimals,
      turnover: turnoverOf(v, liquidity, slot0[0]),
    });
  });
  return rows;
}

async function blockTime(n: number): Promise<number | null> {
  const b = await marketClient.getBlock({ blockNumber: BigInt(n) }).catch(() => null);
  return b ? Number(b.timestamp) : null;
}

/** The last published reading. */
export function poolGapReading(): { payload: PoolGapReading; capturedAt: string } | null {
  const s = snapshot<PoolGapReading>("pool-gap");
  return s && Array.isArray((s.payload as PoolGapReading).ranked) ? s : null;
}

/** A window being read right now, if one is. */
export function poolGapProgress(): Progress | null {
  const s = snapshot<Progress | { done: true }>("pool-gap-progress");
  return s && "cursor" in (s.payload as object) ? (s.payload as Progress) : null;
}

/**
 * One slice of the scheduled work: start a window, read chunks of it, or
 * publish it. Runs after the tick's response, inside the function's time, and
 * under a lease so two overlapping ticks never read the same chunk twice.
 */
export async function continuePoolGap(opts: { budgetMs: number; now?: number }): Promise<string> {
  const started = Date.now();
  const left = () => opts.budgetMs - (Date.now() - started);
  const out = await withLease("pool-gap", Math.ceil(opts.budgetMs / 1000) + 15, async () => {
    await warm(["pool-gap", "pool-gap-progress"]);
    let progress = poolGapProgress();
    const notes: string[] = [];
    for (;;) {
      const step = nextStep(progress, poolGapReading()?.capturedAt ?? null, opts.now ?? Date.now(), { cadenceMs: CADENCE_MS });
      if (step.kind === "idle") return notes.concat(`idle: ${step.why}`).join("; ");
      if (step.kind === "start") {
        const head = Number(await marketClient.getBlockNumber());
        progress = { from: head - WINDOW_BLOCKS + 1, to: head, cursor: head - WINDOW_BLOCKS + 1, span: FIRST_SPAN, tally: {}, swaps: 0, startedAt: new Date().toISOString() };
        await store("pool-gap-progress", progress);
        notes.push(`started blocks ${progress.from} to ${progress.to}`);
        continue;
      }
      // A request can take its whole twenty seconds; none is started that could not finish inside the slice.
      if (left() < 22_000 && step.kind === "read") return notes.concat(`paused at block ${progress!.cursor}`).join("; ");
      if (step.kind === "read") {
        const p = progress!;
        const logs = await swapLogs(step.from, step.to).catch(() => null);
        progress = logs
          ? { ...p, tally: tallySwaps(logs, p.tally), swaps: p.swaps + logs.length, cursor: step.to + 1, span: nextSpan(p.span, true, CHUNK_BLOCKS) }
          : { ...p, span: nextSpan(p.span, false, CHUNK_BLOCKS) };
        await store("pool-gap-progress", progress);
        notes.push(logs ? `read ${step.from} to ${step.to}: ${logs.length} swaps` : `blocks ${step.from} to ${step.to} timed out; next request ${progress.span} blocks`);
        continue;
      }
      if (left() < 12_000) return notes.concat("pools to be read next").join("; ");
      // publish
      const p = progress!;
      const rows = await readPools(candidatesOf(p.tally), p.tally);
      const { ranked, empty } = rankPools(rows);
      const [t0, t1] = await Promise.all([blockTime(p.from), blockTime(p.to)]);
      const reading: PoolGapReading = {
        from: p.from,
        to: p.to,
        blocks: p.to - p.from + 1,
        hours: t0 && t1 ? (t1 - t0) / 3600 : null,
        swaps: p.swaps,
        poolsTraded: Object.keys(p.tally).length,
        poolsRead: rows.length,
        ranked,
        empty: empty.slice(0, 5),
        readAt: new Date().toISOString(),
      };
      await store("pool-gap", reading, reading.readAt);
      await store("pool-gap-progress", { done: true });
      return notes.concat(`published ${ranked.length} pools from ${p.swaps} swaps`).join("; ");
    }
  });
  return out ?? "another slice holds the lease";
}
