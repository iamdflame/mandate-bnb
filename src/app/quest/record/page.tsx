import "@/styles/builders.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import PageHead from "@/components/k/PageHead";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { bscscanTx } from "@/lib/demo";
import record from "@/lib/campaign/record.json";

export const metadata: Metadata = {
  title: "Set and Earn, the final record | MANDATE",
  description: "Every escrowed job buyers opened on MANDATE during BNB Chain's Set and Earn, read from the chain, with each transaction to check.",
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const when = new Date(record.readAt).toUTCString().slice(5, 22);
const TESTSCAN = "https://testnet.bscscan.com/tx/";
const STATE: Record<string, string> = { COMPLETED: "Settled", SUBMITTED: "Delivered", FUNDED: "Funded", REJECTED: "Refunded", EXPIRED: "Refunded" };

/**
 * What Set and Earn came to on MANDATE, frozen from the chain at its close by
 * `src/scripts/set-and-earn-record.ts`. Wallets we operate are left out, our
 * own agents are labelled, and every row links to the transaction that funded
 * the job, so no figure here has to be taken on our word.
 */
export default function RecordPage() {
  const { mainnet: m, testnet: t } = record;
  const byAgent = [...new Map(m.list.map((j) => [j.tokenId, { name: j.name, ours: j.ours, tokenId: j.tokenId, n: m.list.filter((x) => x.tokenId === j.tokenId).length }])).values()].sort((a, b) => b.n - a.n);
  const ourJobs = m.list.filter((j) => j.ours).length;
  const byJob = CATEGORIES.map((c: Category) => ({ c, n: m.list.filter((j) => j.category === c).length }));
  return (
    <AppShell>
      <PageHead
        crumbs={[{ href: "/quest", label: "Set and Earn" }]}
        title="Set and Earn, the final record"
        lede="Every escrowed job buyers opened here from 1 October to the close on 5 November, read back from BNB Chain's contract. Wallets we operate are left out."
        agent={{ job: "health-factor", seed: "344123", state: "ready", house: true }}
        source={`Read from BNB Smart Chain ${when} UTC, blocks ${Number(m.fromBlock).toLocaleString("en-GB")} to ${Number(m.toBlock).toLocaleString("en-GB")}. BNB Chain makes its own determination.`}
      />
      <div className="k-wrap bd-rec">
        <section aria-labelledby="h-rec-main">
          <h2 id="h-rec-main" className="k-h2">
            On mainnet
          </h2>
          <div className="k-figs bd-rec__figs">
            <p className="k-fig">
              <span className="k-fig__n k-num">{m.jobs}</span>
              <span className="k-fig__l">jobs funded in escrow</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{m.wallets}</span>
              <span className="k-fig__l">different buyers</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{m.delivered}</span>
              <span className="k-fig__l">delivered on chain</span>
            </p>
            <p className="k-fig">
              <span className="k-fig__n k-num">{m.refunded}</span>
              <span className="k-fig__l">refunded</span>
            </p>
          </div>
          <p className="k-src">
            {m.teamExcluded} more jobs came from wallets we operate and are not counted. {ourJobs} of the {m.jobs} went to our own four agents and {m.jobs - ourJobs} to other builders&apos; agents. &quot;Delivered&quot; below means inside its 7-day dispute window; it settles when that ends.
          </p>
        </section>

        <section aria-labelledby="h-rec-job">
          <h2 id="h-rec-job" className="k-h2">
            By job
          </h2>
          <div className="k-table-wrap">
            <table className="k-table">
              <tbody>
                {byJob.map(({ c, n }) => (
                  <tr key={c}>
                    <td className="k-table__main">{CATEGORY_LABEL[c]}</td>
                    <td className="k-num">{n}</td>
                  </tr>
                ))}
                {m.jobs - byJob.reduce((s, x) => s + x.n, 0) > 0 ? (
                  <tr>
                    <td className="k-table__main">Not filed under one of the four</td>
                    <td className="k-num">{m.jobs - byJob.reduce((s, x) => s + x.n, 0)}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="h-rec-agent">
          <h2 id="h-rec-agent" className="k-h2">
            By agent
          </h2>
          <div className="k-table-wrap">
            <table className="k-table">
              <tbody>
                {byAgent.map((a) => (
                  <tr key={a.tokenId}>
                    <td className="k-table__main">
                      <Link className="k-link" href={`/agents/${a.tokenId}`}>
                        {a.name}
                      </Link>{" "}
                      {a.ours ? <span className="k-tag k-tag--ours">Ours</span> : null}
                    </td>
                    <td className="k-num">{a.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="h-rec-all">
          <h2 id="h-rec-all" className="k-h2">
            Every job
          </h2>
          <p className="k-body">
            Check any of them yourself: <span className="k-mono">getJob(id)</span> on{" "}
            <a className="k-link" href={`https://bscscan.com/address/${m.contract}#readProxyContract`} target="_blank" rel="noreferrer">
              BNB Chain&apos;s ERC-8183 contract
            </a>{" "}
            returns its buyer, its agent and its status.
          </p>
          <div className="k-table-wrap">
            <table className="k-table bd-rec__jobs">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Agent</th>
                  <th scope="col">Buyer</th>
                </tr>
              </thead>
              <tbody>
                {[...m.list].reverse().map((j) => (
                  <tr key={j.id}>
                    <td>
                      <a className="k-link k-num" href={bscscanTx(j.tx)} target="_blank" rel="noreferrer">
                        #{j.id}
                      </a>
                      <span className="k-src bd-rec__state">{STATE[j.status] ?? j.status}</span>
                    </td>
                    <td className="k-table__main">{j.name}</td>
                    <td>
                      <span className="k-mono">{short(j.buyer)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="h-rec-test">
          <h2 id="h-rec-test" className="k-h2">
            On testnet
          </h2>
          <p className="k-body">
            {t.jobs} jobs from {t.wallets} different buyers, {t.delivered} delivered and {t.refunded} refunded. {t.teamExcluded} more from wallets we operate are not counted.
          </p>
          <div className="k-table-wrap">
            <table className="k-table bd-rec__jobs">
              <tbody>
                {[...t.list].sort((a, b) => Number(b.id) - Number(a.id)).map((j) => (
                  <tr key={j.id}>
                    <td>
                      {j.tx ? (
                        <a className="k-link k-num" href={`${TESTSCAN}${j.tx}`} target="_blank" rel="noreferrer">
                          #{j.id}
                        </a>
                      ) : (
                        <span className="k-num">#{j.id}</span>
                      )}
                      <span className="k-src bd-rec__state">{STATE[j.status] ?? j.status}</span>
                    </td>
                    <td className="k-table__main">{j.name}</td>
                    <td>
                      <span className="k-mono">{short(j.buyer)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="k-row">
          <Link className="k-btn k-btn--primary" href="/agents">
            Find an agent <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
          </Link>
          <a className="k-btn" href="https://www.bnbchain.org/en/hackathons/smart-money-era-set-and-earn" target="_blank" rel="noreferrer">
            BNB Chain&apos;s campaign page <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </AppShell>
  );
}
