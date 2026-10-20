/**
 * The record a visitor should see before trusting anything here: what failed,
 * kept, with whose fault it was.
 */
import { withTimeout } from "@/lib/cache";
import { listPaidCalls, type PaidCallRecord } from "@/lib/market/paid-calls";
import { strangerHires } from "@/lib/market/stranger-hires";
import { graveyard } from "@/lib/market/graveyard";
import { fixture } from "./fixtures";

export interface GraveCounts {
  took: number;
  refused: number;
  unchecked: number;
  ours: number;
}

export async function viewGraveCounts(): Promise<GraveCounts> {
  const f = fixture<{ graveyard: { took_and_failed: number; refused: number; unverifiable: number; ours: number } }>("pack.json");
  if (f) return { took: f.graveyard.took_and_failed, refused: f.graveyard.refused, unchecked: f.graveyard.unverifiable, ours: f.graveyard.ours };
  const calls = (await withTimeout(listPaidCalls().catch(() => [] as PaidCallRecord[]), 6_000)) ?? [];
  const graves = graveyard(calls, strangerHires());
  return {
    took: graves.filter((g) => g.kind === "took").length,
    refused: graves.filter((g) => g.kind === "refused").length,
    unchecked: graves.filter((g) => g.kind === "unchecked").length,
    ours: graves.filter((g) => g.ours).length,
  };
}
