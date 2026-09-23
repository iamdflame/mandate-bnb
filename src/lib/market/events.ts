/**
 * What happened on the marketplace, as one feed.
 *
 * Every event here is read from a record that exists: our probe's own call to
 * an endpoint, a payment that settled on chain, an escrowed job, a session
 * granted or revoked, an agent registering. Each one carries where it came
 * from and, where there is one, a link to the proof. Nothing is synthesised to
 * make the feed look busier; a quiet week is shown as a quiet week.
 */

import type { Category } from "@/lib/config";
import { getProbes } from "@/lib/data/probes";
import { getAgentIndex } from "@/lib/data/agents";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { strangerHires } from "@/lib/market/stranger-hires";
import { listSessions } from "@/lib/chain/session-store";
import { assetSymbol } from "@/lib/market/listing";

export type EventKind = "responded" | "silent" | "paid" | "failed" | "job" | "granted" | "revoked" | "listed";

export interface MarketEvent {
  id: string;
  kind: EventKind;
  at: string;
  /** Who it is about, as the registry names them. */
  actor: string;
  tokenId?: string;
  category?: Category | null;
  /** The verb, short. */
  what: string;
  /** The one figure worth showing: a latency, an amount, a cap. */
  figure?: string;
  /** Where the fact came from. */
  source: "probe" | "chain" | "registry" | "session store";
  /** A link to the proof, when there is one. */
  proof?: string;
  /** A sentence of context: why a payment failed, whose mistake it was. */
  note?: string;
}

const bsc = (tx: string) => `https://bscscan.com/tx/${tx}`;
const amount = (wei: string | null) => (wei ? `${(Number(wei) / 1e18).toLocaleString("en-GB", { maximumFractionDigits: 4 })}` : null);

export interface Feed {
  events: MarketEvent[];
  /** When each source was last read, so the feed can say how fresh it is. */
  sources: { probe: string | null };
}

/**
 * How a revocation reads in the feed. Keys the site found on the demo account
 * and could not account for are real revocations, but "Orphaned key" means
 * nothing to a visitor, so they are named for what they are.
 */
export function revokedWords(label: string): { actor: string; what: string } {
  return /orphan/i.test(label)
    ? { actor: "A leftover key on the demo account", what: "was revoked" }
    : { actor: label, what: "had its permission revoked" };
}

/** Events grouped under Today, Yesterday or a date, newest first. */
export function byDay(events: MarketEvent[], now = Date.now()): { day: string; events: MarketEvent[] }[] {
  const out: { day: string; events: MarketEvent[] }[] = [];
  const dayOf = (iso: string) => {
    const d = new Date(iso);
    const today = new Date(now);
    const diff = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 86_400_000);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
  };
  for (const e of events) {
    const day = dayOf(e.at);
    const last = out[out.length - 1];
    if (last && last.day === day) last.events.push(e);
    else out.push({ day, events: [e] });
  }
  return out;
}

/**
 * A feed that shows the market rather than the probe.
 *
 * The census calls a few hundred agents in one sweep, so by time alone the
 * newest ten events are always ten probe answers from the same minute. That is
 * true and it is not what anybody opening the page wants to know. This keeps
 * every kind of event and caps how many of the most frequent kind appear.
 */
export function mixed(events: MarketEvent[], perKind: Partial<Record<EventKind, number>>, limit: number): MarketEvent[] {
  const used = new Map<EventKind, number>();
  const out: MarketEvent[] = [];
  for (const e of events) {
    const cap = perKind[e.kind];
    const n = used.get(e.kind) ?? 0;
    if (cap !== undefined && n >= cap) continue;
    used.set(e.kind, n + 1);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

export async function marketEvents(opts: { limit?: number; since?: number } = {}): Promise<Feed> {
  const limit = opts.limit ?? 60;
  const since = opts.since ?? Date.now() - 30 * 24 * 3600 * 1000;
  const index = getAgentIndex();
  const byId = new Map(index.agents.map((a) => [a.tokenId, a]));
  const nameOf = (id: string) => byId.get(id)?.name?.trim() || `Agent ${id}`;
  const catOf = (id: string) => (byId.get(id)?.category as Category | null | undefined) ?? null;
  const out: MarketEvent[] = [];

  // Our probe's calls. Only the latest reading per agent is kept, so these are
  // "last seen answering", not a history.
  const probes = getProbes();
  for (const r of probes.results) {
    if (!r.at || !byId.has(r.tokenId)) continue;
    if (r.answered && !r.error) {
      out.push({
        id: `probe:${r.tokenId}`,
        kind: "responded",
        at: r.at,
        actor: nameOf(r.tokenId),
        tokenId: r.tokenId,
        category: catOf(r.tokenId),
        what: r.status === 402 ? "quoted a price" : "answered our check",
        figure: r.latencyMs != null ? `${r.latencyMs} ms` : undefined,
        source: "probe",
      });
    }
  }

  const calls = await listPaidCalls().catch(() => []);
  for (const c of calls) {
    out.push({
      id: `call:${c.id}`,
      kind: c.paid && c.delivered ? "paid" : c.paid ? "failed" : "failed",
      at: c.at,
      actor: c.name,
      tokenId: c.tokenId,
      category: (c.category as Category) ?? null,
      what: c.paid && c.delivered ? "was paid and delivered" : c.paid ? "took payment and returned an error" : "refused a payment",
      figure: amount(c.amount) ? `${amount(c.amount)} ${assetSymbol(c.asset) ?? ""}`.trim() : undefined,
      source: "chain",
      proof: c.tx ? bsc(c.tx) : undefined,
      note: c.fault === "ours" ? `Our mistake, not the seller's. ${c.note ?? ""}`.trim() : (c.note ?? c.refused ?? undefined)?.slice(0, 280),
    });
  }

  for (const h of strangerHires()) {
    out.push({
      id: `job:${h.jobId}`,
      kind: "job",
      at: h.at,
      actor: nameOf(h.tokenId),
      tokenId: h.tokenId,
      category: catOf(h.tokenId),
      what: h.deliverable?.hashMatches ? "delivered an escrowed job" : "was hired through escrow",
      figure: `${amount(h.budget) ?? h.budget} $U`,
      source: "chain",
      proof: h.tx ? bsc(h.tx) : undefined,
    });
  }

  const sessions = await listSessions().catch(() => []);
  for (const s of sessions) {
    if (s.revokedAt) {
      out.push({
        id: `rev:${s.id}`,
        kind: "revoked",
        at: s.revokedAt,
        ...revokedWords(s.label),
        note: s.revokedBecause ?? undefined,
        source: "session store",
        proof: s.revokeTx ? bsc(s.revokeTx) : undefined,
      });
    }
    if (s.grantedAt) {
      out.push({
        id: `grant:${s.id}:${s.grantedAt}`,
        kind: "granted",
        at: s.grantedAt,
        actor: s.label,
        what: "was granted a scoped session",
        figure: `${(s.allowlist ?? []).length} call${(s.allowlist ?? []).length === 1 ? "" : "s"}`,
        source: "session store",
        proof: s.registrationTx ? bsc(s.registrationTx) : undefined,
      });
    }
  }

  for (const a of index.agents) {
    if (!a.createdAt || !a.category) continue;
    out.push({
      id: `listed:${a.tokenId}`,
      kind: "listed",
      at: a.createdAt,
      actor: a.name?.trim() || `Agent ${a.tokenId}`,
      tokenId: a.tokenId,
      category: a.category as Category,
      what: "registered",
      source: "registry",
    });
  }

  const events = out
    .filter((e) => Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) >= since && Date.parse(e.at) <= Date.now() + 60_000)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);

  return { events, sources: { probe: probes.at ?? null } };
}
