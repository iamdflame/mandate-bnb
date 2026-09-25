import type { Listing } from "@/lib/market/listing";

const WORD: Record<Listing["liveness"], string> = {
  live: "Live",
  "not-agent": "No agent protocol",
  silent: "Not answering",
  "no-endpoint": "No endpoint",
  untested: "Not checked yet",
  paused: "Paused",
};

const WHY: Record<Listing["liveness"], string> = {
  live: "We called its endpoint and it answered as an agent: MCP, A2A, or a price over x402.",
  "not-agent": "Its endpoint answers, but not in MCP, A2A or x402, so there is nothing there we know how to call.",
  silent: "We called its endpoint and nothing came back, or it answered with an error.",
  "no-endpoint": "Its registration names nothing we will call: no endpoint, plain http, or a private address.",
  untested: "We have not called it yet. That is not the same as silent.",
  paused: "One of our agents, paused on purpose. The reason is on its page.",
};

/** Past this, a reading is shown with its age: the same day the hire law allows. */
export const STALE_HOURS = 24;

/** How old a reading is, in the unit a person reads. */
export function ageWords(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

/**
 * Four states, because "offline" hides three different facts, and an age once
 * a reading is old: an agent that answered last week is not shown as live.
 */
export default function Status({ liveness, at }: { liveness: Listing["liveness"]; at?: string | null }) {
  const hours = at ? (Date.now() - Date.parse(at)) / 3_600_000 : null;
  const read = liveness === "live" || liveness === "not-agent" || liveness === "silent";
  const stale = read && hours !== null && Number.isFinite(hours) && hours > STALE_HOURS;
  return (
    <span
      className={`x-status x-status--${stale ? "stale" : liveness}`}
      title={stale ? `${WHY[liveness]} That reading is ${ageWords(hours!)} old; we have not had a newer one.` : WHY[liveness]}
    >
      <span className="x-status__dot" aria-hidden="true" />
      {stale ? `${WORD[liveness]}, ${ageWords(hours!)} ago` : WORD[liveness]}
    </span>
  );
}
