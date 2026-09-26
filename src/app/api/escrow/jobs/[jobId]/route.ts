/**
 * One escrowed job, as the kernel and our record have it.
 *
 *   GET /api/escrow/jobs/{jobId}
 */

import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { deliverableUrl, jobRow, readJob } from "@/lib/escrow/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 120, windowMs: 60_000 };

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  const { jobId } = await params;
  if (!/^\d{1,12}$/.test(jobId)) return fail(400, "jobId must be the kernel's job number.", CHAIN_ID, g.headers);
  const [row, chain] = await Promise.all([jobRow(jobId), readJob(BigInt(jobId)).catch(() => null)]);
  if (!chain) return fail(503, "The escrow could not be read just now.", CHAIN_ID, g.headers);
  const { deliverable: _body, sellerAnswer, ...kept } = row ?? { deliverable: null, sellerAnswer: null };
  return ok(
    {
      jobId,
      status: chain.status,
      client: chain.client,
      provider: chain.provider,
      budget: chain.budget.toString(),
      expiredAt: Number(chain.expiredAt),
      submittedAt: Number(chain.submittedAt) || null,
      deliverableHash: /^0x0{64}$/.test(chain.deliverable) ? null : chain.deliverable,
      // Ours is served here and hashes to the commitment; an outside seller's is where it says.
      deliverableUrl: row?.outside ? row.sellerUrl : row?.deliverableHash ? deliverableUrl(jobId) : null,
      // What an outside seller sent back when told the job was funded, as it sent it.
      sellerAnswer: row?.outside && sellerAnswer ? (JSON.parse(sellerAnswer) as unknown) : null,
      ours: Boolean(row),
      record: row ? kept : null,
    },
    { chainId: CHAIN_ID },
    g.headers,
  );
}
