/**
 * Renews the house sessions the reference agents act through.
 *
 *   npx tsx --env-file=.env src/scripts/renew-house-sessions.ts [days] [--all] [--only grid-1,guard-1]
 *
 * Sessions expire, which is the point of them. Guard-1, Yield-1 and Grid-1
 * lapsed on 12 September and stayed lapsed for six days, because nothing
 * watched their expiry and a lapsed session fails quietly: the agent simply
 * stops being able to act. This grants each leash again, unchanged, and reads
 * the KeyStore back to confirm it agrees.
 *
 * By default it renews only what is expired or within three days of it.
 * `--all` renews every house session regardless.
 */

import type { Hex } from "viem";
import { renewHouseSessions, houseSessionId } from "@/lib/chain/house";
import { comparePolicy } from "@/lib/chain/keystore";
import { listSessions } from "@/lib/chain/session-store";
import { DEMO_ADDRESS } from "@/lib/demo";
import { closeDb } from "@/lib/db/client";

const args = process.argv.slice(2);
const days = Math.max(1, Math.min(60, Number(args.find((a) => /^\d+$/.test(a))) || 21));
const only = args
  .find((a) => a.startsWith("--only"))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const results = await renewHouseSessions({ days, withinDays: args.includes("--all") ? 10_000 : 3, only });
  for (const r of results) {
    if (r.error) {
      console.log(`${r.slug}: ${r.was}, and the renewal failed: ${r.error}`);
      continue;
    }
    const until = r.expiry ? new Date(r.expiry * 1000).toISOString().slice(0, 16) : "?";
    if (!r.renewed) {
      console.log(`${r.slug}: already live until ${until}, left alone`);
      continue;
    }
    console.log(`${r.slug}: was ${r.was}, granted for ${days} days, now expires ${until}, registration ${r.registrationTx ?? "(not found in logs)"}`);
  }

  // The KeyStore is the only opinion that counts: a record here saying a key
  // is registered means nothing if the chain disagrees.
  const sessions = await listSessions();
  for (const r of results.filter((x) => x.renewed)) {
    const s = sessions.find((x) => x.id === houseSessionId(r.slug));
    if (!s) continue;
    const v = await comparePolicy({ wallet: DEMO_ADDRESS as Hex, publicKey: s.publicKey as Hex, expiry: s.expiry, registered: s.registered, revoked: false });
    console.log(`  KeyStore on ${r.slug}: ${v.verdict} at block ${v.block ?? "?"}`);
  }
}

main()
  .catch((e) => {
    console.error((e as Error).message.split("\n")[0]);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
