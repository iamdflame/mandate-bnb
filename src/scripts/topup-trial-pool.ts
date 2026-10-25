/**
 * Tops up the trial pool (AGENT_A_KEY's wallet, which pays the daily test
 * purchases and the judges' sponsored calls) from the end-to-end test wallet,
 * in the tokens x402 sellers are paid in. Plain transfers, nothing approved.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/topup-trial-pool.ts --usdt 1 --usd1 0.15
 *                       says what it would send, and both wallets' balances
 *   ... --send          sends it
 *
 * Both addresses come from the keys, never typed.
 */

import { createPublicClient, createWalletClient, formatEther, formatUnits, http, parseAbi, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";
import { USDT } from "@/lib/chain/leash";

const USD1: Address = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
const U: Address = "0xcE24439F2D9C6a2289F741120FE202248B666666";
const ERC20 = parseAbi(["function transfer(address to, uint256 amount) returns (bool)", "function balanceOf(address owner) view returns (uint256)"]);

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : "0";
};
const send = process.argv.includes("--send");
const tokens: { sym: string; address: Address; amount: string }[] = [
  { sym: "USDT", address: USDT as Address, amount: arg("usdt") },
  { sym: "USD1", address: USD1, amount: arg("usd1") },
  { sym: "$U", address: U, amount: arg("u") },
];

const account = (raw: string | undefined, name: string) => {
  if (!raw) throw new Error(`${name} is not set`);
  return privateKeyToAccount((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
};

async function main() {
  const from = account(process.env.TEST_WALLET_KEY, "TEST_WALLET_KEY");
  const pool = account(process.env.AGENT_A_KEY, "AGENT_A_KEY").address;
  const transport = http("https://bsc-dataseed.bnbchain.org", { timeout: 30_000 });
  const pub = createPublicClient({ chain: bsc, transport });
  const wallet = createWalletClient({ account: from, chain: bsc, transport });

  const show = async (label: string, who: Address) => {
    const [bnb, ...held] = await Promise.all([pub.getBalance({ address: who }), ...tokens.map((t) => pub.readContract({ address: t.address, abi: ERC20, functionName: "balanceOf", args: [who] }))]);
    console.log(`${label} ${who}: ${Number(formatEther(bnb)).toFixed(5)} BNB, ${tokens.map((t, i) => `${Number(formatUnits(held[i]!, 18)).toFixed(4)} ${t.sym}`).join(", ")}`);
    return held;
  };
  const held = await show("test wallet", from.address);
  await show("trial pool ", pool);

  const plan = tokens.filter((t) => Number(t.amount) > 0);
  if (!plan.length) return console.log("\nNothing to send: pass --usdt, --usd1 or --u with an amount.");
  for (const t of plan) {
    if (parseUnits(t.amount, 18) > held[tokens.indexOf(t)]!) throw new Error(`the test wallet holds less than ${t.amount} ${t.sym}`);
  }
  console.log(`\n${send ? "Sending" : "Would send"} to the trial pool: ${plan.map((t) => `${t.amount} ${t.sym}`).join(", ")}`);
  if (!send) return console.log("Add --send to send it.");

  for (const t of plan) {
    const hash = await wallet.writeContract({ address: t.address, abi: ERC20, functionName: "transfer", args: [pool, parseUnits(t.amount, 18)] });
    const r = await pub.waitForTransactionReceipt({ hash });
    console.log(`  ${t.amount} ${t.sym}: ${r.status}, https://bscscan.com/tx/${hash}`);
  }
  console.log("");
  await show("trial pool ", pool);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message);
    process.exit(1);
  },
);
