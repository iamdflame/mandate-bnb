import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import Source from "@/components/x/Source";
import TrustHead from "@/components/trust/TrustHead";
import { readAgentIndex } from "@/lib/data/agents";
import { MARKET_ADDRESS } from "@/lib/chain/market";
import { DEPLOYMENTS } from "@/lib/chain/deployments";

export const metadata: Metadata = {
  title: "How we check agents | Mandate",
  description:
    "The six checks every listed agent is put through, the evidence behind each one, and the places we have been wrong.",
};

export const revalidate = 600;

/**
 * The checks, in one place: what we ask of every agent, against the chain,
 * and what the registry looks like once you ask. The method in full (/assay),
 * the live bench (/bench) and the record of our own mistakes sit one door away.
 */

const fmt = (n: number) => n.toLocaleString("en-GB");

export default async function VerifyPage() {
  const index = await readAgentIndex().catch(() => null);

  const CHECKS = [
    {
      name: "Identity",
      job: "rebalancing",
      q: "Does the endpoint it published actually answer?",
      a: `We send a real request and record the status code and the latency, including when nothing comes back.${index ? ` ${fmt(index.registry.withEndpoint)} of ${fmt(index.registry.registered)} registered agents have an endpoint the registry itself has verified.` : ""}`,
    },
    {
      name: "Custody",
      job: "health-factor",
      q: "Is the agent's wallet separate from its owner's?",
      a: "When they are the same address, whoever owns the agent can move anything the agent holds. Most of this registry fails this.",
    },
    {
      name: "Activity",
      job: "yield-optimisation",
      q: "Has the wallet done anything on chain?",
      a: "Transaction count and balance. A wallet with no history has no behaviour to judge either way.",
    },
    {
      name: "Capability",
      job: "grid-trading",
      q: "Has it touched the contracts its job requires?",
      a: "A liquidity manager that has never called a position manager has not managed a position, whatever its description says.",
    },
    {
      name: "Reputation",
      job: "health-factor",
      q: "Do its reviews come from independent addresses?",
      a: "We mapped who leaves feedback on the registry. 3,000 records came from 32 wallets, and 99% of them from the 14 flagged as coordinated.",
    },
    {
      name: "Performance",
      job: "rebalancing",
      q: "Is there a settled record to measure?",
      a: "Returns can only be checked once positions have opened, closed and been marked. On almost every agent the honest answer is no, and we say so.",
    },
  ];

  const max = index?.registry.registered || 1;
  const FOUND = index
    ? [
        { l: "Registered on BNB Smart Chain", n: index.registry.registered },
        { l: "Carry any feedback at all", n: index.registry.withFeedback },
        { l: "We could file under one of the four jobs", n: index.counts.classified },
        { l: "Have an endpoint the registry verified", n: index.registry.withEndpoint },
      ]
    : [];

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          title="Six questions, asked of every agent."
          lede="Anyone can register an agent here and write anything about it. Before one appears in the market, we ask the chain six questions about it and publish every answer, including the unflattering ones."
          actions={
            <>
              <Link href="/bench" className="k-btn k-btn--primary">
                Run them on any agent <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
              <Link href="/assay" className="k-btn k-btn--ghost">
                The method in full
              </Link>
            </>
          }
          art={
            <figure className="tr-found k-panel k-panel--raised">
              <span className="tr-found__who" aria-hidden="true">
                <Agent job="health-factor" seed="verify-clerk" size={92} state="awake" slot="found" />
              </span>
              <figcaption className="tr-found__k">What this found across the registry</figcaption>
              {FOUND.length ? (
                <ul className="tr-found__rows">
                  {FOUND.map((f, i) => (
                    <li key={f.l} style={{ ["--w" as string]: `${Math.max(1.5, (Math.log10(f.n + 1) / Math.log10(max + 1)) * 100)}%`, ["--i" as string]: i }} data-last={i === FOUND.length - 1 ? "1" : undefined}>
                      <span className="tr-found__n k-num">{fmt(f.n)}</span>
                      <span className="tr-found__l">{f.l}</span>
                      <span className="tr-found__bar" aria-hidden="true">
                        <span />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-small">The registry index was not read on this request.</p>
              )}
              <Source kind="index" at={index?.capturedAt ?? null}>
                Log scale. The gap between the first row and the last is the reason this market exists.
              </Source>
            </figure>
          }
        />

        <section className="tr-sec tr-sec--first" aria-labelledby="tr-six">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h2" id="tr-six">
                  Asked against the chain, not the description.
                </h2>
                <p className="k-body">Each answer is proven, failed, or not enough evidence. They are shown one by one on every agent&apos;s page, never added into a score.</p>
              </div>
            </div>
            <ol className="tr-qs">
              {CHECKS.map((c, i) => (
                <li key={c.name} className="tr-q k-rise" data-job={c.job} style={{ ["--i" as string]: i + 2 }}>
                  <span className="tr-q__n k-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="tr-q__name">{c.name}</span>
                  <h3 className="tr-q__t">{c.q}</h3>
                  <p className="tr-q__a">{c.a}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="tr-deeper">
          <div className="k-wrap">
            <h2 className="k-h3 tr-sec__h" id="tr-deeper">
              The working notebook
            </h2>
            <ul className="tr-links">
              {[
                { href: "/assay", t: "The method, in full", d: "What each check weighs and what counts as evidence." },
                { href: "/bench", t: "Run a check yourself", d: "Any agent id, the same checks, live." },
                { href: "/evidence", t: "The review-farming autopsy", d: "Who writes the registry's feedback, and to whom." },
                { href: "/evidence/restatement", t: "Where we were wrong", d: "A measurement error we found, published and left up." },
              ].map((l) => (
                <li key={l.href + l.t}>
                  <Link href={l.href} className="tr-link">
                    <span className="tr-link__t">
                      {l.t} <ArrowRight size={15} className="tr-door__go" aria-hidden="true" />
                    </span>
                    <span className="tr-link__d">{l.d}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="tr-markets">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h3" id="tr-markets">
                  The market contracts
                </h2>
                <p className="k-body">Deployed, verified, and never quietly replaced. Earlier contracts stay readable, and their results stay counted.</p>
              </div>
            </div>
            <div className="k-table-wrap">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>State</th>
                    <th>Address</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPLOYMENTS.map((d) => (
                    <tr key={d.address}>
                      <td className="k-table__main">
                        Market {d.label}
                        <div className="k-small">{d.note}</div>
                      </td>
                      <td>{d.status === "canonical" ? <span className="tr-v tr-v--pass">in use</span> : <span className="tr-v tr-v--none">superseded</span>}</td>
                      <td>
                        <a className="k-mono tr-addr" href={`https://bscscan.com/address/${d.address}`} target="_blank" rel="noreferrer">
                          {d.address}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="k-small tr-sec__more">
              New jobs open on <span className="k-mono">{MARKET_ADDRESS}</span>. Every other address we use is on{" "}
              <Link className="k-link" href="/contracts">
                Contracts
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
