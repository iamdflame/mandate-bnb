/**
 * Reads every recorded paid call back from the chain, once, for the calls made
 * before settlements were checked as they happened. The site's clock keeps new
 * ones confirmed; this catches up the history.
 *
 *   npm run confirm-calls            # every call not yet read back
 *   npm run confirm-calls -- --dry   # say what would change, write nothing
 */

import { listPaidCalls, recordPaidCall } from "@/lib/market/paid-calls";
import { checkable, confirmSettlement } from "@/lib/market/settlement";

const dry = process.argv.includes("--dry");

async function main() {
  const calls = (await listPaidCalls()).filter((c) => c.confirmed === undefined || c.confirmed === null);
  console.log(`${calls.length} calls not yet read back${dry ? " (dry run)" : ""}`);
  const tally = { confirmed: 0, contradicted: 0, unchecked: 0, unanswered: 0 };
  for (const rec of calls) {
    let next = rec;
    if (!checkable(rec)) {
      next = { ...rec, confirmed: false, note: rec.note ?? "The record lacks the token, payee or amount, so its settlement cannot be checked." };
      tally.unchecked += 1;
    } else if (!rec.tx) {
      // Too long ago to look for: the chain shows no payment named for it.
      next = { ...rec, paid: false, confirmed: false };
      tally.contradicted += rec.paid ? 1 : 0;
      tally.unchecked += rec.paid ? 0 : 1;
    } else {
      next = await confirmSettlement(rec, { waitMs: 8_000, search: false }).catch(() => rec);
      if (next === rec) tally.unanswered += 1;
      else if (next.confirmed) tally.confirmed += 1;
      else tally.contradicted += 1;
    }
    const change = next === rec ? "no answer" : next.confirmed ? `confirmed at block ${next.block}` : `not confirmed${rec.paid && !next.paid ? " (was counted as paid)" : ""}`;
    console.log(`  ${rec.at.slice(0, 16)}  #${rec.tokenId.padEnd(7)} ${rec.sponsored ? "sponsored" : "own     "}  ${(rec.tx ?? "no tx").slice(0, 12)}  ${change}`);
    if (!dry && next !== rec) await recordPaidCall(next);
  }
  console.log(tally);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message);
    process.exit(1);
  },
);
