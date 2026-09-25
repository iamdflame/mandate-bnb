/**
 * The quest, end to end on mainnet, from the test wallet, through the live site.
 *
 *   npm run quest-e2e                          one hire per job, one rating, then the tracking API
 *   npm run quest-e2e -- --only grid-trading   one job
 *   npm run quest-e2e -- --base http://localhost:3312
 *
 * Exactly what a buyer's browser does: ask the site's relay for the agent's
 * price, sign one payment for exactly that amount with the test wallet (an
 * EIP-3009 authorisation, or a Permit2 signature over an exact approval), send
 * it through the relay, then rate the hire on the ERC-8004 reputation registry
 * and file the rating. Last, the tracking API must list every hire with its
 * settlement transaction, confirmed on chain, and count all four jobs.
 *
 * The test wallet is declared as a team wallet, so none of this counts toward
 * anyone's quest; the answer says `team: true`.
 */

import { type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { marketClient, walletFor } from "@/lib/chain/market";
import { live } from "@/lib/data/live";
import { questPicks } from "@/lib/market/quest-picks";
import { inputsFor } from "@/lib/market/inputs";
import { previewFor } from "@/lib/market/quotes";
import { ensurePermit2Allowance, fromBase64, readRequirements, signPayment, whyUnpayable } from "@/lib/x402/pay";
import { RATING_TAG, REPUTATION_ABI, REPUTATION_REGISTRY } from "@/lib/chain/reputation-abi";
import { SITE } from "@/lib/site";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1]! : fallback;
};
const base = arg("base", SITE).replace(/\/$/, "");
const only = arg("only", "");

async function relay(body: Record<string, unknown>) {
  const res = await fetch(`${base}/api/x402/relay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const r = (await res.json()) as { error?: string; status?: number; headers?: Record<string, string>; body?: string };
  if (!res.ok || typeof r.status !== "number") throw new Error(r.error ?? `the relay answered ${res.status}`);
  return r as { status: number; headers: Record<string, string>; body: string };
}

async function main() {
  const raw = process.env.TEST_WALLET_KEY;
  if (!raw) throw new Error("TEST_WALLET_KEY is not set");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  const account = privateKeyToAccount(key);
  const me = account.address;
  await live();
  const picks = (await questPicks()).filter((p) => p.pick && (!only || p.category === only));
  console.log(`buyer ${me}, through ${base}`);

  const hires: { category: string; tokenId: string; tx: string | null }[] = [];
  for (const { category, pick } of picks) {
    const l = pick!;
    const inputs = Object.fromEntries(inputsFor(l.tokenId, previewFor(l.tokenId)).filter((i) => i.kind === "wallet").map((i) => [i.name, me]));
    try {
      const ask = await relay({ tokenId: l.tokenId, inputs, subject: me });
      if (ask.status !== 402) throw new Error(`asked for a price, it answered ${ask.status}`);
      const reqs = readRequirements(JSON.parse(ask.body || "null"), ask.headers["payment-required"]);
      const r = reqs.find((x) => !whyUnpayable(x));
      if (!r) throw new Error(`no requirement this wallet can pay: ${reqs.map((x) => whyUnpayable(x)).join("; ")}`);
      if (r.method === "permit2") {
        const approved = await ensurePermit2Allowance(key, r.asset, r.amount);
        if (approved) console.log(`  ${category}: approved exactly ${r.amount} to Permit2 https://bscscan.com/tx/${approved}`);
      }
      const signed = await signPayment(account, r);
      const paid = await relay({ tokenId: l.tokenId, inputs, subject: me, paid: { header: signed.header, value: signed.value } });
      const receipt = paid.headers["payment-response"] ?? paid.headers["x-payment-response"];
      let tx: string | null = null;
      try {
        const d = receipt ? (JSON.parse(fromBase64(receipt)) as { transaction?: string; txHash?: string }) : null;
        tx = d?.transaction ?? d?.txHash ?? null;
      } catch {
        tx = null;
      }
      console.log(`  ${category}: ${l.name} (#${l.tokenId}) answered ${paid.status}, ${r.amount} of ${r.asset}${tx ? ` https://bscscan.com/tx/${tx}` : ", no receipt header"}`);
      hires.push({ category, tokenId: l.tokenId, tx });
    } catch (e) {
      console.log(`  ${category}: ${l.name} (#${l.tokenId}) FAILED: ${(e as Error).message.split("\n")[0].slice(0, 200)}`);
    }
  }

  // One rating, tied to the first hire with a settlement, filed with the tracking API.
  const rated = hires.find((h) => h.tx);
  if (rated) {
    const wallet = walletFor(key);
    const hash = await wallet.writeContract({
      address: REPUTATION_REGISTRY,
      abi: REPUTATION_ABI,
      functionName: "giveFeedback",
      args: [BigInt(rated.tokenId), 100n, 0, rated.category, RATING_TAG, "", `${base}/agents/${rated.tokenId}`, rated.tx as Hex],
    } as never);
    const rc = await marketClient.waitForTransactionReceipt({ hash });
    const filed = await fetch(`${base}/api/v1/ratings`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: hash }) });
    const fr = (await filed.json()) as { data?: { hireTx?: string | null } };
    console.log(`  rated #${rated.tokenId} 5 of 5: ${rc.status} https://bscscan.com/tx/${hash}; filed ${filed.status}, linked to hire ${fr.data?.hireTx ?? "none"}`);
  }

  // The settlements are read back from the chain after each answer; give them a moment.
  await new Promise((ok) => setTimeout(ok, 25_000));
  const h = (await (await fetch(`${base}/api/v1/wallets/${me}/hires`)).json()) as {
    data: { team: boolean; byCategory: Record<string, number>; hires: { category: string; agentId: string; tx: string | null; onChain: boolean; completed: boolean; kind: string }[]; ratings: unknown[] };
    observed: { blockNumber: string };
  };
  console.log(`tracking at block ${h.observed.blockNumber}: team ${h.data.team}, ratings ${h.data.ratings.length}`);
  for (const r of h.data.hires.slice(0, 12)) console.log(`  ${r.kind} ${r.category} #${r.agentId} on chain ${r.onChain} completed ${r.completed} ${r.tx ?? ""}`);
  console.log(`  counted per job: ${JSON.stringify(h.data.byCategory)}`);
  const missing = picks.map((p) => p.category).filter((c) => !h.data.byCategory[c]);
  if (missing.length) {
    console.log(`NOT YET: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS: every job hired from the test wallet, confirmed on chain, and counted by the tracking API");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error((e as Error).message.split("\n")[0]);
    process.exit(1);
  },
);
