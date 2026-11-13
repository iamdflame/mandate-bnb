import "@/styles/trust.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import PageHead from "@/components/k/PageHead";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { live } from "@/lib/data/live";
import { findAgent } from "@/lib/data/agents";
import { recentJobs } from "@/lib/escrow/jobs";
import { ESCROW } from "@/lib/escrow/contracts";
import { referenceRegistrations } from "@/lib/house";
import { listingFor } from "@/lib/market/listing";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { byWeek } from "@/lib/market/weekly";
import { bscscanTx } from "@/lib/demo";
import { isTeam, teamWallets } from "@/lib/team";

export const metadata: Metadata = {
  title: "The record | MANDATE",
  description: "Every escrowed job opened on Mandate: who paid, which agent, what happened, each with its transaction. Wallets we operate are listed and never counted.",
};

export const revalidate = 300;
export const maxDuration = 60;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const STATE: Record<string, string> = { FUNDED: "Paid, not yet delivered", SUBMITTED: "Delivered", COMPLETED: "Settled", REJECTED: "Refunded", EXPIRED: "Refunded" };
const done = (s: string) => s === "SUBMITTED" || s === "COMPLETED";

/**
 * The outside-hire ledger: every escrowed job opened here, read from our books
 * of what the chain recorded, split by who paid. Buyers' jobs make every
 * figure; jobs from wallets we operate (tests, probes, the trial pool) are
 * shown apart and in none of them, and the wallets themselves are listed, so
 * a judge can check the split without reading our code.
 */
export default async function RecordPage() {
  await live();
  const [jobs, calls] = await Promise.all([recentJobs(500).catch(() => []), listPaidCalls().catch(() => [])]);
  const ours = new Set(Object.values(referenceRegistrations()).map((r) => String(r.tokenId)));
  const theirs = jobs.filter((j) => !isTeam(j.client));
  const own = jobs.filter((j) => isTeam(j.client));
  const theirCalls = calls.filter((c) => c.paid && !c.sponsored && !isTeam(c.payer));
  const buyers = new Set([...theirs.map((j) => j.client.toLowerCase()), ...theirCalls.map((c) => c.payer.toLowerCase())]);
  const independent = theirs.filter((j) => !ours.has(j.tokenId));
  const name = (id: string) => listingFor(id)?.name ?? findAgent(id)?.name ?? `Agent #${id}`;
  const job = (id: string) => (listingFor(id)?.category ?? findAgent(id)?.category ?? null) as Category | null;
  const team = Object.entries(teamWallets());
  const weeks = byWeek(jobs.map((j) => ({ client: j.client, status: j.status, at: j.createdAt }))).slice(0, 8);
  // Who the buyers are, busiest first: one wallet's daily check is most of one agent's record, and is said so here rather than found.
  const groups = new Map<string, typeof theirs>();
  for (const j of theirs) groups.set(j.client.toLowerCase(), [...(groups.get(j.client.toLowerCase()) ?? []), j]);
  const byBuyer = [...groups.entries()]
    .map(([w, js]) => ({ w, n: js.length, agents: [...new Set(js.map((j) => name(j.tokenId)))], first: js[js.length - 1]!.createdAt, last: js[0]!.createdAt }))
    .sort((a, b) => b.n - a.n);

  return (
    <AppShell>
      <PageHead
        title="The record"
        lede="Every escrowed job opened on Mandate: who paid, which agent, and what happened, each with its transaction. Wallets we operate are listed below and never counted."
        agent={{ job: "health-factor", seed: "344123", state: "ready", house: true }}
        source="From our books of what BNB Smart Chain recorded, refreshed every five minutes. Each row links to its transaction."
      />
      <div className="k-wrap tr-rec">
        <section aria-labelledby="h-rec-figs">
          <h2 id="h-rec-figs" className="k-h2">
            Paid by buyers
          </h2>
          <div className="k-figs">
            <p className="k-fig">
              <span className="k-fig__n k-num">{buyers.size}</span>
              <span className="k-fig__l">buyers, none of them ours</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{theirs.length}</span>
              <span className="k-fig__l">escrowed jobs</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{theirs.filter((j) => done(j.status)).length}</span>
              <span className="k-fig__l">delivered on chain</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{independent.length}</span>
              <span className="k-fig__l">for other builders&apos; agents</span>
            </p>
          </div>
          <p className="k-src">
            Not in these figures: {own.length} jobs and {calls.filter((c) => c.paid && (c.sponsored || isTeam(c.payer))).length} paid calls from wallets we operate, our own tests of agents. Paid calls by buyers: {theirCalls.length}.
          </p>
        </section>

        <section aria-labelledby="h-rec-buyers">
          <h2 id="h-rec-buyers" className="k-h2">
            By buyer
          </h2>
          <p className="k-body">
            {byBuyer[0] && byBuyer[0].n * 3 >= theirs.length
              ? `One buyer paid for ${byBuyer[0].n} of the ${theirs.length}: the same check, most days. Repeat work, and the reason the number is not ${theirs.length} different people.`
              : "Who paid, busiest first."}
          </p>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__jobs">
              <thead>
                <tr>
                  <th scope="col">Buyer</th>
                  <th scope="col">Agents hired</th>
                  <th scope="col">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {byBuyer.map((b) => (
                  <tr key={b.w}>
                    <td>
                      <a className="k-mono k-link" href={`https://bscscan.com/address/${b.w}`} target="_blank" rel="noreferrer">
                        {short(b.w)}
                      </a>
                      <span className="k-src tr-rec__sub">
                        {new Date(b.first).toUTCString().slice(5, 16)}
                        {b.n > 1 ? ` to ${new Date(b.last).toUTCString().slice(5, 16)}` : ""}
                      </span>
                    </td>
                    <td className="k-table__main">{b.agents.join(", ")}</td>
                    <td className="k-num">{b.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="h-rec-weeks">
          <h2 id="h-rec-weeks" className="k-h2">
            By week
          </h2>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__weeks">
              <thead>
                <tr>
                  <th scope="col">Week of</th>
                  <th scope="col">Buyers&apos; jobs</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Buyers</th>
                  <th scope="col">Our tests</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.week}>
                    <td className="k-table__main">{new Date(`${w.week}T00:00:00Z`).toUTCString().slice(5, 16)}</td>
                    <td className="k-num">{w.jobs}</td>
                    <td className="k-num">{w.delivered}</td>
                    <td className="k-num">{w.buyers}</td>
                    <td className="k-num">{w.ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="k-src">
            Weeks start Monday, UTC. As data, with testnet: <a href="/api/v1/proof">/api/v1/proof</a>.
          </p>
        </section>

        <section aria-labelledby="h-rec-jobs">
          <h2 id="h-rec-jobs" className="k-h2">
            Every buyer&apos;s job
          </h2>
          <p className="k-body">
            Check any of them: <span className="k-mono">getJob(id)</span> on{" "}
            <a className="k-link" href={`https://bscscan.com/address/${ESCROW.commerce}#readProxyContract`} target="_blank" rel="noreferrer">
              BNB Chain&apos;s escrow contract
            </a>{" "}
            gives its buyer, its agent and its status.
          </p>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__jobs">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Agent</th>
                  <th scope="col">Buyer</th>
                </tr>
              </thead>
              <tbody>
                {theirs.map((j) => {
                  const c = job(j.tokenId);
                  return (
                    <tr key={j.jobId}>
                      <td>
                        {j.fundedTx ? (
                          <a className="k-link k-num" href={bscscanTx(j.fundedTx)} target="_blank" rel="noreferrer">
                            #{j.jobId}
                          </a>
                        ) : (
                          <span className="k-num">#{j.jobId}</span>
                        )}
                        <span className="k-src tr-rec__sub">{new Date(j.createdAt).toUTCString().slice(5, 16)}</span>
                      </td>
                      <td className="k-table__main">
                        <Link className="k-link" href={`/agents/${j.tokenId}`}>
                          {name(j.tokenId)}
                        </Link>{" "}
                        <span className={`k-tag${ours.has(j.tokenId) ? " k-tag--ours" : ""}`}>{ours.has(j.tokenId) ? "Ours" : "Independent"}</span>
                        <span className="k-src tr-rec__sub">
                          {c ? `${CATEGORY_LABEL[c]}, ` : ""}
                          {STATE[j.status] ?? j.status}
                        </span>
                      </td>
                      <td>
                        <span className="k-mono">{short(j.client)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="h-rec-team">
          <h2 id="h-rec-team" className="k-h2">
            Wallets we operate
          </h2>
          <p className="k-body">Nothing paid from these counts above. Our own tests of agents, the trial pool that pays for them, and the owners of our four agents.</p>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__team">
              <tbody>
                {team.map(([w, what]) => (
                  <tr key={w}>
                    <td>
                      <a className="k-mono k-link" href={`https://bscscan.com/address/${w}`} target="_blank" rel="noreferrer">
                        {w}
                      </a>
                    </td>
                    <td>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="k-row">
          <Link className="k-btn k-btn--primary" href="/diagnose">
            Check a wallet <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
          </Link>
          <Link className="k-btn" href="/quest/record">
            Set and Earn, frozen at its close
          </Link>
          <Link className="k-btn" href="/adopt">
            Running Mandate
          </Link>
          <Link className="k-btn k-btn--ghost" href="/graveyard">
            What failed
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
