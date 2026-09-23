/**
 * A wallet's or a position's health, and who could fix it, as data.
 *
 *   GET /api/v1/diagnose/0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90
 *   GET /api/v1/diagnose/7546488            a PancakeSwap V3 position id
 *
 * The same reads /diagnose makes: PancakeSwap V3 positions, Venus borrowing
 * and idle stablecoins, every one read from BNB Smart Chain at the block the
 * answer names. For each job the findings call for, the agents a buyer could
 * hire right now, by the same hire law every page on the site uses.
 */

import { isAddress } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok, preflight } from "@/lib/api/respond";
import { live } from "@/lib/data/live";
import { diagnose } from "@/lib/diagnose";
import { agentsFor } from "@/lib/diagnose/agents";
import { hireCounts } from "@/lib/market/hires";
import { hirePath } from "@/lib/market/hire-law";
import { listings } from "@/lib/market/listing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LIMIT = { capacity: 10, windowMs: 60_000 };
const SITE = "https://mandate-coral.vercel.app";

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;

  const input = decodeURIComponent((await params).address).trim();
  if (!isAddress(input) && !/^\d{1,12}$/.test(input)) {
    return fail(400, "Give a wallet address (0x followed by 40 hex characters) or a PancakeSwap V3 position id.", CHAIN_ID, g.headers);
  }

  await live();
  const counts = await hireCounts().catch(() => null);
  const d = await diagnose(input).catch(() => null);
  if (!d) return fail(502, "The chain could not be read for that input just now. Try again in a minute.", CHAIN_ID, g.headers);

  const groups = agentsFor(d.needed, listings(counts?.byTokenId, counts?.settled));

  return ok(
    {
      input: d.input,
      kind: d.kind,
      blockNumber: d.blockNumber,
      findings: d.findings,
      needed: d.needed,
      positions: d.positions.map((p) => ({ ...p, liquidity: p.liquidity.toString() })),
      venus: d.venus ? { ...d.venus, error: d.venus.error.toString() } : null,
      idle: d.idle,
      agents: groups.map((c) => ({
        category: c.category,
        hireable: c.total,
        answering: c.answering,
        best: c.hireable.map((l) => ({
          tokenId: l.tokenId,
          name: l.name,
          price: l.priceLabel,
          usdPrice: l.usdPrice,
          rails: hirePath(l).rails.map((r) => r.kind),
          page: `${SITE}/agents/${l.tokenId}`,
          hire: `${SITE}/hire/${l.tokenId}`,
        })),
      })),
    },
    { chainId: CHAIN_ID, blockNumber: d.blockNumber },
    g.headers,
  );
}
