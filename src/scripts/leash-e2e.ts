/**
 * A user's leash, end to end on mainnet: the browser's steps, run from Node.
 *
 *   npm run leash-e2e                              locally recorded and run
 *   npm run leash-e2e -- --api https://www.mandatemarkets.com
 *
 * The user's side uses the Altana SDK's headless passkey (the same curve and
 * signature format as a browser passkey, its key held by this process): create
 * the passkey wallet, fund it from the test wallet, approve Venus for exactly
 * the budget, and grant Yield-1 a session to our server's key, whose private
 * half this side never sees. Then Yield-1 takes its turn and must supply to
 * Venus from the wallet; then the owner revokes and the KeyStore must show the
 * key dead; then everything left is swept back to the test wallet.
 */

import { encodeFunctionData, formatEther, parseAbi, parseEther, parseUnits, type Address, type Hex } from "viem";
import { marketClient, walletFor } from "@/lib/chain/market";
import { USDT } from "@/lib/chain/leash";
import { VUSDT } from "@/lib/chain/house";
import { readKey } from "@/lib/chain/keystore";
import { sessionPublicFor } from "@/lib/leash/keys";
import { permissionsFor } from "@/lib/leash/policy";
import { leashId, recordLeash, recordRevoke, runsOfLeash } from "@/lib/leash/store";
import { runLeashes } from "@/lib/leash/run";

const ERC20 = parseAbi(["function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const VTOKEN = parseAbi(["function balanceOf(address) view returns (uint256)", "function redeem(uint256) returns (uint256)"]);
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};
const log = (...a: unknown[]) => console.log(" ", ...a);

async function main() {
  const raw = process.env.TEST_WALLET_KEY;
  if (!raw) throw new Error("TEST_WALLET_KEY is not set");
  const owner = walletFor((raw.startsWith("0x") ? raw : `0x${raw}`) as Hex);
  const me = owner.account.address;
  const api = arg("api", "");
  const budget = parseUnits(arg("budget", "0.3"), 18);
  const daily = 0.2;

  const sdk = (await import("@altananetwork/sdk")) as unknown as {
    createClient: (o: { chains: unknown[] }) => {
      createWallet(o: { signer: unknown }): Promise<{ address: Address; signer: unknown }>;
      grantSession(o: Record<string, unknown>): Promise<{ publicKey: Hex; transactionHash?: Hex }>;
      execute(o: Record<string, unknown>): Promise<{ transactionHash?: Hex; status: string }>;
      revokeSession(o: Record<string, unknown>): Promise<{ transactionHash?: Hex; status: string }>;
    };
    BNB: unknown;
    createHeadlessPasskey: () => unknown;
  };
  const client = sdk.createClient({ chains: [sdk.BNB] });
  const passkey = sdk.createHeadlessPasskey();
  const wallet = await client.createWallet({ signer: passkey });
  log(`passkey wallet ${wallet.address}, owned from ${me}`);

  // Fund it: BNB for the relay and the KeyStore fee, USDT for the agent to supply.
  for (const [what, hash] of [
    ["BNB", await owner.sendTransaction({ to: wallet.address, value: parseEther("0.002") } as never)],
    ["USDT", await owner.writeContract({ address: USDT, abi: ERC20, functionName: "transfer", args: [wallet.address, budget] } as never)],
  ] as const) {
    const r = await marketClient.waitForTransactionReceipt({ hash: hash as Hex });
    log(`funded ${what}: ${r.status} https://bscscan.com/tx/${hash}`);
  }

  // The owner approves Venus for exactly the budget, once, with the passkey.
  const approved = await client.execute({ wallet, signer: passkey, calls: [{ to: USDT, data: encodeFunctionData({ abi: ERC20, functionName: "approve", args: [VUSDT, budget] }) }] });
  log(`approved Venus for ${formatEther(budget)} USDT: ${approved.status} ${approved.transactionHash ?? ""}`);

  // The grant names our server's key; its private half never reaches this side.
  const pub = sessionPublicFor(wallet.address, "yield-1");
  if (!pub) throw new Error("LEASH_MASTER_KEY is not set");
  const sessionSigner = { type: "privateKey", address: pub.address, publicKey: pub.publicKey, signDigest: async () => { throw new Error("the browser never holds this key"); } };
  const expiry = Math.floor(Date.now() / 1000) + 2 * 86_400;
  const granted = await client.grantSession({ wallet, signer: passkey, permissions: permissionsFor("yield-1", daily), expiry, sessionSigner, register: true });
  log(`granted Yield-1 a session: ${granted.transactionHash ?? "(no hash reported)"}`);

  const id = leashId(wallet.address, "yield-1");
  if (api) {
    const res = await fetch(`${api}/api/leash`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.address, slug: "yield-1", daily, owner: me }) });
    log(`recorded by ${api}: ${res.status}`);
    for (let i = 0; i < 24; i++) {
      const v = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN, functionName: "balanceOf", args: [wallet.address] })) as bigint;
      if (v > 0n) break;
      await new Promise((ok) => setTimeout(ok, 5_000));
    }
  } else {
    const rec = await recordLeash({ wallet: wallet.address, slug: "yield-1", owner: me, dailyUsdt: daily });
    if ("refused" in rec) throw new Error(`recording refused: ${rec.refused}`);
    process.env.HOUSE_AGENTS = "live";
    log(`turn: ${await runLeashes({ budgetMs: 60_000, force: id })}`);
  }
  const [run] = await runsOfLeash(id, 1);
  const vAfter = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN, functionName: "balanceOf", args: [wallet.address] })) as bigint;
  log(`Yield-1: ${run?.outcome ?? "no run"}: ${run?.reason ?? ""} ${run?.txs?.[0]?.tx ? `https://bscscan.com/tx/${run.txs[0].tx}` : ""}`);
  log(`wallet's vUSDT: ${vAfter}`);

  // One tap: the owner revokes, and the chain must agree.
  const revoked = await client.revokeSession({ wallet, signer: passkey, session: granted.publicKey });
  const key = await readKey(wallet.address, pub.keyId);
  log(`revoked: ${revoked.status} ${revoked.transactionHash ?? ""}; KeyStore says valid=${key.valid}`);
  const rr = api
    ? await fetch(`${api}/api/leash/revoke`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.address, slug: "yield-1", tx: revoked.transactionHash }) }).then((r) => r.status)
    : "refused" in (await recordRevoke(wallet.address, "yield-1", revoked.transactionHash ?? null)) ? "refused" : 200;
  log(`revoke recorded: ${rr}`);

  // Sweep: redeem from Venus and send everything back, with the passkey.
  const usdtLeft = async () => (await marketClient.readContract({ address: USDT, abi: ERC20, functionName: "balanceOf", args: [wallet.address] })) as bigint;
  const calls: { to: Address; data?: Hex; value?: bigint }[] = [];
  if (vAfter > 0n) calls.push({ to: VUSDT, data: encodeFunctionData({ abi: VTOKEN, functionName: "redeem", args: [vAfter] }) });
  if (calls.length) log(`redeemed: ${(await client.execute({ wallet, signer: passkey, calls })).status}`);
  const u = await usdtLeft();
  const bnb = await marketClient.getBalance({ address: wallet.address });
  const back = bnb > parseEther("0.0003") ? bnb - parseEther("0.0003") : 0n;
  const sweep = [
    ...(u > 0n ? [{ to: USDT, data: encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [me, u] }) }] : []),
    ...(back > 0n ? [{ to: me, value: back }] : []),
  ];
  if (sweep.length) log(`swept ${formatEther(u)} USDT and ${formatEther(back)} BNB back: ${(await client.execute({ wallet, signer: passkey, calls: sweep })).status}`);

  const pass = run?.outcome === "acted" && vAfter > 0n && !key.valid;
  console.log(pass ? "PASS: granted, acted within the leash, revoked, swept" : "NOT PASSED");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error((e as Error).message.split("\n")[0]);
  process.exit(1);
});
