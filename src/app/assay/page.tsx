import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import TokenLookup from "@/components/ui/TokenLookup";
import Command from "@/components/ui/Command";
import TrustHead from "@/components/trust/TrustHead";
import { HALLMARK_LADDER } from "@/lib/assay/types";

export const metadata: Metadata = {
  title: "The method in full | Mandate",
  description:
    "The six tests, what each is worth, and the fineness ladder they produce. Assay any agent on BSC, including one you are being asked to trust somewhere else.",
};

/**
 * What each test is worth, in millesimal points.
 *
 * Published because a scoring rubric nobody can read is the same unaccountable
 * verdict as a five-star rating. The weights are the ones the code actually
 * uses (WEIGHTS in src/lib/assay/index.ts), stated here, so if they drift the
 * page is wrong and someone can say so.
 */
const TESTS: { id: string; title: string; weight: number; job: string; asks: string; fails: string }[] = [
  { id: "identity", title: "Identity", weight: 250, job: "rebalancing", asks: "Does the thing the registry points at actually exist and answer?", fails: "The endpoint 404s, its card cannot be parsed, or the endpoint is an unfilled {agentId} template." },
  { id: "custody", title: "Custody", weight: 150, job: "health-factor", asks: "Is the agent's wallet separate from its owner's?", fails: "agent_wallet == owner_address: the agent has no custody of its own." },
  { id: "activity", title: "Activity", weight: 250, job: "yield-optimisation", asks: "Has the wallet ever done anything?", fails: "Nonce 0 and balance 0: registered and never used." },
  { id: "capability", title: "Capability", weight: 200, job: "grid-trading", asks: "Has it touched the protocols its claimed job implies?", fails: "A grid agent that has never called a router is claiming what the chain contradicts." },
  { id: "reputation", title: "Reputation", weight: 100, job: "health-factor", asks: "Does its feedback survive de-duplication?", fails: "Coordinated cohorts are removed before the mean is taken." },
  { id: "performance", title: "Performance", weight: 50, job: "rebalancing", asks: "Has it settled epochs against measurements committed in advance?", fails: "No record, the ordinary case, reported as absence rather than zero." },
];

export default function MethodPage() {
  const total = TESTS.reduce((n, t) => n + t.weight, 0);
  // The ladder as bands on a 0 to 1,000 scale, lowest first.
  const rungs = [...HALLMARK_LADDER].reverse();
  const bands = rungs.map((h, i) => ({ ...h, from: h.min, to: i < rungs.length - 1 ? rungs[i + 1].min : total }));

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          crumbs={[
            { href: "/trust", label: "Trust" },
            { href: "/verify", label: "The checks" },
          ]}
          title="We do not score agents. We test them."
          lede={`Six tests against BNB Smart Chain, each worth a fixed share of ${total.toLocaleString("en-GB")} points. A point is earned only where evidence exists, and nothing is weighted by opinion after the fact.`}
          art={
            <div className="tr-weights" aria-hidden="true">
              <span className="tr-weights__who">
                <Agent job="grid-trading" seed="method-weigher" size={110} state="awake" slot="weights" />
              </span>
              <div className="tr-weights__bar">
                {TESTS.map((t, i) => (
                  <span key={t.id} className="tr-weights__seg" data-job={t.job} style={{ flexGrow: t.weight, ["--i" as string]: i }}>
                    <span className="tr-weights__n k-num">{t.weight}</span>
                    <span className="tr-weights__t">{t.title}</span>
                  </span>
                ))}
              </div>
              <span className="tr-weights__total k-num">= {total.toLocaleString("en-GB")} points at a perfect score</span>
            </div>
          }
        >
          <TokenLookup />
        </TrustHead>

        <section className="tr-sec tr-sec--first" aria-labelledby="tests-title">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="tests-title" className="k-h2">
                  The six tests.
                </h2>
                <p className="k-body">What each asks, what it is worth, and what a failure looks like on the chain.</p>
              </div>
            </div>
            <div className="k-table-wrap">
              <table className="k-table tr-tests">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Worth</th>
                    <th>What it asks</th>
                    <th>What a failure looks like</th>
                  </tr>
                </thead>
                <tbody>
                  {TESTS.map((t) => (
                    <tr key={t.id} data-job={t.job}>
                      <td className="k-table__main">
                        <span className="tr-tests__name">{t.title}</span>
                      </td>
                      <td>
                        <span className="tr-tests__w">
                          <span className="k-num">{t.weight}</span>
                          <span className="tr-tests__wbar" aria-hidden="true" style={{ ["--w" as string]: `${(t.weight / 250) * 100}%` }} />
                        </span>
                      </td>
                      <td className="tr-tests__ask">{t.asks}</td>
                      <td className="k-small">{t.fails}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="k-small tr-sec__more">
              A test that cannot produce evidence returns <em>inconclusive</em> rather than inventing a number. Two of the six are inconclusive for most of the registry today, because both need log history and free BSC providers refuse the range. Every certificate says so.
            </p>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="ladder-title">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="ladder-title" className="k-h2">
                  From points to a grade.
                </h2>
                <p className="k-body">The points earned, out of {total.toLocaleString("en-GB")}, are read on the assay office&apos;s own scale. Below 375, no mark is struck at all.</p>
              </div>
            </div>
            <figure className="tr-ladder">
              <div className="tr-ladder__bar">
                {bands.map((b) => (
                  <span key={b.name} className="tr-ladder__band" data-base={b.min === 0 ? "1" : undefined} style={{ flexGrow: Math.max(8, b.to - b.from) }}>
                    <span className="tr-ladder__mark k-num">{b.mark || "no mark"}</span>
                    <span className="tr-ladder__name">{b.name}</span>
                    <span className="tr-ladder__note">{b.note}</span>
                  </span>
                ))}
              </div>
              <figcaption className="k-src">
                Widths follow the scale, except the narrow top rungs, drawn wider so they can be read. 999 is pure; 375 is the lowest grade that may carry a hallmark in the United Kingdom.
              </figcaption>
            </figure>
            <p className="k-body tr-sec__more">
              Base metal receives no mark, and that is deliberate. A weak agent is never drawn with a bad score; it is shown unmarked, which is honest, and at the scale of this registry, the common case. A grade measures named checks. It is not a rating.
            </p>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="run-title">
          <div className="k-wrap">
            <div className="tr-run k-panel">
              <div className="tr-run__copy">
                <h2 id="run-title" className="k-h3">
                  Run it yourself.
                </h2>
                <p className="k-body">The same tests this site runs, from a clean checkout of the repository.</p>
                <Link href="/bench" className="k-btn k-btn--primary">
                  Or watch it live on the bench <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                </Link>
              </div>
              <div className="tr-run__cmds">
                <Command note="The six tests, for one agent.">npm run assay -- 153776</Command>
                <Command note="The reputation autopsy for one agent, including the wallets behind it.">npm run sybil -- 153776</Command>
                <Command note="Re-derives a settlement from public chain state alone.">npx mandate-verify --mandate 0 --chain 56 --deployment v1</Command>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
