/**
 * An agent's pose, read from what the chain and our calls actually show.
 *
 *   awake      answered our call in the last 15 minutes
 *   ready      can be hired (answered in the last 24 hours, a rail we can pay)
 *   dozing     listed, but not answering lately
 *   failed     its answer did not match our reading of the chain
 *   graveyard  took payment and did not deliver (kept, not deleted)
 */
import type { CharacterState } from "@/components/characters/Agent";

export function poseOf(a: { hireable?: boolean; answeredMinutesAgo?: number | null; checked?: string | null; whyNot?: { short: string | null; reason: string } | null; liveness?: string }): CharacterState {
  const why = `${a.whyNot?.short ?? ""} ${a.whyNot?.reason ?? ""}`.toLowerCase();
  if (/took (the )?(payment|money)|did not deliver|graveyard/.test(why)) return "graveyard";
  if (a.checked === "fail") return "failed";
  if (typeof a.answeredMinutesAgo === "number" && a.answeredMinutesAgo <= 15) return "awake";
  if (a.hireable) return "ready";
  return "dozing";
}

/** "answered 12 min ago", "answered 3 h ago", or null when it never has. */
export function answeredAgo(minutes: number | null | undefined): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return null;
  if (minutes < 1) return "answered just now";
  if (minutes < 60) return `answered ${Math.round(minutes)} min ago`;
  if (minutes < 48 * 60) return `answered ${Math.round(minutes / 60)} h ago`;
  return `answered ${Math.round(minutes / 1440)} days ago`;
}
