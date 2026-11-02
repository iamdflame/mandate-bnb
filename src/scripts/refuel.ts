/**
 * Puts gas and the right tokens where the site's own jobs need them.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/refuel.ts            says what it would do
 *   ... --send                                                                                does it
 *
 * - Gas for the demo account, from the test wallet: Yield-1 and Range-1 act on
 *   it through sessions, and a relayed action is paid from its BNB. At 0.00001
 *   BNB, Yield-1's daily supply stops landing.
 * - $U and USD1 for the trial pool, swapped from the USDT it holds: paid checks
 *   are bought in $U and most per-call sellers take USD1, so USDT alone leaves
 *   agents unable to be checked or to earn their way back on sale.
 *
 * Addresses come from the keys, never typed. The approval is exactly the amount
 * swapped, and each swap carries a minimum out of 97%: all three are dollars.
 */

import { createPublicClient, createWalletClient, encodePacked, formatEther, formatUnits, http, parseAbi, parseEther, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { SWAP_ROUTER, USDT, WBNB } from "@/lib/chain/leash";
import { DEMO_ADDRESS } from "@/lib/demo";

const USD1: Address = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
const U: Address = "0xcE24439F2D9C6a2289F741120FE202248B666666";
const FEE = 500;
const GAS_TO_DEMO = parseEther("0.002");
const SWAPS: { to: Address; sym: string; amount: string }[] = [
  { to: U, sym: "$U", amount: "0.40" },
  { to: USD1, sym: "USD1", amount: "0.30" },
];
const send = process.argv.includes("--send");

const ERC20 = parseAbi(["function approve(address spender, uint256 amount) returns (bool)", "function balanceOf(address owner) view returns (uint256)"]);
const ROUTER = parseAbi([
  "struct ExactInputParams { bytes path; address recipient; uint256 amountIn; uint256 amountOutMinimum; }",
  "function exactInput(ExactInputParams params) payable returns (uint256 amountOut)",
]);

const account = (raw: string | undefined, name: string) => {
  if (!raw) throw new Error(`${name} is not set`);
  return privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
};

async function main() {
  const transport = http("https://bsc-dataseed.bnbchain.org", { timeout: 30_000 });
  const pub = createPublicClient({ chain: bsc, transport });
  const test = account(process.env.TEST_WALLET_KEY, "TEST_WALLET_KEY");
  const pool = account(process.env.AGENT_A_KEY, "AGENT_A_KEY");

  const show = async (label: string, who: Address) => {
    const [bnb, usdt, usd1, u] = await Promise.all([
      pub.getBalance({ address: who }),
      ...[USDT as Address, USD1, U].map((t) => pub.readContract({ address: t, abi: ERC20, functionName: "balanceOf", args: [who] })),
    ]);
    console.log(`${label.padEnd(13)} ${who.slice(0, 10)}…: ${Number(formatEther(bnb)).toFixed(5)} BNB, ${Number(formatUnits(usdt as bigint, 18)).toFixed(4)} USDT, ${Number(formatUnits(usd1 as bigint, 18)).toFixed(4)} USD1, ${Number(formatUnits(u as bigint, 18)).toFixed(4)} $U`);
    return { bnb, usdt: usdt as bigint };
  };
  const t = await show("test wallet", test.address);
  const p = await show("trial pool", pool.address);
  await show("demo account", DEMO_ADDRESS);

  const total = SWAPS.reduce((s, x) => s + parseUnits(x.amount, 18), 0n);
  if (t.bnb < GAS_TO_DEMO + parseEther("0.0005")) throw new Error("the test wallet holds too little BNB to send 0.002 and pay its own gas");
  if (p.usdt < total) throw new Error(`the trial pool holds less than the ${formatUnits(total, 18)} USDT to swap`);

  console.log(`\n${send ? "Doing" : "Would do"}:`);
  console.log(`  0.002 BNB from the test wallet to the demo account`);
  for (const x of SWAPS) console.log(`  ${x.amount} USDT to ${x.sym} in the trial pool`);
  if (!send) return console.log("\nAdd --send to do it.");

  const from = createWalletClient({ account: test, chain: bsc, transport });
  const hash = await from.sendTransaction({ to: DEMO_ADDRESS, value: GAS_TO_DEMO });
  console.log(`  gas: ${(await pub.waitForTransactionReceipt({ hash })).status}, https://bscscan.com/tx/${hash}`);

  const payer = createWalletClient({ account: pool, chain: bsc, transport });
  const ok = await payer.writeContract({ address: USDT as Address, abi: ERC20, functionName: "approve", args: [SWAP_ROUTER as Address, total] });
  console.log(`  approve ${formatUnits(total, 18)} USDT: ${(await pub.waitForTransactionReceipt({ hash: ok })).status}`);
  for (const x of SWAPS) {
    const amountIn = parseUnits(x.amount, 18);
    const path = encodePacked(["address", "uint24", "address", "uint24", "address"], [USDT as Address, FEE, WBNB as Address, FEE, x.to]);
    const h = await payer.writeContract({ address: SWAP_ROUTER as Address, abi: ROUTER, functionName: "exactInput", args: [{ path, recipient: pool.address, amountIn, amountOutMinimum: (amountIn * 97n) / 100n }] });
    console.log(`  ${x.amount} USDT to ${x.sym}: ${(await pub.waitForTransactionReceipt({ hash: h })).status}, https://bscscan.com/tx/${h}`);
  }
  console.log("");
  await show("trial pool", pool.address);
  await show("demo account", DEMO_ADDRESS);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message);
    process.exit(1);
  },
);
