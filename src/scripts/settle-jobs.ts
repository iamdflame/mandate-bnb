/**
 * The settle sweeper: every job we funded for a stranger, taken to its end.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/settle-jobs.ts [run]
 *
 * For each job in src/data/hires.json:
 *   - SUBMITTED: fetch the provider's deliverable, check it against the hash
 *     the provider committed on chain, record it as evidence, and (with `run`)
 *     settle, which pays the provider once the policy's dispute window after
 *     submission has passed. Before then the router refuses, and that refusal
 *     is recorded as "not yet", not as a failure.
 *
 *     A deliverable whose commitment nobody can reproduce is never settled.
 *     This script used to settle every submitted job and would have paid for
 *     one, which is exactly what the site says it refuses to do. Use
 *     `dispute <jobId>` to reject such a job inside its window.
 *   - FUNDED and past expiry: claim the refund, so escrow is never left behind.
 *   - anything else: report it.
 *
 * Deliverables are the providers' words and are stored as data, never acted on.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Address, type Hex } from "viem";
import { verifyDeliverable } from "@/lib/market/deliverable";

const ARGS = process.argv.slice(2);
const MODE = ARGS[0] === "run" ? "run" : ARGS[0] === "dispute" ? "dispute" : "plan";
/** `dispute <jobId>`: reject one job inside its window, and say why in the record. */
const DISPUTE_ID = MODE === "dispute" ? ARGS[1] : null;
const HIRES = join(process.cwd(), "src/data/hires.json");

type Sdk = {
  BNB: unknown;
  signerFromPrivateKey: (k: Hex) => unknown;
  getErc8183Job: (n: unknown, id: bigint) => Promise<Record<string, unknown>>;
  getErc8183DeliverableUrl: (n: unknown, id: bigint) => Promise<string>;
  settleErc8183Job: (w: { address: Address }, s: unknown, p: { jobId: bigint; action?: "approve" | "dispute" }, o: { network: unknown }) => Promise<{ transactionHash?: Hex; status: string }>;
  buildClaimRefundCall: (chainId: number, jobId: bigint) => { to: Address; data: Hex; value?: bigint };
  createClient: (o: { chains: unknown[] }) => { execute: (o: Record<string, unknown>) => Promise<{ transactionHash?: Hex; status: string }> };
};

async function dispute(sdk: Sdk, me: Address, pk: Hex, jobId: bigint): Promise<void> {
  const job = await sdk.getErc8183Job(sdk.BNB, jobId);
  const status = String(job.statusName ?? job.status);
  if (status !== "SUBMITTED") throw new Error(`job ${jobId} is ${status}; only a SUBMITTED job can be disputed`);
  const url = await sdk.getErc8183DeliverableUrl(sdk.BNB, jobId).catch(() => null);
  const check = await verifyDeliverable(url, String(job.deliverable ?? ""));
  console.log(`job ${jobId}: ${status}; deliverable ${check.matchedAs ? `MATCHES ${check.matchedAs}` : "does not reproduce its commitment"}`);
  if (check.matchedAs) throw new Error("its deliverable does reproduce the commitment; there is nothing to dispute");
  const r = await sdk.settleErc8183Job({ address: me }, sdk.signerFromPrivateKey(pk), { jobId, action: "dispute" }, { network: sdk.BNB });
  console.log(`  disputed: ${r.transactionHash ?? "(no hash)"} ${r.status}`);

  const file = JSON.parse(readFileSync(HIRES, "utf8")) as { hires: Record<string, unknown>[] };
  const h = file.hires.find((x) => String(x.jobId) === String(jobId));
  if (h) {
    h.disputed = {
      at: new Date().toISOString(),
      tx: r.transactionHash ?? null,
      because: "the hash the provider committed on chain is not the hash of any reading of the bytes it serves",
      committed: String(job.deliverable ?? ""),
      candidates: check.candidates,
    };
    writeFileSync(HIRES, JSON.stringify(file, null, 2) + "\n");
    console.log("  recorded in src/data/hires.json");
  }
}

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY is required (the client of these jobs)");
  const pk = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  const sdk = (await import("@altananetwork/sdk")) as unknown as Sdk;
  const { privateKeyToAccount } = await import("viem/accounts");
  const me = privateKeyToAccount(pk).address;

  if (MODE === "dispute") {
    if (!DISPUTE_ID) throw new Error("usage: settle-jobs.ts dispute <jobId>");
    await dispute(sdk, me, pk, BigInt(DISPUTE_ID));
    return;
  }

  const file = JSON.parse(readFileSync(HIRES, "utf8")) as { hires: Record<string, unknown>[] };

  for (const h of file.hires) {
    const jobId = BigInt(String(h.jobId));
    const job = await sdk.getErc8183Job(sdk.BNB, jobId);
    const status = String(job.statusName ?? job.status);
    const expired = Date.now() / 1000 > Number(job.expiredAt);
    console.log(`job ${jobId} (${h.who}): ${status}${expired ? ", past expiry" : ""}`);
    h.lastStatus = status;
    h.lastCheckedAt = new Date().toISOString();

    if (status === "SUBMITTED" || status === "COMPLETED") {
      /*
        The SDK finds the URL by scanning logs, which the free archive nodes
        refuse for anything but the last few hours, so a URL we have already
        recorded is used when the scan comes back empty.
      */
      const url =
        (await sdk.getErc8183DeliverableUrl(sdk.BNB, jobId).catch(() => null)) ??
        (h.delivery as { url?: string } | undefined)?.url ??
        (h.deliverable as { url?: string } | undefined)?.url ??
        null;
      const committed = String(job.deliverable ?? "");
      const check = await verifyDeliverable(url, committed);
      h.deliverable = { url, committedHash: committed, hashMatches: check.matchedAs !== null, matchedAs: check.matchedAs, candidates: check.candidates, content: check.body?.slice(0, 4000) ?? null, readAt: check.readAt, error: check.error ?? null };
      console.log(
        `  deliverable ${url ?? "(no url)"}; committed ${committed.slice(0, 18)}…; ` +
          (check.error ? `could not read it: ${check.error}` : check.matchedAs ? `MATCHES ${check.matchedAs}` : `no reading of ${check.bytes} bytes reproduces it`),
      );
      if (status === "SUBMITTED" && !check.matchedAs) {
        console.log(
          check.error
            ? `  not settling: its deliverable could not be read (${check.error}), so there is nothing to check the commitment against.`
            : "  not settling: we do not pay for a deliverable whose commitment we cannot reproduce. Use `dispute` inside the window.",
        );
      }
      if (status === "SUBMITTED" && check.matchedAs && MODE === "run") {
        try {
          const r = await sdk.settleErc8183Job({ address: me }, sdk.signerFromPrivateKey(pk), { jobId, action: "approve" }, { network: sdk.BNB });
          h.settleTx = r.transactionHash ?? null;
          console.log(`  settled: ${r.transactionHash ?? "(no hash)"} ${r.status}`);
        } catch (e) {
          const why = String((e as { details?: string; shortMessage?: string }).details ?? (e as Error).message).slice(0, 240);
          h.settleAttempt = { at: new Date().toISOString(), refused: why };
          console.log(`  not settled yet: ${why}`);
        }
      }
    } else if (status === "FUNDED" && expired && MODE === "run") {
      const call = sdk.buildClaimRefundCall(56, jobId);
      const client = sdk.createClient({ chains: [sdk.BNB] });
      const r = await client.execute({ wallet: { address: me }, signer: sdk.signerFromPrivateKey(pk), calls: [call] });
      h.refundTx = r.transactionHash ?? null;
      console.log(`  refund claimed: ${r.transactionHash ?? "(no hash)"}`);
    }
  }
  writeFileSync(HIRES, JSON.stringify(file, null, 2) + "\n");
  if (MODE !== "run") console.log("plan only. Re-run with `run` to settle submitted jobs and refund expired ones.");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
