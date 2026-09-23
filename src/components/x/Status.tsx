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

/** Four states, because "offline" hides three different facts. */
export default function Status({ liveness }: { liveness: Listing["liveness"] }) {
  return (
    <span className={`x-status x-status--${liveness}`} title={WHY[liveness]}>
      <span className="x-status__dot" aria-hidden="true" />
      {WORD[liveness]}
    </span>
  );
}
