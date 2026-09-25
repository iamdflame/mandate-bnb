/**
 * A paid call's settlement, read back from the chain.
 *
 * The seller's receipt header is the seller's word, and BNB's quest counts only
 * what the chain shows. So every paid call recorded here is checked after the
 * answer has gone: its transaction must have succeeded and moved exactly the
 * price, in the quoted token, from the payer to the payee. When a seller sends
 * no receipt header, the payment is looked for in the blocks since the call by
 * the same three facts, so a seller that took the money and failed is caught
 * too. The chain's answer replaces the header's: `paid` is what it shows.
 */

import { parseAbiItem, type Address, type Hash } from "viem";
import { logClients, marketClient } from "@/lib/chain/market";
import { sql as pg } from "@/lib/db/client";
import type { PaidCallRecord } from "@/lib/market/paid-calls";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** About five minutes of BNB Smart Chain blocks: the window a payment without a receipt is looked for in. */
const LOOKBACK = 700n;

type Payment = Pick<PaidCallRecord, "asset" | "payer" | "payTo" | "amount">;
type Log = { address: string; topics: readonly (string | null)[]; data: string };

const topicOf = (a: string) => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;

/** A log in the transaction that moves exactly this payment. Pure, for tests. */
export function paysFor(logs: readonly Log[], p: Payment): boolean {
  if (!p.asset || !p.payer || !p.payTo || !p.amount) return false;
  const amount = BigInt(p.amount);
  return logs.some(
    (l) =>
      l.address.toLowerCase() === p.asset!.toLowerCase() &&
      l.topics[0] === TRANSFER_TOPIC &&
      l.topics[1]?.toLowerCase() === topicOf(p.payer) &&
      l.topics[2]?.toLowerCase() === topicOf(p.payTo!) &&
      l.data !== "0x" &&
      BigInt(l.data) === amount,
  );
}

/** The record names the token, payee, amount and payer, so its settlement can be checked at all. */
export const checkable = (r: PaidCallRecord): boolean =>
  Boolean(r.asset && /^0x[0-9a-fA-F]{40}$/.test(r.asset) && r.payTo && /^0x[0-9a-fA-F]{40}$/.test(r.payTo) && r.amount && /^\d+$/.test(r.amount) && r.payer && !/^0x0{40}$/i.test(r.payer));

/** Another recorded call already claims this transaction. */
async function claimed(tx: string, id: string): Promise<boolean> {
  if (!pg) return false;
  const rows = (await pg`select 1 from paid_calls where lower(tx) = ${tx.toLowerCase()} and id <> ${id} limit 1`.catch(() => [])) as unknown[];
  return rows.length > 0;
}

async function recentTransfers(p: Payment): Promise<{ tx: string; block: number; value: bigint }[]> {
  for (const client of [marketClient, ...logClients]) {
    try {
      const head = await client.getBlockNumber();
      const logs = await client.getLogs({
        address: p.asset as Address,
        event: TRANSFER,
        args: { from: p.payer as Address, to: p.payTo as Address },
        fromBlock: head - LOOKBACK,
        toBlock: head,
      });
      return logs.map((l) => ({ tx: l.transactionHash, block: Number(l.blockNumber), value: l.args.value ?? 0n }));
    } catch {
      /* the next provider */
    }
  }
  return [];
}

/**
 * The record as the chain has it. Unchanged when the chain cannot answer yet
 * (a transaction not mined, every provider down), so it is read again later
 * rather than marked either way.
 */
export async function confirmSettlement(rec: PaidCallRecord, opts: { waitMs?: number; search?: boolean } = {}): Promise<PaidCallRecord> {
  if (!checkable(rec)) return rec;
  if (rec.tx && /^0x[0-9a-fA-F]{64}$/.test(rec.tx)) {
    const receipt = await marketClient
      .waitForTransactionReceipt({ hash: rec.tx as Hash, timeout: opts.waitMs ?? 20_000, pollingInterval: 1_500 })
      .catch(() => null);
    if (!receipt) return rec;
    const ok = receipt.status === "success" && paysFor(receipt.logs, rec);
    return {
      ...rec,
      paid: ok,
      block: Number(receipt.blockNumber),
      confirmed: ok,
      note: ok ? (rec.note ?? null) : "The seller's receipt names a transaction that does not move this payment.",
    };
  }
  if (opts.search === false) return rec;
  const amount = BigInt(rec.amount!);
  const hits = (await recentTransfers(rec)).filter((t) => t.value === amount).sort((a, b) => b.block - a.block);
  for (const t of hits) {
    if (await claimed(t.tx, rec.id)) continue;
    return {
      ...rec,
      tx: t.tx,
      block: t.block,
      paid: true,
      confirmed: true,
      note: rec.note ?? (rec.delivered ? "The seller sent no receipt; the payment was found on chain." : "The seller took the payment and did not deliver; the payment was found on chain."),
    };
  }
  return rec;
}
