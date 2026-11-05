/**
 * The final record of Set and Earn on MANDATE, frozen from the chain.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/set-and-earn-record.ts
 *
 * Every escrowed job opened through MANDATE from 1 October to the close on
 * 5 November 12:00 UTC, by a wallet we do not operate. Each job's buyer and
 * status come from the kernel's getJob, not from our own table, which only
 * says which jobs were opened here. Writes src/lib/campaign/record.json, which
 * /quest/record renders and anyone can check job by job.
 */

import { writeFileSync } from "node:fs";
import type { Address, PublicClient } from "viem";
import { sql as pg } from "@/lib/db/client";
import { marketClient } from "@/lib/chain/market";
import { testnetPublic } from "@/lib/chain/testnet";
import { DEFAULT_WARM, warm } from "@/lib/data/snapshots";
import { listings } from "@/lib/market/listing";
import { warmRegistry } from "@/lib/registry/tail";
import { referenceRegistrations } from "@/lib/house";
import { COMMERCE_ABI, ESCROW, ESCROW_TESTNET, JOB_STATUS, VIA_HOST } from "@/lib/escrow/contracts";
import { isTeam } from "@/lib/team";

const FROM = Date.UTC(2026, 9, 1) / 1000;
const TO = Date.UTC(2026, 10, 5, 12) / 1000;
const DELIVERED = new Set(["SUBMITTED", "COMPLETED"]);
const LANDED = new Set(["FUNDED", "SUBMITTED", "COMPLETED", "REJECTED", "EXPIRED"]);

/** The first block at or after a time. */
async function blockAt(c: PublicClient, t: number): Promise<bigint> {
  let hi = await c.getBlockNumber();
  let lo = hi - 12_000_000n;
  while (hi - lo > 1n) {
    const mid = (hi + lo) / 2n;
    if (Number((await c.getBlock({ blockNumber: mid })).timestamp) < t) lo = mid;
    else hi = mid;
  }
  return hi;
}

const read = (c: PublicClient, address: Address, id: string) => c.readContract({ address, abi: COMMERCE_ABI, functionName: "getJob", args: [BigInt(id)] });

async function main() {
  if (!pg) throw new Error("no DATABASE_URL");
  await Promise.all([warm(DEFAULT_WARM), warmRegistry().catch(() => undefined)]);
  const listed = new Map(listings().map((l) => [l.tokenId, l]));
  const ours = new Set(Object.values(referenceRegistrations()).map((r) => String(r.tokenId)));
  const [fromBlock, toBlock] = await Promise.all([blockAt(marketClient, FROM), blockAt(marketClient, TO)]);

  const funded = (await pg`select job_id, tx from kernel_jobs where block >= ${fromBlock.toString()} and block < ${toBlock.toString()} order by block asc`) as { job_id: string; tx: string }[];
  const here = new Map(((await pg`select job_id, token_id from escrow_jobs`) as { job_id: string; token_id: string }[]).map((r) => [r.job_id, r.token_id]));
  const list: { id: string; tx: string; tokenId: string; name: string; category: string | null; ours: boolean; buyer: string; status: string }[] = [];
  let team = 0;
  for (const f of funded) {
    const j = await read(marketClient, ESCROW.commerce, f.job_id);
    if (!here.has(f.job_id) && !j.description.includes(VIA_HOST)) continue;
    const status = JOB_STATUS[j.status] ?? "OPEN";
    if (!LANDED.has(status)) continue;
    if (isTeam(j.client)) {
      team++;
      continue;
    }
    const tokenId = here.get(f.job_id) ?? "";
    const agent = tokenId ? listed.get(tokenId) : null;
    list.push({ id: f.job_id, tx: f.tx, tokenId, name: agent?.name ?? (tokenId ? `Agent #${tokenId}` : j.provider), category: agent?.category ?? null, ours: ours.has(tokenId), buyer: j.client.toLowerCase(), status });
  }

  const start = new Date(FROM * 1000).toISOString();
  const end = new Date(TO * 1000).toISOString();
  const t = testnetPublic() as unknown as PublicClient;
  const rows = [
    ...((await pg`select job_id, token_id, client, funded_tx as tx, slug as who, true as house from testnet_escrow_jobs where created_at >= ${start} and created_at < ${end}`) as { job_id: string; token_id: string; client: string; tx: string | null; who: string; house: boolean }[]),
    ...((await pg`select job_id, token_id, client, funded_tx as tx, name as who, false as house from testnet_outside_jobs where created_at >= ${start} and created_at < ${end}`) as { job_id: string; token_id: string; client: string; tx: string | null; who: string; house: boolean }[]),
  ];
  const testnet: { id: string; tx: string | null; name: string; ours: boolean; buyer: string; status: string }[] = [];
  let testnetTeam = 0;
  for (const r of rows) {
    const j = await read(t, ESCROW_TESTNET.commerce, r.job_id);
    const status = JOB_STATUS[j.status] ?? "OPEN";
    if (!LANDED.has(status)) continue;
    if (isTeam(j.client)) {
      testnetTeam++;
      continue;
    }
    testnet.push({ id: r.job_id, tx: r.tx, name: r.house ? `Mandate ${r.who.replace(/^./, (c) => c.toUpperCase())}` : r.who, ours: r.house, buyer: j.client.toLowerCase(), status });
  }

  const record = {
    readAt: new Date().toISOString(),
    closedAt: end,
    mainnet: {
      contract: ESCROW.commerce,
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString(),
      jobs: list.length,
      wallets: new Set(list.map((j) => j.buyer)).size,
      delivered: list.filter((j) => DELIVERED.has(j.status)).length,
      refunded: list.filter((j) => j.status === "REJECTED" || j.status === "EXPIRED").length,
      teamExcluded: team,
      list,
    },
    testnet: {
      contract: ESCROW_TESTNET.commerce,
      jobs: testnet.length,
      wallets: new Set(testnet.map((j) => j.buyer)).size,
      delivered: testnet.filter((j) => DELIVERED.has(j.status)).length,
      refunded: testnet.filter((j) => j.status === "REJECTED" || j.status === "EXPIRED").length,
      teamExcluded: testnetTeam,
      list: testnet,
    },
  };
  writeFileSync("src/lib/campaign/record.json", `${JSON.stringify(record, null, 2)}\n`);
  const { list: _m, ...m } = record.mainnet;
  const { list: _t, ...tt } = record.testnet;
  console.log(JSON.stringify({ m, tt }, null, 1));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message);
    process.exit(1);
  },
);
