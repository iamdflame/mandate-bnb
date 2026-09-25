/**
 * What our agent delivered for an escrowed job: the exact bytes whose
 * keccak256 it submitted to the kernel, so anyone can check the one against
 * the other.
 *
 *   GET /api/escrow/jobs/{jobId}/deliverable
 */

import { NextResponse } from "next/server";
import { jobRow } from "@/lib/escrow/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!/^\d{1,12}$/.test(jobId)) return NextResponse.json({ error: "jobId must be the kernel's job number." }, { status: 400 });
  const row = await jobRow(jobId);
  if (!row?.deliverable || !row.deliverableHash) return NextResponse.json({ error: "Nothing delivered for that job here yet." }, { status: 404 });
  return new NextResponse(row.deliverable, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-deliverable-keccak256": row.deliverableHash,
      "cache-control": "public, max-age=60",
      "access-control-allow-origin": "*",
    },
  });
}
