/**
 * Testnet jobs a buyer opened here with another builder's agent: recorded
 * from the chain, watched until the agent delivers, and settled.
 *
 * Nothing the buyer's page says is trusted. A job is taken on only when the
 * testnet kernel holds it funded, bound to the testnet dispute policy, with a
 * description that is the agent's own signed quote for chain 97 in test $U,
 * signed by a wallet its testnet registration names, and a budget at least
 * that price. We cannot deliver for another builder's agent: its seller sees
 * the funded job (BNB's SDK watches the chain) and submits its own work.
 * After the 15-minute dispute window anyone may settle, and our testnet
 * keeper does, so the hire completes without anyone watching.
 *
 * An agent that lets a job opened here pass its deadline undelivered is taken
 * off the testnet list until it delivers one: the same rule as mainnet.
 */

import type { Address, Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { testnetPublic, testnetWallet } from "@/lib/chain/testnet";
import { ESCROW_TESTNET, POLICY_ABI, ROUTER_ABI, VIA_HOST, type JobStatus } from "@/lib/escrow/contracts";
import { readSignedDescription } from "@/lib/escrow/sdk";
import { readTestnetJob } from "@/lib/escrow/testnet-jobs";
import { quoteSigners } from "@/lib/escrow/signers";
import { notifyFunded } from "@/lib/escrow/a2a";
import { readRegistryEntry, RegistryUnreadable } from "@/lib/sources/registry";
import { loadedLive, store, warm } from "@/lib/data/snapshots";
import { testnetSellers, type TestnetSellers } from "./sellers";

export interface TestnetOutsideJob {
  jobId: string;
  client: string;
  provider: string;
  tokenId: string;
  name: string;
  category: string | null;
  budget: string;
  here: boolean;
  status: JobStatus;
  fundedTx: string | null;
  submitTx: string | null;
  settleTx: string | null;
  submitBy: number | null;
  note: string | null;
  createdAt: string;
}

type Row = {
  job_id: string;
  client: string;
  provider: string;
  token_id: string;
  name: string;
  category: string | null;
  budget: string;
  here: boolean;
  status: JobStatus;
  funded_tx: string | null;
  submit_tx: string | null;
  settle_tx: string | null;
  submit_by: string | number | null;
  submitted_at: string | number | null;
  note: string | null;
  created_at: Date | string;
};

const toJob = (r: Row): TestnetOutsideJob => ({
  jobId: r.job_id,
  client: r.client,
  provider: r.provider,
  tokenId: r.token_id,
  name: r.name,
  category: r.category,
  budget: r.budget,
  here: r.here,
  status: r.status,
  fundedTx: r.funded_tx,
  submitTx: r.submit_tx,
  settleTx: r.settle_tx,
  submitBy: r.submit_by === null ? null : Number(r.submit_by),
  note: r.note,
  createdAt: new Date(r.created_at).toISOString(),
});

export async function testnetOutsideRow(jobId: string): Promise<TestnetOutsideJob | null> {
  if (!pg) return null;
  await ensureTables();
  const [r] = (await pg`select * from testnet_outside_jobs where job_id = ${jobId}`) as Row[];
  return r ? toJob(r) : null;
}

export async function testnetOutsideOfClient(client: string): Promise<TestnetOutsideJob[]> {
  if (!pg) return [];
  await ensureTables();
  return ((await pg`select * from testnet_outside_jobs where client = ${client.toLowerCase()} order by created_at asc`) as Row[]).map(toJob);
}

let windowRead: Promise<bigint> | null = null;
const disputeWindow = () =>
  (windowRead ??= (testnetPublic().readContract({ address: ESCROW_TESTNET.policy, abi: POLICY_ABI, functionName: "disputeWindow" }) as Promise<bigint>).catch((e) => {
    windowRead = null;
    throw e;
  }));

/**
 * The checks a testnet job with an outside agent must pass to be taken on.
 * Pure over what was read, for tests: the job as the kernel holds it, its
 * signed description as read, and the wallets the agent's registration names.
 */
export function outsideJobProblem(
  job: { status: JobStatus; evaluator: string; hook: string; budget: bigint; description: string },
  signed: { signer: string; price: bigint; currency: string } | { refused: string } | null,
  signers: string[],
): string | null {
  if (job.status !== "FUNDED" && job.status !== "SUBMITTED" && job.status !== "COMPLETED") return `it is ${job.status.toLowerCase()}`;
  if (job.evaluator.toLowerCase() !== ESCROW_TESTNET.router.toLowerCase() || job.hook.toLowerCase() !== ESCROW_TESTNET.router.toLowerCase()) {
    return "it is not bound to the testnet dispute policy, so it could not be settled";
  }
  if (!signed) return "its description carries no signed quote from the agent";
  if ("refused" in signed) return `its quote fails its own check: ${signed.refused}`;
  if (!signers.some((w) => w.toLowerCase() === signed.signer.toLowerCase())) return "its quote is signed by a wallet the agent's testnet registration does not name";
  let d: { chain_id?: unknown };
  try {
    d = JSON.parse(job.description) as { chain_id?: unknown };
  } catch {
    return "its description is not the agent's quote";
  }
  if (d.chain_id !== undefined && Number(d.chain_id) !== 97) return `its quote is for chain ${String(d.chain_id)}, not testnet`;
  if (signed.currency.toLowerCase() !== ESCROW_TESTNET.paymentToken.toLowerCase()) return "its quote is not in test $U";
  if (job.budget < signed.price) return "it holds less than the agent's signed price";
  return null;
}

/** Takes on a testnet job funded to an agent on our testnet list, after reading every fact from the chain. */
export async function recordTestnetOutside(jobId: bigint, tokenId: string, fundTx: Hash | null = null): Promise<string> {
  if (!pg) return "no database";
  await ensureTables();
  if (await testnetOutsideRow(jobId.toString())) return "already recorded";
  await warm(["testnet-sellers"]);
  const seller = testnetSellers().agents[tokenId];
  if (!seller || seller.ours) return "not another builder's agent on our testnet list";
  const job = await readTestnetJob(jobId);
  const [signed, entry] = await Promise.all([readSignedDescription(job.description), readRegistryEntry(tokenId, 97).catch((e: unknown) => (e instanceof RegistryUnreadable ? e : null))]);
  const signers = entry instanceof RegistryUnreadable ? null : await quoteSigners(tokenId, entry, 97).catch(() => null);
  // The registry could not be asked: "failed" makes the page try again, rather than a refusal it would show the buyer.
  if (!signers) return "failed: the testnet registry did not answer just now";
  const problem = outsideJobProblem(job, signed, signers);
  if (problem) return problem;
  const window = await disputeWindow().catch(() => 900n);
  const here = job.description.includes(VIA_HOST);
  if (!fundTx) {
    const [t] = (await pg`select tx from testnet_jobs where job_id = ${jobId.toString()}`.catch(() => [])) as { tx: string }[];
    fundTx = (t?.tx as Hash | undefined) ?? null;
  }
  await pg`
    insert into testnet_outside_jobs (job_id, client, provider, token_id, name, category, budget, here, status, funded_tx, expired_at, submit_by, submitted_at)
    values (${jobId.toString()}, ${job.client.toLowerCase()}, ${job.provider.toLowerCase()}, ${tokenId}, ${seller.name}, ${seller.category}, ${job.budget.toString()},
            ${here}, ${job.status}, ${fundTx?.toLowerCase() ?? null}, ${Number(job.expiredAt)}, ${Number(job.expiredAt - window)}, ${Number(job.submittedAt) || null})
    on conflict (job_id) do nothing
  `;
  // A seller that asked to be told gets the job number; one on BNB's SDK sees it on chain anyway.
  if (seller.notify) await notifyFunded(seller.a2a, jobId.toString(), {}).catch(() => undefined);
  return "recorded";
}

/** Marks an agent off the testnet list for a missed job here, or back on it for a delivered one, on top of the live list only. */
async function markSeller(tokenId: string, missedAt: string | null): Promise<void> {
  await warm(["testnet-sellers"]);
  if (!(await loadedLive("testnet-sellers"))) return;
  const state: TestnetSellers = structuredClone(testnetSellers());
  const s = state.agents[tokenId];
  if (!s || (s.missedAt ?? null) === missedAt) return;
  state.agents[tokenId] = { ...s, missedAt };
  await store("testnet-sellers", state, new Date().toISOString());
}

/**
 * One pass: read every open job's state from the kernel, mark a seller that
 * missed its deadline, and settle every delivered job past its window.
 */
export async function sweepTestnetOutside(opts: { budgetMs: number }): Promise<string> {
  if (!pg) return "no database";
  await ensureTables();
  const started = Date.now();
  const left = () => opts.budgetMs - (Date.now() - started);
  const open = (await pg`select * from testnet_outside_jobs where status in ('FUNDED', 'SUBMITTED') order by created_at asc limit 30`) as Row[];
  if (!open.length) return "no outside testnet jobs open";
  await warm(["testnet-sellers"]);
  const window = await disputeWindow().catch(() => 900n);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const done: string[] = [];
  for (const r of open) {
    if (left() < 12_000) break;
    const job = await readTestnetJob(BigInt(r.job_id)).catch(() => null);
    if (!job) continue;
    if (job.status !== r.status) {
      await pg`update testnet_outside_jobs set status = ${job.status}, submitted_at = ${Number(job.submittedAt) || null}, note = null, updated_at = now() where job_id = ${r.job_id}`;
      if (job.status === "SUBMITTED" || job.status === "COMPLETED") await markSeller(r.token_id, null);
      done.push(`${r.job_id} ${job.status.toLowerCase()}`);
    }
    if (job.status === "FUNDED" && r.submit_by !== null && now > BigInt(r.submit_by)) {
      if (!r.note) {
        await pg`update testnet_outside_jobs set note = ${"Passed its deadline undelivered; the buyer's test $U comes back after expiry."}, updated_at = now() where job_id = ${r.job_id}`;
        await markSeller(r.token_id, new Date().toISOString());
        done.push(`${r.job_id} missed`);
      }
      continue;
    }
    /*
      Told again on every pass until it delivers: the first notice goes out the
      moment the buyer's page reports the job, and a seller whose node is a
      block behind reads it as unfunded and drops it (Venus Yield Keeper, job
      1654 on 25 Oct, delivered once told again).
    */
    if (job.status === "FUNDED") {
      const seller = testnetSellers().agents[r.token_id];
      if (seller?.notify) await notifyFunded(seller.a2a, r.job_id, {}).catch(() => undefined);
    }
    if (job.status === "SUBMITTED" && now >= job.submittedAt + window) {
      const raw = process.env.PRIVATE_KEY;
      if (!raw) {
        done.push(`${r.job_id}: no testnet keeper key`);
        continue;
      }
      const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
      const wallet = testnetWallet(key);
      const c = testnetPublic();
      try {
        const { request } = await c.simulateContract({ account: privateKeyToAccount(key), address: ESCROW_TESTNET.router as Address, abi: ROUTER_ABI, functionName: "settle", args: [BigInt(r.job_id), "0x"] });
        const hash = await wallet.writeContract(request);
        const receipt = await c.waitForTransactionReceipt({ hash, timeout: 60_000 });
        const after = await readTestnetJob(BigInt(r.job_id));
        await pg`update testnet_outside_jobs set status = ${after.status}, settle_tx = ${receipt.status === "success" ? hash.toLowerCase() : null}, updated_at = now() where job_id = ${r.job_id}`;
        done.push(`${r.job_id} settle ${receipt.status}`);
      } catch (e) {
        done.push(`${r.job_id} settle failed: ${(e as Error).message.split("\n")[0]!.slice(0, 100)}`);
      }
    }
  }
  return done.join("; ") || `${open.length} open, nothing changed`;
}
