/**
 * Recording a revoke the wallet's owner signed.
 *
 *   POST /api/leash/revoke   {"wallet": "0x…", "slug": "yield-1", "tx": "0x…"}
 *
 * Kept only once the KeyStore shows our agent's key no longer valid. The
 * agent stops either way: a revoked key cannot act, whatever this says.
 */

import { isAddress, type Address } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { isLeashSlug } from "@/lib/leash/policy";
import { recordRevoke } from "@/lib/leash/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const g = gate(request, { capacity: 30, windowMs: 60_000 }, CHAIN_ID);
  if (!g.allowed) return g.response;
  let b: { wallet?: unknown; slug?: unknown; tx?: unknown };
  try {
    b = (await request.json()) as typeof b;
  } catch {
    return fail(400, "Send JSON naming the wallet and the agent.", CHAIN_ID, g.headers);
  }
  const wallet = String(b.wallet ?? "");
  const slug = String(b.slug ?? "");
  const tx = typeof b.tx === "string" && /^0x[0-9a-fA-F]{64}$/.test(b.tx) ? b.tx : null;
  if (!isAddress(wallet)) return fail(400, "wallet must be a 0x address.", CHAIN_ID, g.headers);
  if (!isLeashSlug(slug)) return fail(400, "slug is yield-1 or guard-1.", CHAIN_ID, g.headers);
  const r = await recordRevoke(wallet as Address, slug, tx);
  if ("refused" in r) return fail(r.status, r.refused, CHAIN_ID, g.headers);
  return ok(r.leash, { chainId: CHAIN_ID }, g.headers);
}
