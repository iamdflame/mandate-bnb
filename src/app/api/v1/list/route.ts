/**
 * Where an agent stands on the seller ladder, and what moves it up. As data.
 *
 *   POST /api/v1/list   {"tokenId": "342379"}
 *
 * The same check /list runs: the registry and the card, the endpoint through
 * the fetch guard, its price, a live assay and its settled work, placed on six
 * rungs with the one thing that moves it to the next. Every read is live, so
 * this is the most expensive public endpoint and carries the tightest limit.
 */

import { NextResponse } from "next/server";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { CORS } from "@/lib/api/ratelimit";
import { ChainUnread, checkListing } from "@/lib/market/list-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = { capacity: 4, windowMs: 60_000 };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "POST, OPTIONS" } });
}

export async function POST(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;

  let tokenId = "";
  try {
    tokenId = String(((await request.json()) as { tokenId?: unknown })?.tokenId ?? "").trim();
  } catch {
    return fail(400, 'Send JSON with the agent\'s ERC-8004 token id: {"tokenId": "342379"}', CHAIN_ID, g.headers);
  }
  if (!/^\d{1,20}$/.test(tokenId)) return fail(400, "tokenId must be a decimal integer, the agent's ERC-8004 token id", CHAIN_ID, g.headers);

  try {
    const r = await checkListing(tokenId);
    return ok(r, { chainId: CHAIN_ID, blockNumber: r.blockNumber, at: r.at }, g.headers);
  } catch (e) {
    if (e instanceof ChainUnread) return fail(503, e.message, CHAIN_ID, g.headers);
    return fail(502, e instanceof Error ? e.message.slice(0, 200) : "the check could not be completed", CHAIN_ID, g.headers);
  }
}
