/**
 * Where PancakeSwap V3 liquidity is thin against the demand crossing it.
 *
 *   npm run pool-gap                     read a window and print the ranking
 *   npm run pool-gap -- --publish        and store it as the reading /pool-gaps shows
 *
 * The method, and what it does not claim, live in lib/pancake/pool-gap, which
 * the scheduled job uses too, so this script and the page cannot disagree.
 * Here the whole window is read in one sitting, since a laptop has no function
 * budget; the site reads the same window in slices.
 */

import { marketClient } from "@/lib/chain/market";
import { store } from "@/lib/data/snapshots";
import { CHUNK_BLOCKS, FIRST_SPAN, candidatesOf, nextSpan, rankPools, readPools, swapLogs, tallySwaps, type PoolGapReading, type Tally } from "@/lib/pancake/pool-gap";

const WINDOW = Number(process.env.POOL_GAP_BLOCKS ?? "20000");
const publish = process.argv.includes("--publish");

const head = Number(await marketClient.getBlockNumber());
const from = head - WINDOW + 1;
console.log(`\n  scanning blocks ${from} to ${head} (${WINDOW} blocks, about ${((WINDOW * 0.45) / 3600).toFixed(1)} h)\n`);

const tally: Tally = {};
let swaps = 0;
let span = FIRST_SPAN;
for (let cursor = from; cursor <= head; ) {
  const to = Math.min(head, cursor + span - 1);
  const logs = await swapLogs(cursor, to, 30_000).catch(() => null);
  span = nextSpan(span, Boolean(logs), CHUNK_BLOCKS);
  if (!logs) continue;
  tallySwaps(logs, tally);
  swaps += logs.length;
  cursor = to + 1;
  process.stdout.write(`\r    ${to - from + 1}/${WINDOW} blocks · ${swaps} swaps`.padEnd(56));
}
process.stdout.write("\r".padEnd(56) + "\r");
console.log(`  ${swaps.toLocaleString()} swaps across ${Object.keys(tally).length} pools\n`);

const rows = await readPools(candidatesOf(tally), tally);
const { ranked, empty } = rankPools(rows);

console.log("  Highest turnover: how many times each pool's depth at the current price traded through it\n");
console.log(`  ${"pair".padEnd(22)} ${"fee".padStart(6)} ${"swaps".padStart(7)} ${"turnover".padStart(10)}  pool`);
console.log(`  ${"-".repeat(22)} ${"-".repeat(6)} ${"-".repeat(7)} ${"-".repeat(10)}  ${"-".repeat(12)}`);
for (const r of ranked) {
  console.log(
    `  ${`${r.symbol0}/${r.symbol1}`.slice(0, 22).padEnd(22)} ${`${(r.fee / 10_000).toFixed(2)}%`.padStart(6)} ${String(r.swaps).padStart(7)} ${`${r.turnover!.toFixed(2)}x`.padStart(10)}  ${r.pool.slice(0, 12)}…`,
  );
}
if (empty.length) {
  console.log(`\n  ${empty.length} busy pool(s) had nothing in range at the current price:`);
  for (const r of empty.slice(0, 5)) console.log(`    ${r.symbol0}/${r.symbol1} ${(r.fee / 10_000).toFixed(2)}% · ${r.swaps} swaps · ${r.pool}`);
}

console.log(`
  Turnover says demand is arriving faster than depth is being supplied. It
  does not say a pool is mispriced, that adding liquidity there would pay, or
  that the fee tier is wrong. ${rows.length} pools with 20 or more swaps were
  read at head; pools that traded less are left out on purpose.
`);

if (publish) {
  const [b0, b1] = await Promise.all([marketClient.getBlock({ blockNumber: BigInt(from) }), marketClient.getBlock({ blockNumber: BigInt(head) })]);
  const reading: PoolGapReading = {
    from,
    to: head,
    blocks: WINDOW,
    hours: (Number(b1.timestamp) - Number(b0.timestamp)) / 3600,
    swaps,
    poolsTraded: Object.keys(tally).length,
    poolsRead: rows.length,
    ranked,
    empty: empty.slice(0, 5),
    readAt: new Date().toISOString(),
  };
  await store("pool-gap", reading, reading.readAt);
  console.log("  published as the reading /pool-gaps shows\n");
}
process.exit(0);
