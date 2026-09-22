import type { Listing } from "@/lib/market/listing";

const WORD: Record<Listing["liveness"], string> = {
  live: "Live",
  silent: "Not answering",
  "no-endpoint": "No endpoint",
  untested: "Not checked yet",
};

const WHY: Record<Listing["liveness"], string> = {
  live: "We called its endpoint and it answered.",
  silent: "We called its endpoint and nothing came back.",
  "no-endpoint": "Its registration names nothing to call.",
  untested: "We have not called it yet. That is not the same as silent.",
};

/** Four states, because "offline" hides three different facts. */
export default function Status({ liveness }: { liveness: Listing["liveness"] }) {
  return (
    <span className={`x-status x-status--${liveness}`} title={WHY[liveness]}>
      <span className="x-status__dot" aria-hidden="true" />
      {WORD[liveness]}
    </span>
  );
}
