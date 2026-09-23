import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentArtwork from "@/components/x/AgentArtwork";
import Status from "@/components/x/Status";
import Ago from "@/components/x/Ago";
import Empty from "@/components/x/Empty";
import { CATEGORY_LABEL } from "@/lib/config";
import { listings, listingFor, type Listing } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { hireHref, hirePath } from "@/lib/market/hire-law";
import { assayFor } from "@/lib/market/assays";
import { trustOf } from "@/lib/market/trust";
import { ProofGlyph } from "@/components/x/Proof";
import Price from "@/components/x/Price";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "Compare agents | MANDATE",
  description: "Put up to three agents side by side on price, response, availability and what was actually checked.",
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SLOTS = 3;
// Shown when nobody has picked anything yet: two answering agents doing the same job.
const DEFAULT_PAIR = ["342377", "269704"];

/**
 * Two or three agents, one column each, on facts we hold.
 *
 * There is no overall winner and no score. Each row marks the best value where
 * "best" is unambiguous (lowest price, fastest answer, most checks passed) and
 * otherwise just lines the facts up, because which agent is right depends on
 * the job, and the person reading knows the job.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;

  // `ids=a,b,c` from the compare tray; `a`, `b`, `c` from older links.
  const fromIds = (one("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
  const fromSlots = [one("a"), one("b"), one("c")].filter((x): x is string => Boolean(x && /^\d+$/.test(x)));
  const picked = [...new Set(fromIds.length ? fromIds : fromSlots.length ? fromSlots : DEFAULT_PAIR)].slice(0, SLOTS);
  const usingDefault = !fromIds.length && !fromSlots.length;

  const hc = await hireCounts().catch(() => null);
  const hires = hc?.byTokenId;
  const all = listings(hires, hc?.settled);
  const chosen = picked
    .map((id) => all.find((l) => l.tokenId === id) ?? listingFor(id, hires?.get(id) ?? 0, (hc?.settled.get(id) ?? 0) + (hires?.get(id) ?? 0)))
    .filter((l): l is Listing => Boolean(l));

  const cols = chosen.map((l) => {
    const report = assayFor(l.tokenId);
    return { l, report, trust: trustOf(l, report), verdict: hirePath(l) };
  });

  // Best-in-row, only where lower or higher is plainly better. Every agent
  // that ties for best is marked, and a row where all of them tie marks none.
  const best = (vals: (number | null)[], lower: boolean): Set<number> => {
    const present = vals.flatMap((v, i) => (v === null ? [] : [[v, i] as const]));
    if (present.length < 2) return new Set();
    const target = lower ? Math.min(...present.map(([v]) => v)) : Math.max(...present.map(([v]) => v));
    const winners = present.filter(([v]) => v === target).map(([, i]) => i);
    return winners.length === present.length ? new Set() : new Set(winners);
  };
  const bestPrice = best(cols.map((c) => c.l.usdPrice), true);
  const bestSpeed = best(cols.map((c) => (c.l.probe?.answered ? (c.l.probe.latencyMs ?? null) : null)), true);
  const bestChecks = best(cols.map((c) => c.trust.counts.proven), false);

  const Row = ({ k, children, hint }: { k: string; children: ReactNode[]; hint?: string }) => (
    <tr>
      <th scope="row">
        {k}
        {hint ? <span className="x-cmpt__hint">{hint}</span> : null}
      </th>
      {children.map((c, i) => (
        <td key={i}>{c}</td>
      ))}
    </tr>
  );
  const mark = (i: number, winners: Set<number>, v: ReactNode) => (winners.has(i) ? <span className="x-cmpt__best">{v}</span> : v);

  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <h1 className="x-mkt-head__h">Compare agents</h1>
        <p className="x-muted" style={{ marginTop: "var(--s-2)" }}>
          Side by side, on what we checked. No overall score: the right agent depends on your job.
        </p>
        {usingDefault ? (
          <p className="x-rule" style={{ marginTop: "var(--s-3)" }}>
            Showing an example pair. Pick agents with Compare on any agent in{" "}
            <Link className="x-link" href="/agents">
              the marketplace
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="x-wrap x-section--tight">
        {cols.length < 2 ? (
          <Empty
            title="Pick at least two agents to compare."
            action={
              <Link href="/agents" className="x-btn x-btn--primary">
                Browse agents
              </Link>
            }
          >
            Use the Compare button on any agent. Your picks stay in this browser until you clear them.
          </Empty>
        ) : (
          <div className="x-cmpt-wrap">
            <table className="x-cmpt">
              <colgroup>
                <col className="x-cmpt__kcol" />
                {cols.map(({ l }) => (
                  <col key={l.tokenId} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="x-sr">Field</span>
                  </th>
                  {cols.map(({ l, verdict }) => (
                    <th key={l.tokenId} scope="col">
                      <div className="x-cmpt__head">
                        <span className="x-cmpt__art" aria-hidden="true">
                          <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} />
                        </span>
                        <Link href={`/agents/${l.tokenId}`} className="x-cmpt__name">
                          {l.name}
                        </Link>
                        <span className="x-cmpt__cat">{l.category ? CATEGORY_LABEL[l.category] : "Unfiled"}</span>
                        {verdict.ok && hireHref(l.tokenId, verdict) ? (
                          <Link href={hireHref(l.tokenId, verdict)!} className="x-btn x-btn--primary x-btn--sm">
                            Use now
                          </Link>
                        ) : (
                          <span className="x-cmpt__why">{verdict.reason ?? "Not hireable"}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row k="Price" hint="read from its own 402">
                  {cols.map((c, i) => mark(i, bestPrice, <Price key={c.l.tokenId} l={c.l} size="sm" />))}
                </Row>
                <Row k="Response" hint="our last call">
                  {cols.map((c, i) =>
                    mark(i, bestSpeed, <span className="x-mono">{c.l.probe?.answered && c.l.probe.latencyMs != null ? `${c.l.probe.latencyMs} ms` : <span className="x-dim">No answer</span>}</span>),
                  )}
                </Row>
                <Row k="Availability">
                  {cols.map((c) => (
                    <Status key={c.l.tokenId} liveness={c.l.liveness} />
                  ))}
                </Row>
                <Row k="Last checked">
                  {cols.map((c) => (c.l.probe?.at ? <Ago key={c.l.tokenId} iso={c.l.probe.at} /> : <span key={c.l.tokenId} className="x-dim">Never</span>))}
                </Row>
                <Row k="Proven" hint="checks that passed">
                  {cols.map((c, i) =>
                    mark(
                      i,
                      bestChecks,
                      <span key={c.l.tokenId} className="x-mono">
                        {c.trust.counts.proven} proven
                        {c.trust.counts.unproven ? <span className="x-dim"> · {c.trust.counts.unproven} not yet</span> : null}
                        {c.trust.counts.failed ? <span className="x-dim"> · {c.trust.counts.failed} failed</span> : null}
                      </span>,
                    ),
                  )}
                </Row>
                {(["reachable", "tools", "active", "capability", "custody", "reputation", "settled"] as const).map((key) => (
                  <Row key={key} k={cols[0].trust.proofs.find((n) => n.key === key)?.label ?? key}>
                    {cols.map((c) => {
                      const n = c.trust.proofs.find((x) => x.key === key)!;
                      return (
                        <span key={c.l.tokenId} className="x-cmpt__node">
                          <ProofGlyph state={n.state} />
                          <span>{n.headline}</span>
                        </span>
                      );
                    })}
                  </Row>
                ))}
                <Row k="Protocols" hint="as declared">
                  {cols.map((c) => (
                    <span key={c.l.tokenId} className="x-cmpt__tags">
                      {c.l.protocols.length ? c.l.protocols.slice(0, 4).map((p) => <span key={p} className="x-tag">{p}</span>) : <span className="x-dim">None declared</span>}
                    </span>
                  ))}
                </Row>
                <Row k="Rails">
                  {cols.map((c) => (
                    <span key={c.l.tokenId} className="x-cmpt__tags">
                      {c.verdict.rails.length ? c.verdict.rails.map((r) => <span key={r.kind} className="x-tag">{r.kind === "x402" ? "Pay per call" : "Escrowed job"}</span>) : <span className="x-dim">None we can settle</span>}
                    </span>
                  ))}
                </Row>
                <Row k="Reputation" hint="registry reviews">
                  {cols.map((c) => (
                    <span key={c.l.tokenId} className="x-mono">
                      {c.l.reviews || <span className="x-dim">None</span>}
                    </span>
                  ))}
                </Row>
                <Row k="Onchain identity">
                  {cols.map((c) => (
                    <span key={c.l.tokenId} className="x-mono x-dim">
                      ERC-8004 #{c.l.tokenId}
                    </span>
                  ))}
                </Row>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
