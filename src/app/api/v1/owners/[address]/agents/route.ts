/**
 * The agents a wallet owns on the ERC-8004 registry that MANDATE lists.
 *
 *   GET /api/v1/owners/0x…/agents
 *
 * Each with its registry id, the transaction that minted it where the registry
 * tail has read it, whether it is filed under one of the four jobs, and its
 * page. An agent registered anywhere is listed here the moment it is minted
 * and read, or at once when its owner checks it on /list.
 */

import { preflight } from "@/lib/api/respond";
import { trackingAnswer } from "@/lib/api/tracking-route";
import { agentsOf } from "@/lib/market/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  return trackingAnswer(request, (await params).address, async (owner) => ({ owner: owner.toLowerCase(), agents: await agentsOf(owner) }));
}
