import "@/styles/trust.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import PageHead from "@/components/k/PageHead";
import { roles } from "@/lib/chain/marketV2";
import { MARKET_V2 } from "@/lib/chain/deployments";
import { withTimeout } from "@/lib/cache";
import { snapshot } from "@/lib/data/snapshots";
import { live } from "@/lib/data/live";
import { bscscanAddress } from "@/lib/demo";
import { ESCROW } from "@/lib/escrow/contracts";
import { outsideByWeek } from "@/lib/market/weekly";
import { CAPACITY, gasPerJob, RUNNING } from "@/lib/ops/adopt";
import type { Box } from "@/lib/ops/definition-of-done";

export const metadata: Metadata = {
  title: "Running Mandate | MANDATE",
  description: "What it takes to run Mandate: the measured cost, every key and what it can do, what we hold, what is not true yet, and how it would be handed over.",
};

export const revalidate = 900;
export const maxDuration = 60;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const REPO = "https://github.com/iamdflame/mandate-bnb";

/** Each key by the name it is configured under, and exactly what it can and cannot do. */
const KEYS: { key: string; env: string; can: string; cannot: string }[] = [
  { key: "Market owner", env: "PRIVATE_KEY", can: "Resolve a challenged settlement, set the market's parameters, pause it.", cannot: "Withdraw a buyer's capital, take an agent's bond, or touch BNB Chain's escrow." },
  { key: "Adjudicator", env: "ADJUDICATOR_KEY", can: "Propose hourly settlements on jobs with capital; publish and revoke checks.", cannot: "Move capital, finalise a settlement someone challenged, withdraw a bond." },
  { key: "Our four agents' owners", env: "HOUSE_*_KEY", can: "Deliver the escrowed jobs sold by our own four agents, and update their registrations.", cannot: "Deliver for, or be paid as, any other builder's agent." },
  { key: "Keeper and trial pool", env: "AGENT_A_KEY", can: "Settle delivered jobs after the dispute window (anyone can), and pay for our daily test purchases, inside a daily cap.", cannot: "Settle early, or redirect a payment: the escrow pays the agent the job names." },
  { key: "Leash master", env: "LEASH_MASTER_KEY", can: "Derive the session key an agent uses on a buyer's wallet, inside the cap, contracts and expiry the buyer signed.", cannot: "Anything the buyer's wallet did not grant. The buyer revokes it in one transaction, without us." },
  { key: "Session and schedule secrets", env: "SESSION_SECRET, CRON_SECRET", can: "Seal stored sessions; let the scheduler call our own jobs.", cannot: "Sign a transaction. Neither is a wallet key." },
];

/**
 * What BNB Chain, or anyone, would be taking on by running this marketplace:
 * the cost, the keys, what is held, what is not true yet and how it would be
 * handed over. Every figure is read now or carries the date it was read.
 */
export default async function AdoptPage() {
  await live(["definition"]);
  const [who, weeks, gas] = await Promise.all([withTimeout(roles().catch(() => null), 6_000), withTimeout(outsideByWeek().catch(() => null), 8_000), withTimeout(gasPerJob().catch(() => null), 12_000)]);
  const boxes = snapshot<Box[]>("definition")?.payload ?? [];
  const notYet = boxes.filter((b) => b.state !== "done");
  const main = weeks?.mainnet.slice(0, 8) ?? [];
  const test = new Map((weeks?.testnet ?? []).map((w) => [w.week, w]));

  return (
    <AppShell>
      <PageHead
        title="Running Mandate"
        lede="What you would be taking on: what it costs, every key and what it can do, what we hold, what is not true yet, and how it would be handed over."
        agent={{ job: "rebalancing", seed: "344119", state: "ready", house: true }}
        source="Chain figures are read as this page renders; bills carry the date they were read. Nothing here is typed from memory."
      />
      <div className="k-wrap tr-rec">
        <section aria-labelledby="ad-report">
          <h2 id="ad-report" className="k-h2">
            A figure you can report
          </h2>
          <p className="k-body">
            Escrowed jobs paid for by wallets we do not operate, by the week they were funded. Our own tests are in the last column and in no total. The same numbers, with the wallets we operate, at{" "}
            <a className="k-link k-mono" href="/api/v1/proof">
              /api/v1/proof
            </a>
            .
          </p>
          {weeks ? (
            <div className="k-table-wrap">
              <table className="k-table tr-rec__weeks">
                <thead>
                  <tr>
                    <th scope="col">Week of</th>
                    <th scope="col">Mainnet jobs</th>
                    <th scope="col">Delivered</th>
                    <th scope="col">Buyers</th>
                    <th scope="col">Testnet jobs</th>
                    <th scope="col">Our tests</th>
                  </tr>
                </thead>
                <tbody>
                  {main.map((w) => (
                    <tr key={w.week}>
                      <td className="k-table__main">{new Date(`${w.week}T00:00:00Z`).toUTCString().slice(5, 16)}</td>
                      <td className="k-num">{w.jobs}</td>
                      <td className="k-num">{w.delivered}</td>
                      <td className="k-num">{w.buyers}</td>
                      <td className="k-num">{test.get(w.week)?.jobs ?? 0}</td>
                      <td className="k-num">{w.ours + (test.get(w.week)?.ours ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="k-note k-note--warn">Our books could not be read just now, so no week is shown. Reload in a minute.</p>
          )}
          <p className="k-src">
            Weeks start Monday, UTC. Every job behind these numbers is listed at <Link href="/record">the record</Link>.
          </p>
        </section>

        <section aria-labelledby="ad-cost">
          <h2 id="ad-cost" className="k-h2">
            What it costs to run
          </h2>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__team">
              <tbody>
                {RUNNING.map((r) => (
                  <tr key={r.item}>
                    <td className="k-table__main">
                      {r.item}
                      <span className="k-src tr-rec__sub">{r.note}</span>
                    </td>
                    <td>
                      <span className="k-num">{r.cost ?? "not measured"}</span>
                      <span className="k-src tr-rec__sub">{r.read}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="k-h3">Network fees per job</h3>
          {gas ? (
            <div className="k-table-wrap">
              <table className="k-table tr-rec__team">
                <tbody>
                  {gas.map((g) => (
                    <tr key={g.what}>
                      <td className="k-table__main">
                        {g.what}
                        <span className="k-src tr-rec__sub">Paid by: {g.who}</span>
                      </td>
                      <td>
                        <span className="k-num">{g.gas === null ? "not measured" : `${g.gas.toLocaleString("en-GB")} gas, ${g.bnb!.toFixed(7)} BNB`}</span>
                        <span className="k-src tr-rec__sub">median of {g.n} receipts, read now</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="k-note k-note--warn">The receipts could not be read just now, so no fee is shown.</p>
          )}
          <p className="k-src">From the latest settled jobs buyers paid for. A first-time buyer also approves $U once, which is not in the first row.</p>
        </section>

        <section aria-labelledby="ad-load">
          <h2 id="ad-load" className="k-h2">
            Under load
          </h2>
          <p className="k-body">One Next.js app on Vercel, which adds servers as visitors arrive, with public pages served from its edge cache. Measured, not claimed:</p>
          {CAPACITY.map((c) => (
            <div key={c.at} className="k-table-wrap">
              <table className="k-table tr-rec__weeks">
                <thead>
                  <tr>
                    <th scope="col">Visitors at once</th>
                    <th scope="col">Requests</th>
                    <th scope="col">Per second</th>
                    <th scope="col">95% within</th>
                    <th scope="col">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {c.stages.map((s) => (
                    <tr key={s.users}>
                      <td className="k-table__main">
                        {s.users}
                        {s.ours ? null : <span className="k-src tr-rec__sub">limited by the test line</span>}
                      </td>
                      <td className="k-num">{s.requests.toLocaleString("en-GB")}</td>
                      <td className="k-num">{s.perSecond}</td>
                      <td className="k-num">{(s.p95 / 1000).toFixed(2)} s</td>
                      <td className="k-num">{s.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="k-src">
            {CAPACITY[0]!.at}, from {CAPACITY[0]!.from}. {CAPACITY[0]!.note}
          </p>
        </section>

        <section aria-labelledby="ad-keys">
          <h2 id="ad-keys" className="k-h2">
            Every key, and what it can do
          </h2>
          <div className="k-table-wrap">
            <table className="k-table tr-rec__keys">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Can</th>
                  <th scope="col">Cannot</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map((k) => (
                  <tr key={k.key}>
                    <td className="k-table__main">
                      {k.key}
                      <span className="k-src k-mono tr-rec__sub">{k.env}</span>
                    </td>
                    <td>{k.can}</td>
                    <td>{k.cannot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {who ? (
            <dl className="k-facts">
              <div>
                <dt>Owner of our market contract now</dt>
                <dd>
                  <a className="k-mono k-link" href={bscscanAddress(who.owner)} target="_blank" rel="noreferrer">
                    {short(who.owner)}
                  </a>
                  <div className="k-small">One key, not a multisig. This is the first thing to change at a handover: the transfer to a 2-of-3 Safe is scripted, and waits for three signers.</div>
                </dd>
              </div>
              <div>
                <dt>Adjudicator now</dt>
                <dd>
                  <a className="k-mono k-link" href={bscscanAddress(who.adjudicator)} target="_blank" rel="noreferrer">
                    {short(who.adjudicator)}
                  </a>
                  <div className="k-small">
                    {who.adjudicator.toLowerCase() === who.owner.toLowerCase() ? "The same key as the owner." : "A different key from the owner."} Read at block {who.block.toLocaleString("en-GB")}.
                  </div>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="k-note k-note--warn">The market contract did not answer just now, so its owner is not shown.</p>
          )}
        </section>

        <section aria-labelledby="ad-hold">
          <h2 id="ad-hold" className="k-h2">
            What we hold
          </h2>
          <dl className="k-facts">
            <div>
              <dt>Buyers&apos; money</dt>
              <dd>
                None. An escrowed job&apos;s payment sits in{" "}
                <a className="k-link" href={bscscanAddress(ESCROW.commerce)} target="_blank" rel="noreferrer">
                  BNB Chain&apos;s own escrow contract
                </a>{" "}
                until the agent delivers, and returns to the buyer if it does not. We cannot move it.
              </dd>
            </div>
            <div>
              <dt>Buyers&apos; keys</dt>
              <dd>None. A passkey wallet&apos;s key is made on the buyer&apos;s device and never reaches us.</dd>
            </div>
            <div>
              <dt>Capital in our own market contract</dt>
              <dd>
                Our four agents&apos; test books, about sixty cents each, in{" "}
                <a className="k-link" href={bscscanAddress(MARKET_V2)} target="_blank" rel="noreferrer">
                  the market contract
                </a>
                . No buyer has put capital there.
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="ad-rebuild">
          <h2 id="ad-rebuild" className="k-h2">
            Rebuilding it from zero
          </h2>
          <dl className="k-facts">
            <div>
              <dt>Re-read from the chain</dt>
              <dd>Every agent&apos;s registration, every escrowed job and its status, every payment. The scheduled jobs rebuild the index from the chain alone.</dd>
            </div>
            <div>
              <dt>Ours alone, lost without the database</dt>
              <dd>Our calls to each agent and their answers, the checks of those answers against the chain, the graveyard&apos;s transcripts, stored sessions. There is no off-site backup of these yet.</dd>
            </div>
            <div>
              <dt>To run it</dt>
              <dd>
                One Next.js app, one Postgres database, a five-minute scheduler. Setup, every environment name and what to do when a check goes red are in{" "}
                <a className="k-link" href={`${REPO}/blob/main/docs/ops.md`} target="_blank" rel="noreferrer">
                  docs/ops.md
                </a>
                .
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="ad-notyet">
          <h2 id="ad-notyet" className="k-h2">
            What is not true yet
          </h2>
          {notYet.length ? (
            <ul className="tr-rec__notyet">
              {notYet.map((b) => (
                <li key={b.id}>
                  <span className={`k-tag${b.state === "open" ? " k-tag--err" : " k-tag--warn"}`}>{b.state === "open" ? "Not done" : "Part way"}</span>
                  <p className="k-body">{b.claim}</p>
                  <p className="k-small">{b.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="k-note">
              The list is computed every five minutes and was not loaded just now. It is always at <Link href="/status">status</Link>.
            </p>
          )}
          <p className="k-src">
            Computed from what the site reads, not typed: the same list as on <Link href="/status">status</Link>.
          </p>
        </section>

        <section aria-labelledby="ad-hand">
          <h2 id="ad-hand" className="k-h2">
            Handing it over
          </h2>
          <ol className="tr-rec__steps">
            <li>The repository is public, with setup and the live address in its README.</li>
            <li>The owner of the market contract moves to a Safe you control, in one transaction we have scripted.</li>
            <li>The domain, the hosting project and the database transfer to your accounts; every secret is rotated on the way, none is handed across.</li>
            <li>Our four agents stay listed and labelled as ours, or come off, as you decide. Other builders&apos; agents are unaffected: their registrations are theirs.</li>
          </ol>
          <div className="k-row">
            <a className="k-btn" href={REPO} target="_blank" rel="noreferrer">
              The repository <ExternalLink size={14} aria-hidden="true" />
            </a>
            <Link className="k-btn" href="/record">
              The record
            </Link>
            <Link className="k-btn k-btn--ghost" href="/status">
              Status
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
