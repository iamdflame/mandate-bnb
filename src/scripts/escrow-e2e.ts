/**
 * One escrowed job, end to end on mainnet, from the test wallet.
 *
 *   npm run escrow-e2e                    Range-1, about the test wallet itself
 *   npm run escrow-e2e -- --agent guard-1
 *   npm run escrow-e2e -- --api https://www.mandatemarkets.com
 *                                         record and deliver through the live site
 *
 * The buyer's five transactions exactly as the drawer sends them (open, bind
 * to the policy, budget, approve exactly the budget, fund), then the record
 * this site keeps, then our agent's delivery from its own wallet, then the
 * check that matters: the kernel's deliverable hash equals the keccak256 of
 * the bytes this site serves for it. Escrow opens to buyers only after this
 * passes.
 */

import { keccak256, parseEventLogs, stringToHex, type Hex } from "viem";
import { marketClient, walletFor } from "@/lib/chain/market";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW, HOUSE_BUDGET, POLICY_ABI, ROUTER_ABI, TOKEN_ABI, VIA } from "@/lib/escrow/contracts";
import { deliver, deliverableUrl, jobRow, providerFor, readJob, recordFunded } from "@/lib/escrow/jobs";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};

async function main() {
  const raw = process.env.TEST_WALLET_KEY;
  if (!raw) throw new Error("TEST_WALLET_KEY is not set");
  const wallet = walletFor((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
  const me = wallet.account.address;
  const p = providerFor(arg("agent", "range-1"));
  if (!p) throw new Error("no such agent of ours");
  const budget = HOUSE_BUDGET;

  const [u, bnb, disputeWindow] = await Promise.all([
    marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [me] }),
    marketClient.getBalance({ address: me }),
    marketClient.readContract({ address: ESCROW.policy, abi: POLICY_ABI, functionName: "disputeWindow" }),
  ]);
  console.log(`buyer ${me}: ${Number(u) / 1e18} $U, ${Number(bnb) / 1e18} BNB; provider ${p.ref.name} ${p.owner}`);
  if (u < budget) throw new Error("the test wallet needs at least 0.05 $U: run npm run fund-test-wallet first");

  const send = async (label: string, request: Parameters<typeof wallet.writeContract>[0]) => {
    const hash = await wallet.writeContract(request);
    const r = await marketClient.waitForTransactionReceipt({ hash });
    console.log(`  ${label}: ${r.status} https://bscscan.com/tx/${hash}`);
    if (r.status !== "success") throw new Error(`${label} reverted`);
    return r;
  };

  const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + BigInt(disputeWindow) + BigInt(DELIVERY_SECONDS);
  const description = `${VIA}: ${p.ref.name} (ERC-8004 #${p.tokenId}) for ${me}`;
  const created = await send("open the job", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "createJob", args: [p.owner, ESCROW.router, expiredAt, description, ESCROW.router] } as never);
  const jobId = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: created.logs })[0]!.args.jobId;
  console.log(`  job #${jobId}`);
  await send("bind it to the policy", { address: ESCROW.router, abi: ROUTER_ABI, functionName: "registerJob", args: [jobId, ESCROW.policy] } as never);
  await send("set the budget", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "setBudget", args: [jobId, budget, "0x"] } as never);
  const allowance = await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [me, ESCROW.commerce] });
  if (allowance < budget) await send("approve exactly the budget", { address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "approve", args: [ESCROW.commerce, budget] } as never);
  const funded = await send("fund", { address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "fund", args: [jobId, budget, "0x"] } as never);

  const api = arg("api", "");
  let text: string | null = null;
  if (api) {
    // The live site records it and its agent delivers it, exactly as for a buyer in the browser.
    const res = await fetch(`${api}/api/escrow/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: jobId.toString(), tx: funded.transactionHash }) });
    console.log(`  recorded by ${api}: ${res.status}`);
    for (let i = 0; i < 36; i++) {
      if ((await readJob(jobId)).status !== "FUNDED") break;
      await new Promise((ok) => setTimeout(ok, 5_000));
    }
    const got = await fetch(`${api}/api/escrow/jobs/${jobId}/deliverable`);
    text = got.ok ? await got.text() : null;
    console.log(`  delivery served: ${got.status}`);
  } else {
    const rec = await recordFunded(jobId, funded.transactionHash, null);
    if ("refused" in rec) throw new Error(`recording refused: ${rec.refused}`);
    console.log(`  recorded: ${rec.job.status}`);
    console.log(`  delivery: ${await deliver(jobId.toString())}`);
    text = (await jobRow(jobId.toString()))?.deliverable ?? null;
  }

  const job = await readJob(jobId);
  const served = text ? keccak256(stringToHex(text)) : null;
  const matches = served !== null && served.toLowerCase() === job.deliverable.toLowerCase();
  console.log(`  kernel says ${job.status}; deliverable ${job.deliverable}`);
  console.log(`  served bytes hash to ${served} (${matches ? "match" : "MISMATCH"})`);
  console.log(`  read it: ${deliverableUrl(jobId.toString())}`);
  if (job.status !== "SUBMITTED" || !matches) process.exit(1);
  console.log(`PASS: job #${jobId} funded by the buyer and delivered by ${p.ref.name}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message.split("\n")[0]);
    process.exit(1);
  },
);
