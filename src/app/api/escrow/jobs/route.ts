/**
 * Recording an ERC-8183 job a buyer funded for one of our agents.
 *
 *   POST /api/escrow/jobs   {"jobId": "56801", "tx": "0x…fund tx", "subject": "0x…" }
 *
 * Nothing is taken on trust: the job is read from the kernel and kept only
 * when it is funded, its provider is one of our agents' wallets, and the
 * funding transaction came from its client. Our agent then delivers after the
 * answer has gone, and the scheduled pass catches any it could not.
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
  let body: { jobId?: unknown; tx?: unknown; subject?: unknown };
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

  const r = await recordFunded(BigInt(jobId), tx as Hash, subject).catch((e: Error) => ({ refused: `The chain could not be read: ${e.message.split("\n")[0].slice(0, 120)}`, status: 503 }));
  if ("refused" in r) return fail(r.status, r.refused, CHAIN_ID, g.headers);
  // Recorded jobs are always delivered, open or not: a buyer who funded one is owed the work.
  if (r.job.status === "FUNDED") after(() => deliver(jobId).then(() => undefined, () => undefined));
  return ok({ ...r.job, open: ESCROW_OPEN }, { chainId: CHAIN_ID }, g.headers);
}
