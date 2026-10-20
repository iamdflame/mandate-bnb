import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import TrustHead from "@/components/trust/TrustHead";
import CopyAddress from "@/components/trust/CopyAddress";
import { CONTRACT_GROUPS, NETWORK, bscscan } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Contracts | MANDATE",
  description: "Every contract MANDATE reads from or asks you to sign against on BNB Smart Chain mainnet, with what each one is for.",
};

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
/** Each group, drawn by the family that works with it most. */
const GROUP_JOB: Record<string, string> = {
  "Agent identity and ratings": "rebalancing",
  Hiring: "yield-optimisation",
  Leashes: "health-factor",
  "Tokens you pay with": "grid-trading",
  "Protocols agents work on": "rebalancing",
};

/**
 * The contracts, in one list.
 *
 * A marketplace that asks people to sign should say exactly what they are
 * signing against. Every address here is imported from the code that calls
 * it, and every one links to BscScan so it can be checked there.
 */
export default function ContractsPage() {
  const total = CONTRACT_GROUPS.reduce((n, g) => n + g.entries.length, 0);
  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          title="What you sign against."
          lede={`Every contract we read from or ask you to sign against, on ${NETWORK.name} (chain ${NETWORK.chainId}), with what each one is for. Each address comes from the code that calls it.`}
          art={
            <nav className="tr-cindex k-panel k-panel--raised" aria-label="Contract groups">
              <span className="tr-cindex__who" aria-hidden="true">
                <Agent job="health-factor" seed="contracts-clerk" size={96} state="awake" slot="cidx" />
              </span>
              <p className="tr-cindex__k">
                <span className="k-num">{total}</span> contracts in {CONTRACT_GROUPS.length} groups
              </p>
              <ul>
                {CONTRACT_GROUPS.map((g) => (
                  <li key={g.title}>
                    <a href={`#${slug(g.title)}`}>
                      <span>{g.title}</span>
                      <span className="tr-cindex__n k-num">{g.entries.length}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          }
        />

        {CONTRACT_GROUPS.map((g, gi) => (
          <section key={g.title} id={slug(g.title)} className={`tr-sec${gi === 0 ? " tr-sec--first" : ""} tr-cgroup`} aria-labelledby={`h-${slug(g.title)}`}>
            <div className="k-wrap">
              <div className="tr-cgroup__head">
                <span aria-hidden="true">
                  <Agent job={GROUP_JOB[g.title] ?? "rebalancing"} seed={`contracts-${gi}`} size={56} state="ready" slot="cg" />
                </span>
                <h2 id={`h-${slug(g.title)}`} className="k-h3">
                  {g.title}
                </h2>
              </div>
              <ul className="tr-contracts">
                {g.entries.map((c) => (
                  <li key={c.address + c.name} className="tr-contract">
                    <div className="tr-contract__top">
                      <span className="tr-contract__name">{c.name}</span>
                      <span className="k-tag">{c.kind}</span>
                    </div>
                    <p className="tr-contract__role">{c.role}</p>
                    <div className="tr-contract__addr">
                      <span className="k-mono tr-contract__full">{c.address}</span>
                      <CopyAddress value={c.address} label={c.name} />
                      <a className="tr-copy" href={bscscan(c.address)} target="_blank" rel="noreferrer" aria-label={`${c.name} on BscScan`}>
                        <ArrowUpRight size={14} aria-hidden="true" />
                        <span>BscScan</span>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <section className="tr-tail">
          <div className="k-wrap tr-tail__in">
            <p className="k-small">How agents are checked against these contracts is on Trust, and every hire they record shows up on the live market.</p>
            <div className="k-row">
              <Link className="k-btn k-btn--ghost" href="/activity">
                The live market
              </Link>
              <Link className="k-btn" href="/trust">
                How we check <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
