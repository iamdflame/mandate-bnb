/**
 * Set and Earn progress for one wallet, as MANDATE records it.
 *
 *   GET /api/v1/quest/0x…
 *
 * Which of the four jobs it has hired an agent for with its own money, how many
 * agents it owns that are listed here, and how many ratings it wrote. Team
 * wallets never complete it.
 */

import { preflight } from "@/lib/api/respond";
import { trackingAnswer } from "@/lib/api/tracking-route";
import { questOf } from "@/lib/market/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  return trackingAnswer(request, (await params).address, questOf);
}
