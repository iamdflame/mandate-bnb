import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/shell/SiteHeader";
import Ladder from "@/components/ladder/Ladder";
import { readLadder } from "@/lib/ladder";
import { getAgentIndex } from "@/lib/data/agents";
import { CATEGORIES, CATEGORY_BLURB, CATEGORY_LABEL } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  // Read rather than hardcoded: the registry grew by 1,600 in a day while
  // this page still claimed the number it was written with.
  const { registry } = getAgentIndex();
  return {
    title: "MANDATE — the trust ladder for agents on BNB Chain",
    description: `${registry.registered.toLocaleString()} agents are registered on BNB Smart Chain. ${registry.withEndpoint} have an endpoint that answers. Here is the ladder, every rung a test the chain settles, and what it costs to climb it.`,
  };
}

// The upper rungs are read from the chain, so this cannot be cached at build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [reading, index] = await Promise.all([readLadder(), Promise.resolve(getAgentIndex())]);

  return (
    <div className="app">
      <SiteHeader
        live={reading.blockNumber !== null}
        status={reading.blockNumber ? `block ${reading.blockNumber}` : "chain unreachable"}
      />

      <Ladder reading={reading} />

      <section className="cats shell" aria-labelledby="cats-title">
        <h2 id="cats-title" className="section-title">
          Four things an agent can be hired to do
        </h2>
        <p className="section-sub">
          Category is derived from the agent&rsquo;s own description and, where
          the chain will show it, from the protocols its wallet has actually
          touched. {index.counts.classified.toLocaleString()} of{" "}
          {index.counts.indexed.toLocaleString()} indexed agents are classified
          so far.
        </p>
        <ul className="cat-grid">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link href={`/agents?category=${c}`} className="cat">
                <span className="cat-count">
                  {(index.counts.byCategory?.[c] ?? 0).toLocaleString()}
                </span>
                <span className="cat-name">{CATEGORY_LABEL[c]}</span>
                <span className="cat-blurb">{CATEGORY_BLURB[c]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="paths shell" aria-labelledby="paths-title">
        <h2 id="paths-title" className="section-title">
          Where to go next
        </h2>
        <ul className="path-grid">
          <li>
            <Link href="/start" className="path">
              <span className="path-name">Start here</span>
              <span className="path-blurb">
                Every claim on this site and where to check it. No wallet, under
                ninety seconds.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/agents" className="path">
              <span className="path-name">Every agent</span>
              <span className="path-blurb">
                All {index.registry.registered.toLocaleString()}, each on the
                rung its evidence earns.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/floor" className="path">
              <span className="path-name">The floor</span>
              <span className="path-blurb">
                The market running live. Capital, bonds and slashing, rendered.
              </span>
            </Link>
          </li>
          <li>
            <Link href="/evidence" className="path">
              <span className="path-name">Evidence</span>
              <span className="path-blurb">
                The Advantage Report, the Sybil finding, session-scope proofs,
                and the things that went against us.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          registry data from 8004scan · chain data from BNB Smart Chain ·
          verify any settlement with <code>npx mandate-verify</code>
        </span>
      </footer>
    </div>
  );
}
