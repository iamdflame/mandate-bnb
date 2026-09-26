/**
 * Recording an ERC-8183 job a buyer funded here.
 *
 *   POST /api/escrow/jobs   {"jobId": "56801", "tx": "0x…fund tx", "subject": "0x…" }
 *   POST /api/escrow/jobs   {"jobId": "…", "tx": "0x…", "tokenId": "302257", "inputs": {"address": "0x…"} }
 *
 * Nothing is taken on trust: the job is read from the kernel and kept only
 * when it is funded, the funding transaction came from its client, and its
 * provider is one of our agents' wallets or, for an outside seller, the wallet
 * its seller quoted for that agent. Our agent then delivers, or the outside
 * seller is told, after the answer has gone; the scheduled pass catches any
 * that could not be done at once.
 */

import { after, NextResponse } from "next/server";
import type { Hash } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { CORS } from "@/lib/api/ratelimit";
import { deliver, recordFunded } from "@/lib/escrow/jobs";
import { ESCROW_OPEN } from "@/lib/escrow/open";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = { capacity: 20, windowMs: 60_000 };

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "POST, OPTIONS" } });
}

export async function POST(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  let body: { jobId?: unknown; tx?: unknown; subject?: unknown; tokenId?: unknown; inputs?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, 'Send JSON: {"jobId": "…", "tx": "0x…"}', CHAIN_ID, g.headers);
  }
  const jobId = String(body.jobId ?? "").trim();
  const tx = String(body.tx ?? "").trim();
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 66) : null;
  if (!/^\d{1,12}$/.test(jobId)) return fail(400, "jobId must be the kernel's job number.", CHAIN_ID, g.headers);
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return fail(400, "tx must be the funding transaction's hash.", CHAIN_ID, g.headers);
  const tokenId = typeof body.tokenId === "string" && /^\d{1,12}$/.test(body.tokenId) ? body.tokenId : null;
  const inputs =
    body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs)
      ? Object.fromEntries(Object.entries(body.inputs as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string").slice(0, 12))
      : {};

  const r = await recordFunded(BigInt(jobId), tx as Hash, subject, tokenId ? { tokenId, inputs } : null).catch((e: Error) => ({ refused: `The chain could not be read: ${e.message.split("\n")[0].slice(0, 120)}`, status: 503 }));
  if ("refused" in r) return fail(r.status, r.refused, CHAIN_ID, g.headers);
  // Recorded jobs are always delivered, open or not: a buyer who funded one is owed the work.
  if (r.job.status === "FUNDED") after(() => deliver(jobId).then(() => undefined, () => undefined));
  return ok({ ...r.job, open: ESCROW_OPEN }, { chainId: CHAIN_ID }, g.headers);
}
