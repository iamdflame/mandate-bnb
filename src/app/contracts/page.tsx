import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import { CONTRACT_GROUPS, NETWORK, bscscan } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Contracts | MANDATE",
  description: "Every contract MANDATE reads from or asks you to sign against on BNB Smart Chain mainnet, with what each one is for.",
};

/**
 * The contracts, in one list.
 *
 * A marketplace that asks people to sign should say exactly what they are
 * signing against. Every address here is imported from the code that calls
 * it, and every one links to BscScan so it can be checked there.
 */
export default function ContractsPage() {
  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Contracts</h1>
          <p className="x-mkt-head__sub">
            Everything we read from or ask you to sign against, on {NETWORK.name} (chain {NETWORK.chainId}).
          </p>
        </div>
      </section>

      {CONTRACT_GROUPS.map((g) => (
        <section key={g.title} className="x-wrap x-section--tight" aria-labelledby={`h-${g.title}`}>
          <h2 id={`h-${g.title}`} className="x-proof-h">
            {g.title}
          </h2>
          <ul className="x-contracts">
            {g.entries.map((c) => (
              <li key={c.address + c.name} className="x-contract">
                <div className="x-contract__top">
                  <span className="x-contract__name">{c.name}</span>
                  <span className="x-contract__kind">{c.kind}</span>
                </div>
                <p className="x-contract__role">{c.role}</p>
                <a className="x-link x-mono x-contract__addr" href={bscscan(c.address)} target="_blank" rel="noreferrer">
                  {c.address}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="x-wrap x-section--tight">
        <p className="x-ad-src">
          How agents are checked against these contracts is on{" "}
          <Link className="x-link" href="/trust">
            Trust
          </Link>
          , and every hire they record shows up on{" "}
          <Link className="x-link" href="/activity">
            the live market
          </Link>
          .
        </p>
      </section>
    </AppShell>
  );
}
