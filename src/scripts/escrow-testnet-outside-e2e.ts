/**
 * Another builder's agent hired end to end on BNB Smart Chain testnet, from
 * the test wallet, the way /quest hires it: a signed quote through our quote
 * route, the job opened with that quote as its description, bound, budgeted,
 * approved and funded on the testnet kernel in test $U, taken on through our
 * record route, then watched until the agent submits its work on chain.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/escrow-testnet-outside-e2e.ts [2238] [--hours 24]
 *
 * The test wallet's tBNB and test $U come from the principal's testnet
 * balance when it has too little. Testnet only.
 */

import { encodeFunctionData, formatUnits, parseAbi, parseEther, parseEventLogs, parseUnits, type Address, type Hex } from "viem";
import { testnetPublic, testnetWallet, TESTNET_TX } from "@/lib/chain/testnet";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW_TESTNET, POLICY_ABI, ROUTER_ABI, TOKEN_ABI } from "@/lib/escrow/contracts";
import { readTestnetJob } from "@/lib/escrow/testnet-jobs";
import { POST as quoteRoute } from "@/app/api/escrow/testnet/quote/route";
import { POST as recordRoute } from "@/app/api/escrow/testnet/jobs/route";
import { sweepTestnetOutside } from "@/lib/testnet/outside-jobs";

const TRANSFER = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
const norm = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as Hex;
const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.1" }, body: JSON.stringify(body) });

async function main() {
  const tokenId = process.argv.slice(2).find((a, i, all) => /^\d+$/.test(a) && all[i - 1] !== "--hours") ?? "2238";
  const c = testnetPublic();
  const buyer = testnetWallet(norm(process.env.TEST_WALLET_KEY!));
  const principal = testnetWallet(norm(process.env.PRIVATE_KEY!));
  const me = buyer.account.address;

  // 1. The quote, through the route the page calls.
  const qr = await quoteRoute(post("/api/escrow/testnet/quote", { tokenId, wallet: me }));
  const qj = (await qr.json()) as { ok?: boolean; error?: string; data?: { name: string; provider: Address; price: string; description: string; etaSeconds: number | null } };
  if (!qj.ok || !qj.data) throw new Error(`no quote: ${qj.error ?? qr.status}`);
  const q = qj.data;
  const price = BigInt(q.price);
  console.log(`quote: ${q.name} (#${tokenId}) for ${formatUnits(price, 18)} test $U, provider ${q.provider}`);

  // 2. Gas and test $U for the buyer, from the principal's testnet balance.
  if ((await c.getBalance({ address: me })) < parseEther("0.005")) {
    const h = await principal.sendTransaction({ to: me, value: parseEther("0.02") });
    await c.waitForTransactionReceipt({ hash: h });
    console.log(`  tBNB for gas: ${TESTNET_TX(h)}`);
  }
  const held = (await c.readContract({ address: ESCROW_TESTNET.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [me] })) as bigint;
  if (held < price) {
    const h = await principal.writeContract({ address: ESCROW_TESTNET.paymentToken, abi: TRANSFER, functionName: "transfer", args: [me, parseUnits("1", 18)] });
    await c.waitForTransactionReceipt({ hash: h });
    console.log(`  test $U: ${TESTNET_TX(h)}`);
  }

  // 3. Open, bind, budget, approve and fund, one transaction at a time, as a wallet that cannot batch does.
  const window = (await c.readContract({ address: ESCROW_TESTNET.policy, abi: POLICY_ABI, functionName: "disputeWindow" })) as bigint;
  // --hours N: the job's life after its dispute window (BNB's SDK suggests 24 h); our default is the 30-minute delivery mainnet uses.
  const hi = process.argv.indexOf("--hours");
  const life = hi > -1 ? BigInt(Math.round(Number(process.argv[hi + 1]) * 3600)) : BigInt(DELIVERY_SECONDS);
  const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + window + life;
  const send = async (label: string, to: Address, data: Hex) => {
    const hash = await buyer.sendTransaction({ to, data });
    const r = await c.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${label} reverted: ${TESTNET_TX(hash)}`);
    console.log(`  ${label}: ${TESTNET_TX(hash)}`);
    return r;
  };
  const opened = await send("open", ESCROW_TESTNET.commerce, encodeFunctionData({ abi: COMMERCE_ABI, functionName: "createJob", args: [q.provider, ESCROW_TESTNET.router, expiredAt, q.description, ESCROW_TESTNET.router] }));
  const jobId = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: opened.logs })[0]!.args.jobId;
  await send("bind", ESCROW_TESTNET.router, encodeFunctionData({ abi: ROUTER_ABI, functionName: "registerJob", args: [jobId, ESCROW_TESTNET.policy] }));
  await send("budget", ESCROW_TESTNET.commerce, encodeFunctionData({ abi: COMMERCE_ABI, functionName: "setBudget", args: [jobId, price, "0x"] }));
  const allowance = (await c.readContract({ address: ESCROW_TESTNET.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [me, ESCROW_TESTNET.commerce] })) as bigint;
  if (allowance < price) await send("approve", ESCROW_TESTNET.paymentToken, encodeFunctionData({ abi: TOKEN_ABI, functionName: "approve", args: [ESCROW_TESTNET.commerce, price] }));
  await send("fund", ESCROW_TESTNET.commerce, encodeFunctionData({ abi: COMMERCE_ABI, functionName: "fund", args: [jobId, price, "0x"] }));
  console.log(`job #${jobId} funded`);

  // 4. Taken on through the route the page calls, retried while our node catches up.
  for (let i = 0; i < 8; i++) {
    const r = await recordRoute(post("/api/escrow/testnet/jobs", { jobId: jobId.toString(), tokenId }));
    const j = (await r.json()) as { ok?: boolean; error?: string; data?: unknown };
    console.log(`  record: ${r.status} ${j.ok ? JSON.stringify(j.data) : j.error}`);
    if (r.ok || r.status === 409) break;
    await new Promise((ok) => setTimeout(ok, 3_000));
  }

  // 5. Delivery: the agent's own seller submits on chain. Our sweep runs each minute, as the schedule does every five.
  for (let i = 0; i < 25; i++) {
    const job = await readTestnetJob(jobId);
    if (job.status !== "FUNDED") {
      console.log(`job #${jobId}: ${job.status.toLowerCase()} after about ${i} min, deliverable ${job.deliverable}`);
      return;
    }
    if (i % 1 === 0) console.log(`  sweep: ${await sweepTestnetOutside({ budgetMs: 40_000 }).catch((e: Error) => e.message)}`);
    await new Promise((ok) => setTimeout(ok, 60_000));
  }
  console.log(`job #${jobId}: not delivered after 25 minutes`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message);
    process.exit(1);
  },
);
