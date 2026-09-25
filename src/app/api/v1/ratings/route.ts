/**
 * Recording a rating a buyer wrote on the ERC-8004 reputation registry.
 *
 *   POST /api/v1/ratings   {"tx": "0x…"}
 *
 * Nothing is taken on trust: the transaction is read from BNB Smart Chain, and
 * kept only if it succeeded, called giveFeedback on the reputation registry,
 * and was sent by the wallet it is filed under. The wallet is the sender, not
 * whatever a caller claims.
 */

import { decodeFunctionData, type Hash } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { marketClient } from "@/lib/chain/market";
import { REPUTATION_ABI, REPUTATION_REGISTRY } from "@/lib/chain/reputation-abi";
import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { NextResponse } from "next/server";
import { CORS } from "@/lib/api/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 20, windowMs: 60_000 };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "POST, OPTIONS" } });
}

export async function POST(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  let tx = "";
  try {
    tx = String(((await request.json()) as { tx?: unknown }).tx ?? "").trim();
  } catch {
    return fail(400, 'Send JSON naming the rating transaction: {"tx": "0x…"}', CHAIN_ID, g.headers);
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return fail(400, "tx must be a transaction hash.", CHAIN_ID, g.headers);

  const [receipt, sent] = await Promise.all([
    marketClient.getTransactionReceipt({ hash: tx as Hash }).catch(() => null),
    marketClient.getTransaction({ hash: tx as Hash }).catch(() => null),
  ]);
  if (!receipt || !sent) return fail(404, "That transaction is not on BNB Smart Chain yet. Try again once it is mined.", CHAIN_ID, g.headers);
  if (receipt.status !== "success") return fail(400, "That transaction reverted, so no rating was written.", CHAIN_ID, g.headers);
  if (sent.to?.toLowerCase() !== REPUTATION_REGISTRY) return fail(400, "That transaction is not a call to the ERC-8004 reputation registry.", CHAIN_ID, g.headers);

  let decoded;
  try {
    decoded = decodeFunctionData({ abi: REPUTATION_ABI, data: sent.input });
  } catch {
    return fail(400, "That transaction is not a giveFeedback call.", CHAIN_ID, g.headers);
  }
  const [agentId, score, , tag1, tag2] = decoded.args as readonly [bigint, bigint, number, string, string, string, string, string];

  if (pg) {
    await ensureTables();
    await pg`
      insert into ratings (tx, wallet, token_id, score, tag1, tag2, block)
      values (${tx.toLowerCase()}, ${sent.from.toLowerCase()}, ${agentId.toString()}, ${Number(score)}, ${tag1}, ${tag2}, ${Number(receipt.blockNumber)})
      on conflict (tx) do nothing
    `;
  }
  return ok(
    { tx: tx.toLowerCase(), wallet: sent.from.toLowerCase(), agentId: agentId.toString(), score: Number(score), tag1, tag2, block: Number(receipt.blockNumber) },
    { chainId: CHAIN_ID, blockNumber: receipt.blockNumber },
    g.headers,
  );
}
