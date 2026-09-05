/**
 * The trust ladder, as data.
 *
 * Every rung with its population, the test that settles it, and the command
 * that re-derives it. A rung that cannot be measured reports null rather than
 * a plausible number, exactly as the page does.
 */

import { readLadder } from "@/lib/ladder";
import { gate, ok, preflight } from "@/lib/api/respond";
import { CHAIN_ID } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 60, windowMs: 60_000 };

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;

  const reading = await readLadder();
  return ok(
    {
      minFineness: reading.minFineness,
      source: reading.source,
      capturedAt: reading.capturedAt,
      rungs: reading.rungs.map((r) => ({
        rung: r.n,
        name: r.name,
        test: r.test,
        population: r.population,
        isFloor: Boolean(r.atLeast),
        method: r.source,
        verify: r.verify ?? null,
        discontinuity: r.discontinuity ?? null,
      })),
    },
    { chainId: CHAIN_ID, blockNumber: reading.blockNumber, at: reading.at },
    g.headers,
  );
}
