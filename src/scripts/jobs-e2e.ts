/**
 * A job with capital, end to end on mainnet, from the test wallet.
 *
 *   npm run jobs-e2e
 *
 * The buyer's side exactly as the form sends it, with a short term so the
 * whole life fits in half an hour: open with capital, have the chosen agent
 * (Range-1) bid from its own wallet, award against the opening mark the site
 * builds, then leave every epoch to the clock's job, which proposes, finalises
 * and closes. Last, the buyer and the agent withdraw what the contract owes
 * them. The job must end Closed with every epoch settled.
 */

import { formatEther, parseEther, parseEventLogs, type Address, type Hex } from "viem";
import { MANDATE_MARKET_V2_ABI } from "@/lib/chain/abiV2";
import { MARKET_V2 } from "@/lib/chain/deployments";
import { marketClient, walletFor } from "@/lib/chain/market";
import { referenceRegistrations } from "@/lib/house";
import { keeperBid } from "@/lib/keeper/bid";
import { advanceEpochs } from "@/lib/market/epochs";
import { valueWallet } from "@/lib/chain/prices";

const EPOCH_SECONDS = 360;
const EPOCHS = 2;
const CAPITAL = parseEther("0.0002");
const STATE = ["Open", "Active", "Closed", "Abandoned", "Dismissed"];
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const read = (functionName: string, args: unknown[] = []) =>
  marketClient.readContract({ address: MARKET_V2, abi: MANDATE_MARKET_V2_ABI, functionName, args } as never) as Promise<unknown>;

async function main() {
  const raw = process.env.TEST_WALLET_KEY;
  if (!raw) throw new Error("TEST_WALLET_KEY is not set");
  const buyer = walletFor((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
  const send = async (label: string, functionName: string, args: unknown[], value?: bigint) => {
    const hash = await buyer.writeContract({ address: MARKET_V2, abi: MANDATE_MARKET_V2_ABI, functionName, args, value } as never);
    const r = await marketClient.waitForTransactionReceipt({ hash });
    log(`${label}: ${r.status} https://bscscan.com/tx/${hash}`);
    if (r.status !== "success") throw new Error(`${label} reverted`);
    return r;
  };

  // Open, exactly as the form does, with a short term.
  const opened = await send(
    "open the job",
    "openMandate",
    [0, "0x0000000000000000000000000000000000000000", 0n, 0, 500, 2_000, 2_500, EPOCH_SECONDS, EPOCHS, 3, -1_000, 2_000],
    CAPITAL,
  );
  const id = Number((parseEventLogs({ abi: MANDATE_MARKET_V2_ABI, eventName: "MandateOpened", logs: opened.logs })[0]!.args as { mandateId: bigint }).mandateId);
  log(`job #${id}, ${formatEther(CAPITAL)} BNB, ${EPOCHS} epochs of ${EPOCH_SECONDS}s`);

  // The chosen agent bids from its own wallet.
  const range = referenceRegistrations()["range-1"]!;
  const b = await keeperBid(id, "range-1");
  log(`Range-1 bid: ${b.ok ? `https://bscscan.com/tx/${b.hash}` : b.why}`);
  if (!b.ok) throw new Error("no bid");
  const bids = (await read("getBids", [BigInt(id)])) as readonly { agent: Address }[];
  const index = bids.findIndex((x) => x.agent.toLowerCase() === range.owner.toLowerCase());

  // Award against the opening mark, built the way /api/market/opening builds it.
  const v = await valueWallet(range.owner);
  await send("award", "award", [
    BigInt(id),
    BigInt(index),
    { wallet: range.owner, valuationWei: v.weiTotal, gasSpentWei: 0n, priceX96: v.sqrtPriceX96, blockNumber: v.blockNumber, breakdownRef: `0x${"0".repeat(64)}`, benchmarkWei: v.weiTotal },
  ]);

  // Every epoch, left to the clock's job.
  for (let i = 0; i < 60; i++) {
    const m = (await read("getMandate", [BigInt(id)])) as unknown as { state: number; epochsSettled: number };
    if (STATE[m.state] === "Closed") break;
    const r = await advanceEpochs({ budgetMs: 60_000 });
    log(`clock: ${r} (settled ${m.epochsSettled}/${EPOCHS})`);
    await new Promise((ok) => setTimeout(ok, 45_000));
  }
  const m = (await read("getMandate", [BigInt(id)])) as unknown as { state: number; epochsSettled: number; cumulativeAlphaBps: bigint };
  log(`job #${id}: ${STATE[m.state]}, ${m.epochsSettled}/${EPOCHS} epochs, cumulative alpha ${Number(m.cumulativeAlphaBps) / 100}%`);

  // Both sides take back what the contract owes them.
  const owed = (await read("withdrawable", ["0x0000000000000000000000000000000000000000", buyer.account.address])) as bigint;
  if (owed > 0n) await send(`withdraw ${formatEther(owed)} BNB`, "withdraw", ["0x0000000000000000000000000000000000000000"]);
  const agentKey = process.env.HOUSE_RANGE_KEY;
  if (agentKey) {
    const agent = walletFor((agentKey.startsWith("0x") ? agentKey : `0x${agentKey}`) as Hex);
    const bond = (await read("withdrawable", ["0x0000000000000000000000000000000000000000", agent.account.address])) as bigint;
    if (bond > 0n) {
      const h = await agent.writeContract({ address: MARKET_V2, abi: MANDATE_MARKET_V2_ABI, functionName: "withdraw", args: ["0x0000000000000000000000000000000000000000"] } as never);
      log(`Range-1 withdrew its ${formatEther(bond)} BNB bond: https://bscscan.com/tx/${h}`);
    }
  }
  const pass = STATE[m.state] === "Closed" && m.epochsSettled === EPOCHS;
  console.log(pass ? `PASS: job #${id} opened, bid by Range-1, awarded, settled by the clock, closed, withdrawn` : "NOT PASSED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error((e as Error).message.split("\n")[0]);
  process.exit(1);
});
