/**
 * Agent standings, reconstructed from contract logs on request.
 *
 * Not cached at the edge: the whole claim this endpoint makes is that the
 * record is current and derived, so serving a stale copy would undercut it.
 */

import { readStandings } from "@/lib/chain/standings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await readStandings();
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { standings: [], complete: false, error: String(error).slice(0, 200) },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }
}
