/**
 * What goes in the graveyard, decided in one place.
 *
 * Three kinds of failure, each read from a record that exists:
 *
 *   took       money moved on chain and the work did not come back, or came
 *              back as an error
 *   refused    we signed exactly the price the seller quoted, and it would
 *              not take it
 *   unchecked  an escrowed job whose deliverable does not hash to the
 *              commitment the provider made when it took the job
 *
 * A failure that was ours stays in, labelled as ours, and counts against
 * nobody. Deleting it would have been the easy fix and the dishonest one.
 * Nothing leaves when an agent later delivers: this is a record, and the hire
 * law is where an agent earns its way back.
 */

import type { PaidCallRecord } from "@/lib/market/paid-calls";
import type { StrangerHire } from "@/lib/market/stranger-hires";

export type GraveKind = "took" | "refused" | "unchecked";

export interface Grave {
  kind: GraveKind;
  id: string;
  tokenId: string;
  name: string;
  at: string;
  /** What we paid for, in the words of our own record. */
  subject: string | null;
  /** The seller's own words, where it gave any. Never rewritten. */
  said: string | null;
  /** Our note on what happened, including whose mistake it was. */
  note: string | null;
  /** The failure was ours, so it counts against nobody. */
  ours: boolean;
  /** The payment, or for a job the funding. */
  tx: string | null;
  /** A second transaction worth checking: our dispute of a job. */
  disputeTx: string | null;
  block: number | null;
  /** sha256 of the full request and response, for anyone checking the row. */
  sha256: string | null;
  /** Repository path of the full exchange. */
  evidence: string | null;
  /** In whole tokens; every stablecoin these sellers take on BSC has 18 decimals. */
  amount: number | null;
  asset: string | null;
  /** For a job, the budget and its token as recorded when it was funded. */
  budget: string | null;
}

type Disputed = StrangerHire & { disputed?: { tx?: string | null; at?: string | null; because?: string | null } };

export function graveyard(calls: PaidCallRecord[], hires: StrangerHire[]): Grave[] {
  const out: Grave[] = [];
  for (const c of calls) {
    const took = c.paid && !c.delivered;
    const refused = !c.paid && Boolean(c.refused);
    if (!took && !refused) continue;
    out.push({
      kind: took ? "took" : "refused",
      id: c.id,
      tokenId: c.tokenId,
      name: c.name,
      at: c.at,
      subject: c.subject,
      said: c.refused ? c.refused.slice(0, 400) : null,
      note: c.note ?? null,
      ours: c.fault === "ours",
      tx: c.tx,
      disputeTx: null,
      block: c.block,
      sha256: c.transcriptSha256 || null,
      evidence: c.evidence,
      amount: c.amount ? Number(c.amount) / 1e18 : null,
      asset: c.asset,
      budget: null,
    });
  }
  for (const h of hires as Disputed[]) {
    // Only a deliverable that was read and did not match. An unread one is not a finding.
    if (h.deliverable?.hashMatches !== false) continue;
    out.push({
      kind: "unchecked",
      id: `job:${h.jobId}`,
      tokenId: h.tokenId,
      name: h.who,
      at: h.deliverable.readAt ?? h.at,
      subject: h.task,
      said: null,
      note: h.disputed?.because
        ? `We disputed the job on chain: ${h.disputed.because}.`
        : "The deliverable it submitted does not hash to the commitment it made when it took the job, under any reading we tried.",
      ours: false,
      tx: h.tx,
      disputeTx: h.disputed?.tx ?? null,
      block: null,
      sha256: null,
      evidence: h.deliverable.url,
      amount: null,
      asset: null,
      budget: `${h.budget} ${h.token}`,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** The graveyard's anchor for one row, so an agent page can link straight to it. */
export const graveAnchor = (g: Pick<Grave, "id">): string => `g-${g.id.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60)}`;

/** An agent's own failure on record, for the line on its page. One of ours never counts against it. */
export function buriedFor(tokenId: string, graves: Grave[]): Grave | null {
  return graves.find((g) => g.tokenId === tokenId && !g.ours) ?? null;
}
