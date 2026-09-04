/**
 * Settles a mandate from measurement.
 *
 *   npx tsx --env-file=.env src/scripts/settle.ts open <mandateId> <wallet>
 *   npx tsx --env-file=.env src/scripts/settle.ts measure <mandateId>
 *   npx tsx --env-file=.env src/scripts/settle.ts settle <mandateId>
 *
 * `measure` reads and prints without sending, which is the check that a figure
 * is real before it is written to a contract that slashes against it.
 */

import type { Address, Hex } from "viem";
import {
  MANDATE_MARKET_ABI,
  MARKET_ADDRESS,
  marketChain,
  marketClient,
  readMandate,
  walletFor,
} from "@/lib/chain/market";
import { measureAlpha, openBenchmark, readBenchmark, recordEpoch } from "@/lib/settlement";

const norm = (k?: string) => (k?.startsWith("0x") ? k : `0x${k}`) as Hex;
const cmd = process.argv[2];
const id = Number(process.argv[3] ?? 0);

if (cmd === "open") {
  const wallet = process.argv[4] as Address;
  if (!wallet) {
    console.error("usage: settle.ts open <mandateId> <wallet>");
    process.exit(1);
  }
  const b = await openBenchmark(id, wallet);
  console.log(`benchmark opened for mandate ${id}`);
  console.log(`  wallet   ${b.wallet}`);
  console.log(`  value    ${b.openBnb.toFixed(8)} BNB at $${b.openPriceUsd.toFixed(2)}`);
  process.exit(0);
}

const m = await measureAlpha(id);
console.log(`mandate ${id}`);
console.log(`  ${m.explanation}`);
if (m.alphaBps !== null) {
  console.log(`  alpha this epoch: ${m.alphaBps >= 0 ? "+" : ""}${(m.alphaBps / 100).toFixed(2)}%  (${m.alphaBps} bps)`);
  for (const p of m.valuation.parts) {
    console.log(`    ${p.asset.padEnd(5)} ${p.amount.toFixed(8)} = ${p.bnb.toFixed(8)} BNB`);
  }
}

if (cmd !== "settle") {
  console.log("\nmeasurement only — nothing sent.");
  process.exit(0);
}

if (m.alphaBps === null) {
  console.error("\nrefusing to settle: alpha is not measurable, and a made-up figure is what this replaced.");
  process.exit(1);
}

const mandate = await readMandate(id);
const wallet = walletFor(norm(process.env.PRIVATE_KEY));
const hash = await wallet.writeContract({
  address: MARKET_ADDRESS,
  abi: MANDATE_MARKET_ABI,
  functionName: "settleEpoch",
  args: [BigInt(id), BigInt(m.alphaBps)],
  chain: marketChain,
  account: wallet.account!,
} as never);
const receipt = await marketClient.waitForTransactionReceipt({ hash });
recordEpoch(id, mandate.epochsSettled, m);

console.log(`\nsettled epoch ${mandate.epochsSettled} at ${(m.alphaBps / 100).toFixed(2)}%`);
console.log(`  https://bscscan.com/tx/${hash}  (block ${receipt.blockNumber})`);
