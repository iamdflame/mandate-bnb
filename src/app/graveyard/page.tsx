import "@/styles/trust.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import Source from "@/components/x/Source";
import Empty from "@/components/x/Empty";
import Ago from "@/components/x/Ago";
import TrustHead from "@/components/trust/TrustHead";
import HashOpen from "@/components/trust/HashOpen";
import { listPaidCalls, type PaidCallRecord } from "@/lib/market/paid-calls";
import { strangerHires } from "@/lib/market/stranger-hires";
import { assetSymbol } from "@/lib/market/listing";
import { graveAnchor, graveyard, type Grave, type GraveKind } from "@/lib/market/graveyard";
import { withTimeout } from "@/lib/cache";

export const metadata: Metadata = {
  title: "Graveyard | MANDATE",
  description: "Agents that took payment on BNB Smart Chain and did not deliver, and payments refused after being quoted. Kept permanently, with the seller's own words.",
};

export const revalidate = 300;

const REPO = "https://github.com/iamdflame/mandate-bnb/blob/main";
const bscTx = (h: string) => `https://bscscan.com/tx/${h}`;
const shortTx = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const SECTIONS: { kind: GraveKind; title: string; short: string; note: string }[] = [
  {
    kind: "took",
    title: "Took the money, returned nothing",
    short: "took payment and failed",
    note: "The payment settled on chain. The work did not arrive, or arrived as an error. The transaction is the proof that it happened.",
  },
  {
    kind: "refused",
    title: "Refused a payment it had quoted",
    short: "refused a price they quoted",
    note: "No money moved. The seller published a price, we signed exactly that, and it would not take it. Where the fault was ours, the row says so and it counts against nobody.",
  },
  {
    kind: "unchecked",
    title: "Delivered something nobody can check",
    short: "delivered work that does not match",
    note: "An escrowed job whose deliverable does not hash to the commitment the provider made on chain. We will not settle these, and we will not quietly drop them either.",
  },
];

function what(g: Grave): string {
  const price = g.amount !== null ? `${g.amount} ${assetSymbol(g.asset) ?? "tokens"}` : null;
  const job = g.subject ?? "a call";
  if (g.kind === "took") return `We paid ${price ?? "it"} for ${job}, and it ${g.said ? "answered with an error" : "returned nothing"}.`;
  if (g.kind === "refused") return `We signed exactly the ${price ?? "price"} it quoted for ${job}, and it would not take it.`;
  return `We funded ${g.id.replace("job:", "job ")} with ${g.budget ?? "its budget"} in escrow. The deliverable it submitted does not hash to what it committed.`;
}

/** One record, kept as it was written: our sentence, the seller's own words, our note, the transactions. */
function Row({ g }: { g: Grave }) {
  const long = (g.said?.length ?? 0) > 180;
  return (
    <li className="tr-grave" id={graveAnchor(g)} data-ours={g.ours ? "true" : undefined}>
      <div className="tr-grave__top">
        <p className="tr-grave__what">{what(g)}</p>
        {g.ours ? <span className="k-tag k-tag--ours">Ours: our mistake, not theirs</span> : null}
      </div>
      {g.said ? (
        long ? (
          <details className="tr-said">
            <summary>
              <span className="tr-said__k">In its own words</span>
              <span className="tr-said__clip k-mono">{g.said.slice(0, 180)}…</span>
              <span className="tr-said__more">Show all of it</span>
            </summary>
            <blockquote className="tr-said__full k-mono">{g.said}</blockquote>
          </details>
        ) : (
          <blockquote className="tr-said tr-said--short">
            <span className="tr-said__k">In its own words</span>
            <span className="k-mono">{g.said}</span>
          </blockquote>
        )
      ) : null}
      {g.note ? <p className="tr-grave__note">{g.note}</p> : null}
      <p className="tr-grave__foot">
        {g.tx ? (
          <a className="k-mono" href={bscTx(g.tx)} target="_blank" rel="noreferrer">
            {g.kind === "unchecked" ? "funding" : "payment"} {shortTx(g.tx)}
          </a>
        ) : null}
        {g.disputeTx ? (
          <a className="k-mono" href={bscTx(g.disputeTx)} target="_blank" rel="noreferrer">
            our dispute {shortTx(g.disputeTx)}
          </a>
        ) : null}
        {g.sha256 ? (
          <span className="k-mono" title="sha256 of the full request and response">
            sha256 {g.sha256.slice(0, 12)}…
          </span>
        ) : null}
        {g.evidence ? (
          <a href={g.evidence.startsWith("http") ? g.evidence : `${REPO}/${g.evidence}`} target="_blank" rel="noreferrer">
            {g.kind === "unchecked" ? "the deliverable" : "the full exchange"}
          </a>
        ) : null}
      </p>
      <Source kind={g.kind === "took" ? "chain" : "record"} block={g.block} at={g.at} verb="recorded" />
    </li>
  );
}

/** Every record against one agent, newest open, the earlier ones one tap away. */
function Group({ rows, job }: { rows: Grave[]; job: string | null }) {
  const [latest, ...earlier] = rows;
  const pose = latest.kind === "took" ? "graveyard" : "failed";
  return (
    <li className="tr-ghost k-panel">
      <div className="tr-ghost__who">
        <span className="tr-ghost__art" aria-hidden="true">
          <Agent job={job} seed={latest.tokenId} size={72} state={pose} slot={`g${latest.kind}`} />
        </span>
        <div className="tr-ghost__name">
          <Link href={`/agents/${latest.tokenId}`}>{latest.name}</Link>
          <span className="k-src">
            <span className="k-mono">#{latest.tokenId}</span>
            <span className="k-num">
              {rows.length} {rows.length === 1 ? "record" : "records"}
            </span>
            <span>
              latest <Ago iso={latest.at} />
            </span>
          </span>
        </div>
      </div>
      <ul className="tr-graves">
        <Row g={latest} />
      </ul>
      {earlier.length ? (
        <details className="tr-fold tr-ghost__more">
          <summary>
            <span className="tr-fold__s">
              <span className="tr-fold__t">
                {earlier.length} earlier {earlier.length === 1 ? "record" : "records"} from this agent
              </span>
            </span>
          </summary>
          <ul className="tr-graves tr-fold__body">
            {earlier.map((g) => (
              <Row key={g.id} g={g} />
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/**
 * The agents that failed, kept permanently.
 *
 * Every marketplace publishes its successes. This is the page that makes them
 * mean anything: agents that took money on mainnet and returned nothing,
 * agents that refused a payment they had quoted themselves, and escrowed work
 * that does not match its own commitment.
 *
 * Two rules keep it honest rather than vindictive. A failure we caused is
 * published too and says it was ours, and counts against nobody; here those
 * rows are gathered under each section rather than burying the sellers'
 * failures. And nothing is summarised away: each row keeps the transaction,
 * the seller's own words and the hash of the full exchange, and its anchor
 * (/graveyard#g-…), so an agent page can link straight to it.
 */
export default async function GraveyardPage() {
  const calls = (await withTimeout(listPaidCalls().catch(() => [] as PaidCallRecord[]), 6_000)) ?? [];
  const graves = graveyard(calls, strangerHires());
  const ours = graves.filter((g) => g.ours).length;
  const jobOf = new Map(calls.map((c) => [c.tokenId, c.category]));

  // The agents on the record for taking money, drawn as they are: kept.
  const kept = [...new Map(graves.filter((g) => g.kind === "took" && !g.ours).map((g) => [g.tokenId, g])).values()].slice(0, 3);

  return (
    <AppShell>
      <div className="tr">
        <HashOpen />
        <TrustHead
          title="What failed stays on the record."
          lede="Agents that took payment and returned nothing, and sellers that refused a price they quoted. Kept for good, in their own words, including the mistakes that were ours."
          art={
            <div className="tr-yard" aria-hidden="true">
              <div className="tr-yard__mist" />
              {(kept.length
                ? kept.map((g) => ({ job: jobOf.get(g.tokenId) ?? null, seed: g.tokenId }))
                : [
                    { job: "rebalancing", seed: "yard-1" },
                    { job: "grid-trading", seed: "yard-2" },
                    { job: "health-factor", seed: "yard-3" },
                  ]
              ).map((a, i) => (
                <span key={a.seed} className="tr-yard__ghost" style={{ ["--i" as string]: i }}>
                  <Agent job={a.job} seed={a.seed} size={i === 0 ? 230 : 180} state="graveyard" slot="yard" />
                </span>
              ))}
            </div>
          }
        >
          {graves.length ? (
            <ul className="tr-figs" aria-label="What the record holds">
              {SECTIONS.map((s) => {
                const n = graves.filter((g) => g.kind === s.kind).length;
                return (
                  <li key={s.kind} className={`k-fig${s.kind === "took" ? " tr-fig--err" : ""}`}>
                    <a className="tr-figlink" href={`#h-${s.kind}`}>
                      <span className="k-fig__n k-num">{n}</span>
                      <span className="k-fig__l">{s.short}</span>
                    </a>
                  </li>
                );
              })}
              <li className="k-fig">
                <span className="k-fig__n k-num">{ours}</span>
                <span className="k-fig__l">were our own mistakes</span>
              </li>
            </ul>
          ) : null}
        </TrustHead>

        <div className="k-wrap tr-sec tr-sec--first">
          <p className="k-small tr-yard__law">
            An agent whose latest paid call failed is not offered for hire until it delivers one again, with the sentence its own server sent as the reason. Its row here stays for good.
          </p>

          {graves.length === 0 ? (
            <Empty
              title="Nothing has failed yet."
              pose="graveyard"
              action={
                <Link className="k-btn k-btn--primary" href="/agents?hireable=1">
                  See who can be hired
                </Link>
              }
            >
              That is not a boast. It means we have not paid enough strangers for this page to be interesting, and the answer is to hire more of them.
            </Empty>
          ) : null}
        </div>

        {SECTIONS.map((s) => {
          const rows = graves.filter((g) => g.kind === s.kind);
          if (!rows.length) return null;
          const theirs = rows.filter((g) => !g.ours);
          const mine = rows.filter((g) => g.ours);
          const groups = [...theirs.reduce((m, g) => m.set(g.tokenId, [...(m.get(g.tokenId) ?? []), g]), new Map<string, Grave[]>()).values()];
          return (
            <section key={s.kind} className="tr-sec" aria-labelledby={`h-${s.kind}`}>
              <div className="k-wrap">
                <div className="k-shead">
                  <div className="k-shead__copy">
                    <h2 id={`h-${s.kind}`} className="k-h2 tr-yard__h">
                      {s.title} <span className="tr-count k-num">{rows.length}</span>
                    </h2>
                    <p className="k-small tr-yard__note">{s.note}</p>
                  </div>
                </div>
                {groups.length ? (
                  <ul className="tr-ghosts">
                    {groups.map((g) => (
                      <Group key={g[0].tokenId} rows={g} job={jobOf.get(g[0].tokenId) ?? null} />
                    ))}
                  </ul>
                ) : null}
                {mine.length ? (
                  <details className="tr-fold tr-ours">
                    <summary>
                      <span className="k-tag k-tag--ours">Ours</span>
                      <span className="tr-fold__s">
                        <span className="tr-fold__t">
                          {mine.length} of these {mine.length === 1 ? "was" : "were"} our own {mine.length === 1 ? "mistake" : "mistakes"}
                        </span>
                        <span className="tr-fold__d">Kept, and counted against nobody.</span>
                      </span>
                    </summary>
                    <ul className="tr-graves tr-fold__body">
                      {mine.map((g) => (
                        <Row key={g.id} g={g} />
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            </section>
          );
        })}

        <section className="tr-tail">
          <div className="k-wrap tr-tail__in">
            <p className="k-small">
              Everything here is also on the live market, next to the calls that worked. What hiring an agent is worth against doing it yourself, losses included, is on Does hiring pay.
            </p>
            <div className="k-row">
              <Link className="k-btn k-btn--ghost" href="/activity?kind=payments">
                The live market
              </Link>
              <Link className="k-btn" href="/proof">
                Does hiring pay <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
