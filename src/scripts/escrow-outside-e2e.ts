/**
 * An escrowed job for an outside seller, end to end on mainnet, from the test wallet.
 *
 *   npm run escrow-outside-e2e -- --agent 302257 --input address=0x… --api https://www.mandatemarkets.com
 *
 * The seller's price is the one the census holds for that agent, read from
 * its own A2A `negotiate`. The buyer's five transactions exactly as the
 * drawer sends them, with the description such sellers read; then the live
 * site records the job and tells the seller; then the check that matters: the
 * kernel shows the seller's submission, and the site holds its answer.
 */

import { parseEventLogs, type Hex } from "viem";
import { marketClient, walletFor } from "@/lib/chain/market";
import { getProbes } from "@/lib/data/probes";
import { warm } from "@/lib/data/snapshots";
import { findAgent } from "@/lib/data/agents";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW, outsideDescription, POLICY_ABI, ROUTER_ABI, TOKEN_ABI } from "@/lib/escrow/contracts";
import { readJob } from "@/lib/escrow/jobs";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : null;
};

async function main() {
  const raw = process.env.TEST_WALLET_KEY;
  if (!raw) throw new Error("TEST_WALLET_KEY is not set");
  const tokenId = arg("agent");
  const api = arg("api");
  if (!tokenId || !api) throw new Error("--agent <tokenId> and --api <base url> are required");
  const inputs = Object.fromEntries(
    process.argv.flatMap((a, i) => (process.argv[i - 1] === "--input" ? [a.split("=") as [string, string]] : [])),
  );
  const wallet = walletFor((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
  const me = wallet.account.address;

  await warm(["probe"]);
  const q = getProbes().escrowQuotes?.[tokenId];
  if (!q || q.unpayable) throw new Error(`no fundable escrow quote on record for #${tokenId}${q?.unpayable ? `: ${q.unpayable}` : ""}`);
  const budget = BigInt(q.price);
  const name = findAgent(tokenId)?.name ?? `Agent ${tokenId}`;
  const u = await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [me] });
  console.log(`buyer ${me}: ${Number(u) / 1e18} $U; ${name}, provider ${q.provider}, ${Number(budget) / 1e18} $U`);
  if (u < budget) throw new Error("the test wallet holds less $U than the price");

  const send = async (label: string, request: Parameters<typeof wallet.writeContract>[0]) => {
    const hash = await wallet.writeContract(request);
    const r = await marketClient.waitForTransactionReceipt({ hash });
    console.log(`  ${label}: ${r.status} https://bscscan.com/tx/${hash}`);
    if (r.status !== "success") throw new Error(`${label} reverted`);
    return r;
  };
  const disputeWindow = await marketClient.readContract({ address: ESCROW.policy, abi: POLICY_ABI, functionName: "disputeWindow" });
  const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + BigInt(disputeWindow) + BigInt(DELIVERY_SECONDS);
  const description = outsideDescription(q.serviceName ?? name, q.service, inputs);
  const created = await send("open the job", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "createJob", args: [q.provider, ESCROW.router, expiredAt, description, ESCROW.router] } as never);
  const jobId = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: created.logs })[0]!.args.jobId;
  console.log(`  job #${jobId}`);
  await send("bind it to the policy", { address: ESCROW.router, abi: ROUTER_ABI, functionName: "registerJob", args: [jobId, ESCROW.policy] } as never);
  await send("set the budget", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "setBudget", args: [jobId, budget, "0x"] } as never);
  const allowance = await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [me, ESCROW.commerce] });
  if (allowance < budget) await send("approve exactly the budget", { address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "approve", args: [ESCROW.commerce, budget] } as never);
  const funded = await send("fund", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "fund", args: [jobId, budget, "0x"] } as never);

  const res = await fetch(`${api}/api/escrow/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: jobId.toString(), tx: funded.transactionHash, subject: null, tokenId, inputs }),
  });
  console.log(`  recorded by ${api}: ${res.status} ${res.ok ? "" : (await res.text()).slice(0, 200)}`);
  let seen: { status?: string; sellerAnswer?: unknown; deliverableUrl?: string | null; record?: { submitTx?: string | null } } = {};
  for (let i = 0; i < 48; i++) {
    const r = (await fetch(`${api}/api/escrow/jobs/${jobId}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null)) as { data?: typeof seen } | null;
    seen = r?.data ?? seen;
    if (seen.status !== "FUNDED" && seen.sellerAnswer) break;
    await new Promise((ok) => setTimeout(ok, 5_000));
  }
  const job = await readJob(jobId);
  console.log(`  kernel says ${job.status}; deliverable ${job.deliverable}`);
  console.log(`  site holds the seller's answer: ${seen.sellerAnswer ? JSON.stringify(seen.sellerAnswer).slice(0, 160) : "no"}`);
  console.log(`  seller's own copy: ${seen.deliverableUrl ?? "none named"}; submission ${seen.record?.submitTx ?? "not read yet"}`);
  if (job.status !== "SUBMITTED" && job.status !== "COMPLETED") process.exit(1);
  if (!seen.sellerAnswer) process.exit(1);
  console.log(`PASS: job #${jobId} funded by the buyer, announced by ${api}, delivered on chain by ${name}'s seller`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message.split("\n")[0]);
    process.exit(1);
  },
);
