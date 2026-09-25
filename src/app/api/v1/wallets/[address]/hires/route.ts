/**
 * Every hire a wallet made on MANDATE, with the transaction that proves each.
 *
 *   GET /api/v1/wallets/0x…/hires
 *
 * Paid calls it signed (settled by a token transfer from the wallet), jobs with
 * capital it opened on the market, counts per job, and the ratings it wrote on
 * the ERC-8004 reputation registry. Team wallets and sponsored calls are
 * flagged and never count toward the quest.
 */

import { preflight } from "@/lib/api/respond";
import { trackingAnswer } from "@/lib/api/tracking-route";
import { hiresOf } from "@/lib/market/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  return trackingAnswer(request, (await params).address, hiresOf);
}
