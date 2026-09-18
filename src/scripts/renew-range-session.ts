/**
 * Renews Range-1's session on the demo address.
 *
 *   npx tsx --env-file=.env src/scripts/renew-range-session.ts [days]
 *
 * Sessions expire, which is the point of them; the first Range-1 session ran
 * seven days and lapsed the morning of 18 September, and beat 5 of the judge
 * walk (the desk agrees with the KeyStore about a live key) went red with it.
 * This grants the same leash again, RecipientBound's four selectors and the
 * same spend caps, registered in the KeyStore, for the number of days given
 * (default 21), and reads the KeyStore back to confirm it agrees.
 */

import { parseUnits, type Address, type Hex } from "viem";
import { grantScopedSession } from "@/lib/chain/session";
import { RANGE_CALLS } from "@/lib/chain/leash";
import { comparePolicy } from "@/lib/chain/keystore";
import { DEMO_ADDRESS } from "@/lib/demo";
import { closeDb } from "@/lib/db/client";

const USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
const WBNB: Address = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const RECIPIENT_BOUND = (process.env.RECIPIENT_BOUND ?? "0x5863edaede7394470db19395ca05b1439662952e") as Address;
const days = Math.max(1, Math.min(60, Number(process.argv[2]) || 21));

async function main() {
  const principal = DEMO_ADDRESS as Address;
  const rec = await grantScopedSession({
    id: `house:range-1:${principal.toLowerCase()}`,
    kind: "house",
    label: "Range-1 on the demo address",
    category: "rebalancing",
    calls: RANGE_CALLS,
    tokenSpend: [
      { token: USDT, limit: parseUnits("0.05", 18) },
      { token: WBNB, limit: parseUnits("0.05", 18) },
    ],
    nativeSpendWei: 2_000_000_000_000_000n,
    capWei: 0n,
    ttlSeconds: days * 24 * 3600,
    register: true,
    meta: { recipientBound: RECIPIENT_BOUND, renewed: `granted for ${days} days after the previous session expired` },
  });
  console.log(`granted ${rec.id}: key ${rec.publicKey.slice(0, 18)}…, expires ${new Date(rec.expiry * 1000).toISOString().slice(0, 16)}, registration ${rec.registrationTx ?? "(not found in logs)"}`);
  const v = await comparePolicy({ wallet: principal, publicKey: rec.publicKey as Hex, expiry: rec.expiry, registered: rec.registered, revoked: false });
  console.log(`KeyStore says: ${v.verdict} at block ${v.block ?? "?"}`);
}

main()
  .catch((e) => {
    console.error((e as Error).message.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
