/**
 * Our agents at work on users' leashed wallets.
 *
 * The same decisions our reference agents make on our own account, made for
 * each wallet a user leashed, within that user's daily cap. Each action goes
 * through the session the user granted, signed with the key only our servers
 * hold, and each is checked by its effect: the wallet's vUSDT rose, or its
 * debt fell. A turn that cannot finish reading the chain does nothing.
 */

import { encodeFunctionData, parseAbi, parseUnits, type Address, type Hex } from "viem";
import { marketClient } from "@/lib/chain/market";
import { USDT } from "@/lib/chain/leash";
import { withLease } from "@/lib/db/lease";
import { decideGuard, decideYield, readGuard, readYield, usdt, VTOKEN_ABI } from "@/lib/house/venus";
import { VUSDT } from "@/lib/chain/house";
import { sessionKeyFor } from "./keys";
import { permissionsFor, type LeashSlug } from "./policy";
import { activeLeashes, movedTodayOn, recordLeashRun, runsOfLeash, type UserLeash } from "./store";

const ERC20 = parseAbi(["function allowance(address owner, address spender) view returns (uint256)"]);
/** How often each agent looks at a leashed wallet, in minutes: loans more often than idle cash. */
const CADENCE_MIN: Record<LeashSlug, number> = { "guard-1": 10, "yield-1": 60 };
/** Near liquidation, for a user's own loan: 1.3 leaves room to act before 1.0. */
const GUARD_TRIGGER = 1.3;

const live = () => process.env.HOUSE_AGENTS === "live";

async function send(leash: UserLeash, functionName: "mint" | "repayBorrow", amount: bigint): Promise<Hex> {
  const key = sessionKeyFor(leash.wallet as Address, leash.slug);
  if (!key) throw new Error("no leash key on this deployment");
  const sdk = (await import("@altananetwork/sdk")) as unknown as {
    createClient: (o: { chains: unknown[] }) => { execute(o: Record<string, unknown>): Promise<{ transactionHash?: Hex; status: string }> };
    BNB: unknown;
    signerFromPrivateKey: (k: Hex) => unknown;
  };
  const client = sdk.createClient({ chains: [sdk.BNB] });
  const session = {
    walletAddress: leash.wallet as Address,
    signer: sdk.signerFromPrivateKey(key),
    publicKey: leash.publicKey as Hex,
    permissions: permissionsFor(leash.slug, Number(leash.dailyUsdt)),
    expiry: leash.expiry,
  };
  const r = await client.execute({ session, calls: [{ to: VUSDT, data: encodeFunctionData({ abi: VTOKEN_ABI, functionName, args: [amount] }) }] });
  if (r.status !== "CONFIRMED" || !r.transactionHash) throw new Error(`the relay answered ${r.status}`);
  return r.transactionHash;
}

async function turn(leash: UserLeash): Promise<string> {
  const wallet = leash.wallet as Address;
  const cap = parseUnits(leash.dailyUsdt, 18);
  const moved = (await movedTodayOn(leash.id)).reduce((s, r) => s + (typeof r.readings.amount === "string" ? parseUnits(r.readings.amount, 18) : 0n), 0n);
  const allowance = (await marketClient.readContract({ address: USDT, abi: ERC20, functionName: "allowance", args: [wallet, VUSDT] })) as bigint;

  if (leash.slug === "yield-1") {
    const r = await readYield(wallet, moved);
    const d = decideYield(r, { dailyCap: cap, reserve: 0n, minimum: parseUnits("0.01", 18) });
    const readings: Record<string, unknown> = { venusApr: r.venusApr, usdt: usdt(r.usdt), movedToday: usdt(moved), cap: leash.dailyUsdt };
    if (!d.act) return record(leash, d.outcome, d.reason, readings);
    const amount = d.amount < allowance ? d.amount : allowance;
    if (amount < parseUnits("0.01", 18)) return record(leash, "nothing", "The wallet has not approved Venus to take its USDT, so there is nothing it may supply. Its owner approves the budget once, from /leash.", readings);
    if (!live()) return record(leash, "would-act", d.reason, { ...readings, amount: usdt(amount) });
    const before = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "balanceOf", args: [wallet] })) as bigint;
    const tx = await send(leash, "mint", amount);
    const after = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "balanceOf", args: [wallet] })) as bigint;
    if (after <= before) return record(leash, "failed", "The supply landed but the wallet's vUSDT did not rise, so Venus returned an error code.", readings, [{ step: "mint", tx }]);
    return record(leash, "acted", `Supplied ${usdt(amount)} USDT to Venus at ${((r.venusApr ?? 0) * 100).toFixed(2)}% a year, credited to this wallet.`, { ...readings, amount: usdt(amount) }, [{ step: "mint", tx }]);
  }

  const r = await readGuard(wallet, moved);
  const d = decideGuard(r, { trigger: GUARD_TRIGGER, repay: cap, dailyCap: cap });
  const readings: Record<string, unknown> = { healthFactor: r.healthFactor ?? null, trigger: GUARD_TRIGGER, debt: usdt(r.debt), usdt: usdt(r.usdt), movedToday: usdt(moved), cap: leash.dailyUsdt };
  if (!d.act) return record(leash, d.outcome, d.reason, readings);
  const amount = d.amount < allowance ? d.amount : allowance;
  if (amount <= 0n) return record(leash, "nothing", "The wallet has not approved Venus to take USDT for repayment. Its owner approves the budget once, from /leash.", readings);
  if (!live()) return record(leash, "would-act", d.reason, { ...readings, amount: usdt(amount) });
  const debtBefore = r.debt;
  const tx = await send(leash, "repayBorrow", amount);
  const debtAfter = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN_ABI, functionName: "borrowBalanceStored", args: [wallet] })) as bigint;
  if (debtAfter >= debtBefore) return record(leash, "failed", "The repay landed but the wallet's Venus debt did not fall, so Venus returned an error code.", readings, [{ step: "repayBorrow", tx }]);
  return record(leash, "acted", `Repaid ${usdt(amount)} USDT of this wallet's Venus debt. ${d.reason}`, { ...readings, amount: usdt(amount), debtAfter: usdt(debtAfter) }, [{ step: "repayBorrow", tx }]);
}

async function record(leash: UserLeash, outcome: string, reason: string, readings: Record<string, unknown>, txs: { step: string; tx: string }[] = []): Promise<string> {
  await recordLeashRun(leash.id, { outcome, reason, readings, txs });
  return `${leash.id}: ${outcome}`;
}

/** One pass over every active leash that is due, as many as the slice allows. */
export async function runLeashes(opts: { budgetMs: number; force?: string }): Promise<string> {
  const started = Date.now();
  const leashes = await activeLeashes();
  if (!leashes.length) return "no active leashes";
  const out: string[] = [];
  for (const leash of leashes) {
    if (Date.now() - started > opts.budgetMs) break;
    if (opts.force && opts.force !== leash.id) continue;
    const [last] = await runsOfLeash(leash.id, 1);
    if (!opts.force && last && Date.now() - Date.parse(last.at) < CADENCE_MIN[leash.slug] * 60_000) continue;
    const r = await withLease(`leash:${leash.id}`, 90, () =>
      turn(leash).catch(async (e) => {
        const why = (e as Error).message.split("\n")[0].slice(0, 200);
        await recordLeashRun(leash.id, { outcome: "failed", reason: `Could not finish: ${why}`, readings: {}, txs: [] }).catch(() => undefined);
        return `${leash.id}: failed`;
      }),
    );
    out.push(r ?? `${leash.id}: busy`);
  }
  return out.join("; ") || "none due";
}
