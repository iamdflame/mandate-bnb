/**
 * Leashes on users' own wallets.
 *
 *   POST /api/leash   {"wallet": "0x…passkey wallet", "slug": "yield-1", "daily": 1, "owner": "0x…"}
 *   GET  /api/leash?address=0x…   the leashes on a wallet, or granted from an owner's main wallet
 *
 * A leash is kept only once the KeyStore shows our agent's key valid on the
 * wallet. The agent takes its first look straight away, then on its schedule.
 */

import { after } from "next/server";
import { isAddress, type Address } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { isLeashSlug, LEASH_POLICIES, LIMITS } from "@/lib/leash/policy";
import { leashesOf, recordLeash, runsOfLeash } from "@/lib/leash/store";
import { runLeashes } from "@/lib/leash/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = { capacity: 30, windowMs: 60_000 };

export async function POST(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  let b: { wallet?: unknown; slug?: unknown; daily?: unknown; owner?: unknown };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return fail(400, "Send JSON naming the wallet and the agent.", CHAIN_ID, g.headers);
  }
  const wallet = String(b.wallet ?? "");
  const slug = String(b.slug ?? "");
  const daily = Number(b.daily ?? NaN);
  const owner = typeof b.owner === "string" && isAddress(b.owner) ? (b.owner as Address) : null;
  if (!isAddress(wallet)) return fail(400, "wallet must be a 0x address.", CHAIN_ID, g.headers);
  if (!isLeashSlug(slug)) return fail(400, "slug is yield-1 or guard-1.", CHAIN_ID, g.headers);
  if (!(daily >= LIMITS.minDailyUsdt && daily <= LIMITS.maxDailyUsdt)) return fail(400, "daily is out of bounds.", CHAIN_ID, g.headers);
  const r = await recordLeash({ wallet: wallet as Address, slug, owner, dailyUsdt: daily });
  if ("refused" in r) return fail(r.status, r.refused, CHAIN_ID, g.headers);
  after(() => runLeashes({ budgetMs: 45_000, force: r.leash.id }).then(() => undefined, () => undefined));
  return ok({ ...r.leash, agent: LEASH_POLICIES[slug].name }, { chainId: CHAIN_ID }, g.headers);
}

export async function GET(request: Request) {
  const g = gate(request, { capacity: 120, windowMs: 60_000 }, CHAIN_ID);
  if (!g.allowed) return g.response;
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) return fail(400, "address must be a 0x address.", CHAIN_ID, g.headers);
  const leashes = await leashesOf(address);
  const withRuns = await Promise.all(leashes.map(async (l) => ({ ...l, agent: LEASH_POLICIES[l.slug].name, runs: await runsOfLeash(l.id, 10) })));
  return ok({ address: address.toLowerCase(), leashes: withRuns }, { chainId: CHAIN_ID }, g.headers);
}
