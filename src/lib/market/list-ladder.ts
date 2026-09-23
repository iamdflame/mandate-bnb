/**
 * Where a seller stands, and the one thing that moves it up.
 *
 * Every agent registered on BSC already has a page here; listing is not a
 * favour we grant. What a seller needs is the opposite of a form: a precise
 * statement of what is missing and what would fix it. Six rungs, each a test
 * this site runs itself, in the order a buyer depends on them:
 *
 *   0 Registered   its identity exists in the ERC-8004 registry
 *   1 Resolvable   its agent card parses into a name and a description
 *   2 Live         its endpoint answers in an agent protocol
 *   3 Priced       it quotes a price on a rail this marketplace settles
 *   4 Hallmarked   its assay passes at or above the bar
 *   5 Settled      it has been paid for work and delivered it
 *
 * A rung only counts when every rung below it does, because a buyer meets
 * them in that order: a price is worth nothing from an endpoint that does
 * not answer. Pure, so the advice for every state is tested without a network.
 */

import { HALLMARK_BAR } from "@/lib/ladder";
import type { ProbeResult } from "@/lib/probe";
import type { Quote } from "@/lib/x402/quote";

export const LIST_RUNGS = [
  { n: 0, name: "Registered", test: "Its identity exists in the ERC-8004 registry on BNB Smart Chain." },
  { n: 1, name: "Resolvable", test: "Its agent card parses into a name and a description." },
  { n: 2, name: "Live", test: "Its endpoint answers in an agent protocol: an MCP handshake, an A2A card and call, or a price over x402." },
  { n: 3, name: "Priced", test: "It quotes a price this marketplace can pay: USD1 or $U by EIP-3009, or USDT by Permit2, on BNB Smart Chain." },
  { n: 4, name: "Hallmarked", test: `Its assay against the chain passes at a fineness of ${HALLMARK_BAR} or more.` },
  { n: 5, name: "Settled", test: "It has been paid for work and delivered it: a paid call that answered, or an escrowed job whose deliverable matches its commitment." },
] as const;

export interface ListEvidence {
  tokenId: string;
  registered: boolean;
  card: { resolved: boolean; name: string | null; description: string | null; error: string | null };
  /** The endpoint the card offers, when it offers one. */
  endpoint: string | null;
  probe: Pick<ProbeResult, "answered" | "status" | "protocol" | "refused" | "error"> | null;
  quote: Pick<Quote, "payable" | "unpayable" | "amount" | "decimals" | "asset" | "assetName" | "network"> | null;
  /** The assay's fineness, or null when no assay could be run or read. */
  fineness: number | null;
  /** Paid calls delivered and escrowed jobs matched, from our own record. */
  settled: number;
}

export interface RungCheck {
  n: number;
  name: string;
  test: string;
  passed: boolean;
  /** What we saw, in one sentence. */
  saw: string;
}

export interface ListPlacement {
  /** The highest rung reached, or -1 when the token is not in the registry at all. */
  rung: number;
  name: string;
  rungs: RungCheck[];
  /** The one thing to do next, or null at the top. */
  next: { rung: number; name: string; todo: string } | null;
}

const PROTOCOL_WORD: Record<string, string> = { mcp: "an MCP handshake", a2a: "an A2A card and call", x402: "a price over x402" };

/** What we saw at each rung, whether or not it passed. */
function checks(e: ListEvidence): RungCheck[] {
  const p = e.probe;
  // An answer only counts from an endpoint the card names and we were willing to call.
  const live = Boolean(e.endpoint && p?.answered && !p.refused);
  const priced = Boolean(e.quote?.payable);
  const hallmarked = e.fineness !== null && e.fineness >= HALLMARK_BAR;
  const saw = [
    e.registered ? `Token ${e.tokenId} exists in the registry.` : `No identity with token ${e.tokenId} exists in the registry.`,
    e.card.resolved
      ? `Its card reads as ${e.card.name ? `"${e.card.name}"` : "an unnamed agent"}${e.card.description ? ", with a description" : ", with no description"}.`
      : `Its card did not resolve${e.card.error ? `: ${e.card.error}` : "."}`,
    !e.endpoint
      ? "Its card names no endpoint to call."
      : p?.refused
        ? `We will not call ${e.endpoint}: ${p.error ?? "plain http, or a private address"}.`
        : live
          ? `${e.endpoint} answered with ${PROTOCOL_WORD[p?.protocol ?? ""] ?? "an agent protocol"}.`
          : p?.protocol === "http"
            ? `${e.endpoint} answered ${p.status ?? ""}, but in none of MCP, A2A or x402.`.replace("  ", " ")
            : `${e.endpoint} did not answer${p?.error ? `: ${p.error}` : "."}`,
    priced
      ? `It quotes a price we can pay, on ${e.quote!.network}.`
      : e.quote
        ? `It quotes a price we cannot pay: ${e.quote.unpayable ?? "not on a rail this marketplace settles"}.`
        : "It has not quoted us a price.",
    e.fineness === null ? "No assay could be read for it." : `Its assay reads a fineness of ${e.fineness}.`,
    e.settled > 0 ? `${e.settled} paid job${e.settled === 1 ? "" : "s"} delivered through this marketplace.` : "No paid job delivered through this marketplace yet.",
  ];
  const passed = [e.registered, e.card.resolved && Boolean(e.card.name || e.card.description), live, priced, hallmarked, e.settled > 0];
  return LIST_RUNGS.map((r, i) => ({ n: r.n, name: r.name, test: r.test, passed: passed[i]!, saw: saw[i]! }));
}

/** The one instruction that clears a rung, written for the state we saw. */
function todo(n: number, e: ListEvidence): string {
  const p = e.probe;
  switch (n) {
    case 0:
      return "Register the agent in the ERC-8004 identity registry on BNB Smart Chain, then come back with its token id.";
    case 1:
      return e.card.resolved
        ? "Give the card a name and a description. Buyers search by them, and the category is read from them."
        : "Publish a JSON agent card at the URI in your registration, with a name, a description and a services list. A URI that is still an {agentId} template does not resolve.";
    case 2:
      if (!e.endpoint) return "Add an https endpoint to the card's services. Without one there is nothing for a buyer to call.";
      if (p?.refused) return "Serve the endpoint over https from a public address. We do not call plain http, private networks, or a name that resolves to one.";
      if (p?.protocol === "http")
        return "Answer in an agent protocol at that endpoint: complete an MCP initialize and tools/list, serve an A2A agent card at /.well-known/agent-card.json, or answer an unpaid request with a 402 and a price.";
      return "Make the endpoint answer within eight seconds. We call it ourselves; a card's claim that it is live is not evidence.";
    case 3:
      if (e.quote && !e.quote.payable)
        return `Quote a price we can settle: USD1 or $U with EIP-3009 transferWithAuthorization, or USDT through Permit2, on BNB Smart Chain. Today: ${e.quote.unpayable ?? "a rail we do not settle"}.`;
      return "Answer an unpaid request with a 402 carrying an x402 price in USD1 or $U (EIP-3009), or USDT (Permit2), on BNB Smart Chain.";
    case 4:
      return e.fineness === null
        ? "Run the assay on this agent. It tests the card against the chain: identity, custody, activity, capability, reputation and performance."
        : `Raise the assay's fineness from ${e.fineness} to ${HALLMARK_BAR}: its failing checks are listed on the agent's page, each with the evidence that failed it.`;
    case 5:
      return "Deliver one paid job: a buyer's paid call that answers with the work, or an escrowed job whose deliverable hashes to the commitment you made on chain.";
    default:
      return "";
  }
}

export function placeListing(e: ListEvidence): ListPlacement {
  const rungs = checks(e);
  // The rung reached is the last one whose every predecessor passed too.
  let rung = -1;
  for (const r of rungs) {
    if (!r.passed) break;
    rung = r.n;
  }
  const nextN = rung + 1;
  const next = nextN < LIST_RUNGS.length ? { rung: nextN, name: LIST_RUNGS[nextN]!.name, todo: todo(nextN, e) } : null;
  return { rung, name: rung < 0 ? "Not registered" : LIST_RUNGS[rung]!.name, rungs, next };
}
