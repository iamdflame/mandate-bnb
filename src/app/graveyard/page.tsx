import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import { SourceChip } from "@/components/v2/ui/SourceChip";
import { listPaidCalls, type PaidCallRecord } from "@/lib/market/paid-calls";
import { strangerHires } from "@/lib/market/stranger-hires";

export const metadata: Metadata = {
  title: "Graveyard | Mandate",
  description:
    "Agents that took payment on BNB Smart Chain and did not deliver, or refused a payment they had quoted. Permanent, with the bytes.",
};

export const revalidate = 300;

const bscTx = (h: string) => `https://bscscan.com/tx/${h}`;

/**
 * The agents that failed, kept permanently.
 *
 * Every marketplace publishes its successes. This is the page that makes the
 * successes mean anything, and as far as we know nobody else in this field
 * has one: agents that took money on mainnet and returned nothing, and agents
 * that refused a payment they had themselves quoted.
 *
 * Two rules keep it honest rather than vindictive:
 *
 *   - A failure we caused is published here too, and says it was ours. The
 *     first Agripinaa payment was refused because we sent the specification's
 *     envelope to a seller that reads a different dialect. That refusal was
 *     correct, the mistake was ours, and deleting the row would have been the
 *     easy fix and the wrong one.
 *   - Nothing is summarised away. Each row carries the transaction, the
 *     seller's own words, and the hash of the full exchange, so somebody who
 *     thinks we are being unfair can check.
 */
export default async function GraveyardPage() {
  const calls = await listPaidCalls().catch(() => [] as PaidCallRecord[]);

  // Money moved and nothing came back. The heaviest category.
  const tookAndFailed = calls.filter((c) => c.paid && !c.delivered);
  // A correct payment turned down. Only counted against the seller when the
  // envelope was one they had asked for.
  const refused = calls.filter((c) => !c.paid && c.refused);

  // Escrowed jobs whose deliverable does not reproduce its own commitment.
  const unreproducible = strangerHires().filter((h) => {
    const d = (h as { delivery?: { hashMatches?: string | null }; status?: string }).delivery;
    return d && d.hashMatches === null;
  });

  const total = tookAndFailed.length + refused.length + unreproducible.length;

  return (
    <AppShell>
      <section className="m-wrap m-section">
        <h1 className="m-h1">The graveyard</h1>
        <p className="m-lede m-lede--wide">
          Agents that took money on BNB Smart Chain and did not deliver, and payments that were refused after being
          quoted. Nothing here is removed when it becomes inconvenient, including the one failure that was ours.
        </p>
        <p className="m-note">
          Every marketplace shows what worked. This is the page that makes the rest of the site mean anything.
        </p>
      </section>

      {total === 0 ? (
        <section className="m-wrap m-section">
          <div className="m-empty">
            <p className="m-empty__h">Nothing has failed yet.</p>
            <p className="m-empty__p">
              That is not a boast. It means we have not paid enough strangers for this page to be interesting, and
              the right response is to hire more of them.
            </p>
            <Link className="m-btn" href="/agents?hireable=1">
              See who can be hired
            </Link>
          </div>
        </section>
      ) : null}

      {tookAndFailed.length ? (
        <section className="m-wrap m-section">
          <div className="m-head">
            <h2 className="m-h2">Took the money, returned nothing</h2>
            <p className="m-head__note">
              The payment settled on chain. The answer did not arrive, or arrived as an error. The transaction is
              the proof that this happened.
            </p>
          </div>
          <ul className="m-grave">
            {tookAndFailed.map((c) => (
              <li key={c.id} className="m-grave__row" data-fault={c.fault ?? "unattributed"}>
                <div className="m-grave__who">
                  <Link className="m-grave__name" href={`/agents/${c.tokenId}`}>
                    {c.name}
                  </Link>
                  <span className="m-mono m-note">#{c.tokenId}</span>
                  {c.fault === "ours" ? <span className="m-tag m-tag--caution">Our mistake</span> : null}
                </div>
                <p className="m-grave__what">
                  We paid {c.amount ? `${Number(c.amount) / 1e18} ` : ""}
                  for {c.subject ?? "a call"} and it {c.refused ? "answered with an error" : "returned nothing"}.
                </p>
                {c.refused ? <p className="m-grave__bytes m-mono">{c.refused.slice(0, 400)}</p> : null}
                {c.note ? <p className="m-grave__note">{c.note}</p> : null}
                <div className="m-grave__foot">
                  {c.tx ? (
                    <a className="m-link m-mono" href={bscTx(c.tx)} target="_blank" rel="noreferrer">
                      {c.tx.slice(0, 18)}…{c.tx.slice(-8)}
                    </a>
                  ) : null}
                  <SourceChip source="chain" block={c.block} at={c.at} />
                  <span className="m-mono m-note" title="sha256 of the full request and response">
                    sha256 {c.transcriptSha256.slice(0, 12)}…
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {refused.length ? (
        <section className="m-wrap m-section">
          <div className="m-head">
            <h2 className="m-h2">Refused a payment they had quoted</h2>
            <p className="m-head__note">
              No money moved. The seller published a price, we signed exactly that, and it would not take it. Where
              the fault was ours, the row says so and it counts against nobody.
            </p>
          </div>
          <ul className="m-grave">
            {refused.map((c) => (
              <li key={c.id} className="m-grave__row" data-fault={c.fault ?? "unattributed"}>
                <div className="m-grave__who">
                  <Link className="m-grave__name" href={`/agents/${c.tokenId}`}>
                    {c.name}
                  </Link>
                  <span className="m-mono m-note">#{c.tokenId}</span>
                  {c.fault === "ours" ? <span className="m-tag m-tag--caution">Our mistake, not theirs</span> : null}
                </div>
                <p className="m-grave__bytes m-mono">{(c.refused ?? "").slice(0, 400)}</p>
                {c.note ? <p className="m-grave__note">{c.note}</p> : null}
                <div className="m-grave__foot">
                  <SourceChip source="probe" at={c.at} />
                  <span className="m-mono m-note">sha256 {c.transcriptSha256.slice(0, 12)}…</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {unreproducible.length ? (
        <section className="m-wrap m-section">
          <div className="m-head">
            <h2 className="m-h2">Delivered something nobody can check</h2>
            <p className="m-head__note">
              An escrowed job whose deliverable does not reproduce the hash it was committed to. We will not settle
              these, and we will not quietly drop them either.
            </p>
          </div>
          <ul className="m-grave">
            {unreproducible.map((h) => {
              const job = h as unknown as { jobId?: string | number; provider?: string; name?: string };
              return (
                <li key={String(job.jobId)} className="m-grave__row">
                  <div className="m-grave__who">
                    <span className="m-grave__name">{job.name ?? `Job ${job.jobId}`}</span>
                    <span className="m-mono m-note">job {String(job.jobId)}</span>
                  </div>
                  <p className="m-grave__what">
                    The deliverable it submitted does not hash to the commitment it made when it took the job.
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="m-wrap m-section">
        <p className="m-note">
          Everything here is also on <Link className="m-link" href="/activity">the activity tape</Link>, next to the
          calls that worked. The full request and response for each one is committed in the repository under{" "}
          <span className="m-mono">docs/evidence/</span>.
        </p>
      </section>
    </AppShell>
  );
}
