/**
 * Agents we have stopped offering, and why.
 *
 * A pause is a decision with a reason, recorded here and enforced everywhere
 * from here. It used to be a sentence: the agent page said Grid-1 "is paused"
 * while its session was live and every surface still offered it for hire. A
 * state that only lives in copy is a claim, so the hire law reads this before
 * anything an agent says or does, the lease renewer never renews a paused
 * leash, the scheduled runner never acts for one, and its x402 endpoint stops
 * taking money.
 *
 * The session is left to run out rather than revoked. Nothing acts through it
 * once the runner skips it, and a revocation is a mainnet transaction that
 * would change nothing a buyer can see.
 */

import { referenceRegistrations } from "@/lib/house";

export interface Pause {
  slug: "range-1" | "grid-1" | "yield-1" | "guard-1";
  /** The day the decision was taken, UTC. */
  since: string;
  /** The whole reason, for the agent page and the API. */
  reason: string;
  /** A few words, for a tile. */
  short: string;
}

export const PAUSED: Pause[] = [
  {
    slug: "grid-1",
    since: "2026-09-23",
    reason:
      "Paused: over its first trading window it lost to simply holding, mostly to gas on very small trades. It is not offered for hire until a new window beats holding, and the losing record stays public.",
    short: "Paused",
  },
];

export const pauseForSlug = (slug: string): Pause | null => PAUSED.find((p) => p.slug === slug) ?? null;

let tokens: { at: number; bySlug: Record<string, string | undefined> } | null = null;

/** The pause on an ERC-8004 token, if that token is one of ours and paused. */
export function pauseFor(tokenId: string): Pause | null {
  // The hire law runs for every listing on every render; the registrations file is read once a minute.
  if (!tokens || Date.now() - tokens.at > 60_000) {
    const regs = referenceRegistrations();
    tokens = { at: Date.now(), bySlug: Object.fromEntries(Object.entries(regs).map(([slug, r]) => [slug, r.tokenId])) };
  }
  return PAUSED.find((p) => tokens!.bySlug[p.slug] === tokenId) ?? null;
}
