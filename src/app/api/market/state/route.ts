/**
 * The whole book, as plain JSON, including the rows the floor hides.
 *
 * `/api/floor` streams and shows only live mandates, which is right for a
 * ticker and wrong for a dashboard: the first thing a person wants to see
 * after a job ends is the job that ended. This returns every mandate on every
 * deployment, with the bid queue attached to the ones that still need a
 * decision, so the dashboard can render a complete history and the action that
 * moves each row forward. The reading itself lives in lib/market/market-state,
 * where the jobs page calls it directly.
 */

import { NextResponse } from "next/server";
import { MARKET_ADDRESS } from "@/lib/chain/market";
import { marketState } from "@/lib/market/market-state";

export type { MarketBid, MarketMandate } from "@/lib/market/market-state";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  if (!MARKET_ADDRESS) {
    return NextResponse.json({ error: "The market address is not configured." }, { status: 503 });
  }
  try {
    return NextResponse.json(await marketState(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The chain would not answer." }, { status: 502 });
  }
}
