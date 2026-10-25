/**
 * A live, signed price for a testnet job with another builder's agent, and
 * the exact description to open it with.
 *
 *   POST /api/escrow/testnet/quote {"tokenId": "2554", "wallet": "0x…"}
 *
 * `tokenId` is the agent's id on BNB Smart Chain testnet's ERC-8004 registry.
 * The agent signs its quote for the testnet kernel in test $U, and the job's
 * on-chain description must carry it, or the agent refuses the job. The
 * signature is checked against the wallets its testnet registration names
 * before the buyer is shown a price, and "via mandatemarkets.com" is inside the
 * signed task, so the job says on chain where it was opened.
 */

import { NextResponse } from "next/server";
import { fail, gate, ok } from "@/lib/api/respond";
import { CORS } from "@/lib/api/ratelimit";
import { warm } from "@/lib/data/snapshots";
import { testnetSellers } from "@/lib/testnet/sellers";
import { readRegistryEntry } from "@/lib/sources/registry";
import { negotiateFull } from "@/lib/escrow/a2a";
import { jobDescription } from "@/lib/escrow/sdk";
import { attributed, taskFor } from "@/lib/escrow/task";
import { quoteSigners } from "@/lib/escrow/signers";
import { poolNow } from "@/lib/house/services";
import { DEMO_ADDRESS } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 12, windowMs: 60_000 };
const TESTNET = 97;

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "POST, OPTIONS" } });
}

export async function POST(request: Request) {
  const g = gate(request, LIMIT, TESTNET);
  if (!g.allowed) return g.response;
  let body: { tokenId?: unknown; wallet?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, 'Send JSON: {"tokenId": "…", "wallet": "0x…"}', TESTNET, g.headers);
  }
  const tokenId = typeof body.tokenId === "string" && /^\d{1,12}$/.test(body.tokenId) ? body.tokenId : null;
  if (!tokenId) return fail(400, "tokenId must be the agent's ERC-8004 id on BNB Smart Chain testnet.", TESTNET, g.headers);
  const wallet = typeof body.wallet === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.wallet) ? body.wallet : DEMO_ADDRESS;

  await warm(["testnet-sellers"]);
  const s = testnetSellers().agents[tokenId];
  if (!s || s.ours) return fail(404, "That agent is not another builder's testnet seller on our list.", TESTNET, g.headers);
  const entry = await readRegistryEntry(tokenId, TESTNET).catch(() => null);
  const signers = await quoteSigners(tokenId, entry, TESTNET).catch(() => null);
  if (!signers) return fail(503, "The identity registry did not answer just now, so the agent's quote cannot be checked. Try again in a minute.", TESTNET, g.headers);
  // The form this seller priced before: its card's example, or our task for its job about the buyer's wallet.
  const bnbUsd = s.category === "grid-trading" ? await poolNow().then((p) => p.usdtPerBnb, () => null) : null;
  const task = s.quote?.task ? attributed(s.quote.task) : taskFor(s.category, s.name, { wallet }, { bnbUsd });

  const live = await negotiateFull(s.a2a, task, { signers, notify: s.notify, skill: s.skill, chainId: TESTNET }).catch((e: Error) => ({ error: e.message }));
  if ("error" in live) return fail(502, `The agent's seller did not quote just now: ${live.error.slice(0, 120)}`, TESTNET, g.headers);
  const q = live.quote;
  if (q.unpayable) return fail(409, `This agent cannot be hired here right now: ${q.unpayable}.`, TESTNET, g.headers);
  if (!live.sdk) return fail(409, "This agent's testnet price is not a signed quote, so the job could not be checked.", TESTNET, g.headers);
  return ok(
    {
      tokenId,
      name: s.name,
      provider: q.provider,
      price: q.price,
      description: jobDescription(live.sdk),
      expiresAt: live.sdk.quote_expires_at ?? live.sdk.response.quote_expires_at ?? null,
      etaSeconds: q.etaSeconds,
      task,
    },
    { chainId: TESTNET },
    g.headers,
  );
}
