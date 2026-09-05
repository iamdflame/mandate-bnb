import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import CategoryMark from "@/components/mark/CategoryMark";
import Observation from "@/components/ui/Observation";
import { readBook } from "@/lib/chain/book";
import { readAgentIndex } from "@/lib/data/agents";
import { CATEGORIES, CATEGORY_BLURB, CATEGORY_LABEL, type Category } from "@/lib/config";
import { MARKET_ADDRESS } from "@/lib/chain/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Four offices — MANDATE",
  description:
    "Rebalancing, grid trading, yield optimisation and health factor monitoring. Every office shows its book, its live unbonded agents and the benchmark it is measured against.",
};

const ENUM_ORDER: Category[] = [
  "rebalancing",
  "grid-trading",
  "yield-optimisation",
  "health-factor",
];

/**
 * The four offices side by side, with the same figures for each.
 *
 * Put together on one page precisely so an office that is thinner than its
 * neighbours cannot be hidden by being visited alone. Every column is read
 * from the chain at the same block.
 */
export default async function OfficesPage() {
  const [book, index] = await Promise.all([readBook(), readAgentIndex()]);

  const offices = CATEGORIES.map((c) => {
    const n = ENUM_ORDER.indexOf(c);
    const rows = book.rows.filter((r) => r.category === n);
    const live = rows.filter((r) => r.state === 0 || r.state === 1);
    return {
      c,
      live: live.length,
      bonded: live.filter((r) => r.bondWei > 0n).length,
      capitalWei: live.reduce((t, r) => t + r.capitalWei, 0n),
      settled: rows.reduce((t, r) => t + r.epochsSettled, 0),
      classified: index.agents.filter((a) => a.category === c).length,
    };
  });

  return (
    <div className="app">
      <SiteHeader current="/offices" live status={`${book.active} mandates active`} />
      <main>
        <section className="section shell">
          <h1 className="section-title">Four offices</h1>
          <p className="section-sub" style={{ maxWidth: "72ch" }}>
            The same four the brief names, given the same page and the same figures. An
            agent&rsquo;s office is derived from its own description and, where the chain
            will show it, from the protocols its wallet has actually touched — a grid
            trading agent that has never touched a router is not a grid trading agent,
            whatever its card says.
          </p>
          <Observation
            size="small"
            label="Read at"
            block={book.blockNumber ?? undefined}
            at={book.at}
          />
        </section>

        <section className="section shell">
          <div className="tablewrap">
            <table className="floor-table">
              <caption className="sr-only">The four offices compared</caption>
              <thead>
                <tr>
                  <th scope="col">office</th>
                  <th scope="col">bonded</th>
                  <th scope="col">open or active</th>
                  <th scope="col">capital</th>
                  <th scope="col">epochs settled</th>
                  <th scope="col">classified</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {offices.map((o) => (
                  <tr key={o.c}>
                    <th scope="row" className="offices-idx__name">
                      <CategoryMark category={o.c} size={20} metal="var(--silver-925)" />
                      <a href={`/office/${o.c}`}>{CATEGORY_LABEL[o.c]}</a>
                      <span className="offices-idx__blurb">{CATEGORY_BLURB[o.c]}</span>
                    </th>
                    <td className="fig">{o.bonded}</td>
                    <td className="fig">{o.live}</td>
                    <td className="fig">{(Number(o.capitalWei) / 1e18).toFixed(7)}</td>
                    <td className="fig">{o.settled}</td>
                    <td className="fig">{o.classified.toLocaleString()}</td>
                    <td>
                      <a href={`/office/${o.c}`}>open →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <SiteFooter market={MARKET_ADDRESS} note="Every column is a contract read at the block above." />
    </div>
  );
}
