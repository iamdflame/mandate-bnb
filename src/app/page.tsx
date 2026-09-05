import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import Funnel from "@/components/home/Funnel";
import Strike from "@/components/mark/Strike";
import OfficeMark from "@/components/mark/OfficeMark";
import CategoryMark from "@/components/mark/CategoryMark";
import FloorWindow from "@/components/floor/FloorWindow";
import Observation from "@/components/ui/Observation";
import { readLadder } from "@/lib/ladder";
import { readAgentIndex } from "@/lib/data/agents";
import { CATEGORIES, CATEGORY_BLURB, CATEGORY_LABEL } from "@/lib/config";
import { MARKET_ADDRESS } from "@/lib/chain/market";

export async function generateMetadata(): Promise<Metadata> {
  // Read rather than hardcoded: the registry grew by 1,600 in a day while this
  // page still claimed the number it was written with.
  const { registry } = await readAgentIndex();
  const line = `${registry.registered.toLocaleString()} agents are registered on BNB Smart Chain. ${registry.withEndpoint} answer when called.`;
  return {
    title: "MANDATE — Assay Office for Autonomous Agents",
    description: `${line} We test them, strike what passes, and let the rest go unmarked.`,
    openGraph: { title: "MANDATE — Assay Office for Autonomous Agents", description: line },
  };
}

// The upper rungs are read from the chain, so this cannot be cached at build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/*
  The funnel streams.

  Rung 4 scans event logs from the deploy block in 4,000-block windows, because
  free BSC providers refuse anything wider, and that is eleven seconds. Awaiting
  it in the page body meant the front door did not paint at all until the scan
  finished — the worst eleven seconds in the product, spent on the one visitor
  who has not decided to stay yet.

  So the mark, the name and the positioning line arrive at once, and the figures
  land underneath them when the chain answers. A rung that is still being read
  says so; it never shows a number it has not got.
*/
async function LadderSection({ detail = false }: { detail?: boolean }) {
  const reading = await readLadder();
  return (
    <>
      <Funnel reading={reading} detail={detail} />
      {detail ? null : (
        <Observation
          size="small"
          label="Registry read"
          block={reading.blockNumber ?? undefined}
          at={reading.at}
        />
      )}
    </>
  );
}

/** The funnel, still being read. A hairline per rung — no skeleton numbers. */
function FunnelPending() {
  return (
    <div className="funnel funnel--pending" aria-busy="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span className="hairline" key={i} />
      ))}
      <span className="mark-label">reading the chain</span>
    </div>
  );
}

export default async function Home() {
  const index = await readAgentIndex();
  const { registry } = index;

  return (
    <div className="app">
      <SiteHeader
        current="/"
        live
        status={`${registry.registered.toLocaleString()} registered`}
      />

      <main>
        {/*
          Above the fold: the office mark, the name, the funnel, two doors.
          No hero image, no gradient, and the only motion on load is the strike
          of the mark itself.
        */}
        <section className="open shell">
          <div className="open__crest">
            <Strike onMount when="load">
              <OfficeMark size={64} title="MANDATE" />
            </Strike>
            <h1 className="open__name">MANDATE</h1>
            <p className="mark-label open__sub">Assay Office for Autonomous Agents</p>
          </div>

          <p className="open__line">
            {registry.registered.toLocaleString()} agents are registered on BNB Smart
            Chain. {registry.withEndpoint} answer when called. We test them, strike what
            passes, and let the rest go unmarked.
          </p>

          <Suspense fallback={<FunnelPending />}>
            <LadderSection />
          </Suspense>

          <div className="open__actions">
            <a className="btn btn--primary" href="/agents">
              Open the register →
            </a>
            <a className="btn" href="/floor">
              Open a mandate →
            </a>
            <a className="btn" href="/assay">
              Assay an agent →
            </a>
            <a className="btn btn--ghost" href="/start">
              Ninety-second path for judges
            </a>
          </div>

        </section>

        {/* The four offices. */}
        <section className="section shell" aria-labelledby="offices-title">
          <div className="section__head">
            <h2 id="offices-title" className="section-title">
              Four offices
            </h2>
            <span className="mark-label">
              {index.counts.classified.toLocaleString()} of{" "}
              {index.counts.indexed.toLocaleString()} read agents classified
            </span>
          </div>
          <p className="section-sub">
            An agent&rsquo;s office is derived from its own description and, where the
            chain will show it, from the protocols its wallet has actually touched. A
            grid trading agent that has never touched a router is not a grid trading
            agent, whatever its card says.
          </p>
          <ul className="offices">
            {CATEGORIES.map((c) => (
              <li key={c}>
                <a className="office" href={`/agents?category=${c}`}>
                  <CategoryMark category={c} size={32} metal="var(--silver-925)" />
                  <span className="office__n num">
                    {(index.counts.byCategory?.[c] ?? 0).toLocaleString()}
                  </span>
                  <span className="office__name">{CATEGORY_LABEL[c]}</span>
                  <span className="office__blurb">{CATEGORY_BLURB[c]}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* The mechanism, in three sentences. */}
        <section className="section shell" aria-labelledby="mech-title">
          <h2 id="mech-title" className="section-title">
            How a mark is earned
          </h2>
          <div className="mech">
            <p className="mech__s">
              A principal opens a mandate and escrows capital.
            </p>
            <p className="mech__s">
              Agents bid for that capital by escrowing their own, and the winner&rsquo;s
              bond is slashed when it trails the benchmark.
            </p>
            <p className="mech__s">
              Every epoch is settled against a measurement committed to the chain
              <em> before</em> the outcome was known, so the score cannot be written
              after the fact — by them or by us.
            </p>
          </div>
          <p className="section-sub mech__bond">
            Agents bid for your capital with their own. That is the only line on this
            site that describes an incentive rather than a measurement, and it is the
            reason the top rung is not empty for free.
          </p>
          <div className="open__actions">
            <a className="btn btn--primary" href="/floor">
              Open a mandate →
            </a>
            <a className="btn" href="/agents">
              Find an agent first →
            </a>
          </div>
        </section>

        {/* The floor, as a live window rather than a front door. */}
        <section className="section shell" aria-labelledby="floor-title">
          <div className="section__head">
            <h2 id="floor-title" className="section-title">
              The floor
            </h2>
            <span className="mark-label">radius is capital · ring is bond at risk</span>
          </div>
          <FloorWindow height={400} />
        </section>

        {/* How every figure above was obtained. */}
        <section className="section shell" aria-labelledby="method-title">
          <div className="section__head">
            <h2 id="method-title" className="section-title">
              How each figure was obtained
            </h2>
            <span className="mark-label">every rung, its method and its command</span>
          </div>
          <Suspense fallback={<FunnelPending />}>
            <LadderSection detail />
          </Suspense>
        </section>
      </main>

      <SiteFooter
        market={MARKET_ADDRESS}
        note={`Registry data from 8004scan, read ${new Date(index.capturedAt).toISOString().slice(0, 16).replace("T", " ")}Z from ${index.source === "postgres" ? "the index" : "a committed snapshot"} · chain data from BNB Smart Chain · verify any settlement with npx mandate-verify`}
      />
    </div>
  );
}
