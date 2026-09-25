/**
 * The scheduled pass that reads paid calls back from the chain: every call
 * not yet confirmed, newest first, as many as the slice allows.
 */

import { TransactionReceiptNotFoundError, type Hash } from "viem";
import { marketClient } from "@/lib/chain/market";
import { recordPaidCall, unconfirmedCalls } from "@/lib/market/paid-calls";
import { checkable, confirmSettlement } from "@/lib/market/settlement";

export async function confirmPending(opts: { budgetMs: number; limit?: number }): Promise<string> {
  const started = Date.now();
  const queue = await unconfirmedCalls(opts.limit ?? 20);
  let confirmed = 0;
  let contradicted = 0;
  let unanswered = 0;
  for (const rec of queue) {
    if (Date.now() - started > opts.budgetMs) break;
    if (!checkable(rec)) {
      // Without the token, payee and amount there is nothing to hold the chain to: not confirmed, and said so.
      await recordPaidCall({ ...rec, confirmed: false, note: rec.note ?? "The record lacks the token, payee or amount, so its settlement cannot be checked." }).catch(() => undefined);
      unanswered += 1;
      continue;
    }
    // Old calls without a transaction are not searched for: the window for finding one has passed.
    const recent = Date.now() - Date.parse(rec.at) < 10 * 60_000;
    const checked = await confirmSettlement(rec, { waitMs: 4_000, search: recent }).catch(() => rec);
    if (checked === rec) {
      const hourOld = Date.now() - Date.parse(rec.at) > 60 * 60_000;
      if (!rec.tx && !recent) {
        // No transaction, and the window for finding one has passed: the chain shows no payment for it.
        await recordPaidCall({ ...rec, paid: false, confirmed: false }).catch(() => undefined);
        contradicted += rec.paid ? 1 : 0;
      } else if (rec.tx && hourOld && (await notOnChain(rec.tx))) {
        // A transaction the chain still does not have an hour on was never sent.
        await recordPaidCall({ ...rec, paid: false, confirmed: false, note: "The seller's receipt names a transaction the chain does not have." }).catch(() => undefined);
        contradicted += 1;
      } else {
        unanswered += 1;
      }
      continue;
    }
    await recordPaidCall(checked);
    if (checked.confirmed) confirmed += 1;
    else contradicted += 1;
  }
  return `${queue.length} to read: ${confirmed} confirmed, ${contradicted} contradicted by the chain, ${unanswered} not answered yet`;
}

/** The chain answered that it has no such transaction, as against not answering at all. */
const notOnChain = (tx: string): Promise<boolean> =>
  marketClient.getTransactionReceipt({ hash: tx as Hash }).then(
    () => false,
    (e: unknown) => e instanceof TransactionReceiptNotFoundError || (e as Error)?.name === "TransactionReceiptNotFoundError",
  );
