/**
 * The terms of a leash, for the browser to grant.
 *
 *   GET /api/leash/terms?wallet=0x…&slug=yield-1&daily=1&days=7
 *
 * The session key's public half (its private half never leaves our servers),
 * the exact permissions, the expiry, and the one approval the wallet's owner
 * gives Venus. Nothing here is signed or stored.
 */

import { isAddress, type Address } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { sessionPublicFor } from "@/lib/leash/keys";
import { isLeashSlug, LEASH_POLICIES, LIMITS, permissionsFor } from "@/lib/leash/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 60, windowMs: 60_000 };

export async function GET(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  const u = new URL(request.url);
  const wallet = u.searchParams.get("wallet") ?? "";
  const slug = u.searchParams.get("slug") ?? "";
  const daily = Number(u.searchParams.get("daily") ?? "1");
  const days = Math.round(Number(u.searchParams.get("days") ?? "7"));
  if (!isAddress(wallet)) return fail(400, "wallet must be the passkey wallet's 0x address.", CHAIN_ID, g.headers);
  if (!isLeashSlug(slug)) return fail(400, "slug is yield-1 or guard-1.", CHAIN_ID, g.headers);
  if (!(daily >= LIMITS.minDailyUsdt && daily <= LIMITS.maxDailyUsdt)) return fail(400, `daily is between ${LIMITS.minDailyUsdt} and ${LIMITS.maxDailyUsdt} USDT.`, CHAIN_ID, g.headers);
  if (!(days >= LIMITS.minDays && days <= LIMITS.maxDays)) return fail(400, `days is between ${LIMITS.minDays} and ${LIMITS.maxDays}.`, CHAIN_ID, g.headers);
  const pub = sessionPublicFor(wallet as Address, slug);
  if (!pub) return fail(503, "This deployment holds no leash key.", CHAIN_ID, g.headers);
  const p = LEASH_POLICIES[slug];
  const perms = permissionsFor(slug, daily);
  return ok(
    {
      agent: p.name,
      does: p.does,
      may: p.calls.map((c) => c.words),
      sessionSigner: { address: pub.address, publicKey: pub.publicKey },
      permissions: { calls: perms.calls, spend: perms.spend.map((s) => ({ ...s, limit: s.limit.toString() })) },
      expiry: Math.floor(Date.now() / 1000) + days * 86_400,
      approve: p.approve,
    },
    { chainId: CHAIN_ID },
    g.headers,
  );
}
