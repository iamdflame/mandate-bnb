/**
 * Outside buyers' escrowed jobs per week, on mainnet and testnet: the figure
 * BNB Chain could report for this marketplace, with the wallets we operate
 * listed so anyone can redo the count from the chain.
 *
 *   GET /api/v1/proof
 */

import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok, preflight } from "@/lib/api/respond";
import { ESCROW, ESCROW_TESTNET } from "@/lib/escrow/contracts";
import { outsideByWeek } from "@/lib/market/weekly";
import { teamWallets } from "@/lib/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LIMIT = { capacity: 30, windowMs: 60_000 };

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  const weeks = await outsideByWeek().catch(() => null);
  if (!weeks) return fail(502, "Our books could not be read just now. Try again in a minute.", CHAIN_ID, g.headers);
  return ok(
    {
      what: "Escrowed jobs opened through Mandate and paid for by wallets we do not operate, by the week they were funded (weeks start Monday, UTC). `ours` is our own tests in the same week, counted nowhere else.",
      mainnet: { contract: ESCROW.commerce, weeks: weeks.mainnet },
      testnet: { contract: ESCROW_TESTNET.commerce, weeks: weeks.testnet },
      teamWallets: Object.entries(teamWallets()).map(([wallet, what]) => ({ wallet, what })),
    },
    { chainId: CHAIN_ID },
    g.headers,
  );
}
