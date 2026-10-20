import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Scale } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import PageHead from "@/components/k/PageHead";
import Source from "@/components/x/Source";
import Empty from "@/components/x/Empty";
import { warm } from "@/lib/data/snapshots";
import { MIN_SWAPS, poolGapProgress, poolGapReading, type PoolRow } from "@/lib/pancake/pool-gap";

export const metadata: Metadata = {
  title: "Pool gaps | MANDATE",
  description: "Where PancakeSwap V3 liquidity is thin against the demand crossing it, measured from every swap in a window of BNB Smart Chain blocks.",
};

export const revalidate = 600;

const bscAddress = (a: string) => `https://bscscan.com/address/${a}`;
const fee = (f: number) => `${(f / 10_000).toFixed(2)}%`;
const amount = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : n >= 1 ? n.toFixed(2) : n.toPrecision(2));
const turn = (r: PoolRow) => (r.turnover === null ? null : r.turnover >= 10 ? r.turnover.toFixed(0) : r.turnover.toFixed(2));

/**
 * PancakeSwap's pool gaps, as a page.
 *
 * PancakeSwap asked for research that finds "demand where creating PancakeSwap
 * pools could improve liquidity efficiency". This is the narrow version of
 * that which the chain can settle: for every V3 pool that traded in a window,
 * how many times its depth at the current price traded through it. The
 * method's limits stay on the page, in full, right under the ranking, because
 * a ranking without them reads as advice, and it is not.
 */
export default async function PoolGapsPage() {
  await warm(["pool-gap", "pool-gap-progress"]).catch(() => undefined);
  const reading = poolGapReading()?.payload ?? null;
  const progress = poolGapProgress();
  const done = progress ? Math.min(100, Math.round(((progress.cursor - progress.from) / (progress.to - progress.from + 1)) * 100)) : null;
  const top = reading ? Math.max(1, ...reading.ranked.map((r) => r.turnover ?? 0)) : 1;

  return (
    <AppShell>
      <PageHead
        crumbs={[{ href: "/diagnose", label: "Check a wallet" }]}
        title="Pool gaps"
        lede="Where PancakeSwap V3 liquidity is thin against the demand crossing it: where a liquidity provider or a rebalancing agent should look first."
        agent={{ job: "rebalancing", seed: "pool-gaps", state: "working" }}
      >
        {reading ? (
          <div className="k-figs ac-pg__figs k-rise" style={{ ["--i" as string]: 3 }}>
            <div className="k-fig">
              <span className="k-fig__n">{reading.swaps.toLocaleString("en-GB")}</span>
              <span className="k-fig__l">swaps read</span>
            </div>
            <div className="k-fig">
              <span className="k-fig__n">{reading.poolsTraded.toLocaleString("en-GB")}</span>
              <span className="k-fig__l">pools traded</span>
            </div>
            <div className="k-fig">
              <span className="k-fig__n">{reading.blocks.toLocaleString("en-GB")}</span>
              <span className="k-fig__l">
                blocks
                {reading.hours ? `, ${reading.hours < 1 ? `${Math.round(reading.hours * 60)} min` : `${reading.hours.toFixed(1)} h`}` : ""}
              </span>
            </div>
          </div>
        ) : null}
      </PageHead>

      {progress ? (
        <div className="k-wrap">
          <div className="ac-pg__prog" role="status">
            <span className="ac-pg__bar" aria-hidden="true">
              <span style={{ width: `${done}%` }} />
            </span>
            <p className="k-small">
              A new window is being read: blocks {progress.from.toLocaleString("en-GB")} to {progress.to.toLocaleString("en-GB")}, <span className="k-num">{done}%</span> so far,{" "}
              {progress.swaps.toLocaleString("en-GB")} swaps. It is published when the whole window is in.
            </p>
          </div>
        </div>
      ) : null}

      {reading ? (
        <>
          <section className="k-wrap ac-sec" aria-labelledby="h-ranked">
            <div className="ac-sec__h">
              <div>
                <h2 id="h-ranked" className="k-h2">
                  Highest turnover
                </h2>
                <p className="k-body">
                  How many times each pool&apos;s depth at the current price traded through it, among the {reading.poolsRead} busiest pools with at least {MIN_SWAPS} swaps.
                </p>
              </div>
            </div>
            <div className="k-table-wrap">
              <table className="k-table ac-pg__table">
                <thead>
                  <tr>
                    <th scope="col">Pool</th>
                    <th scope="col">Turnover</th>
                    <th scope="col">Swaps</th>
                    <th scope="col">Crossed</th>
                    <th scope="col">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {reading.ranked.map((r) => (
                    <tr key={r.pool}>
                      <td className="k-table__main">
                        <span className="ac-pg__pair">
                          {r.symbol0}/{r.symbol1} <span className="k-tag">{fee(r.fee)}</span>
                        </span>
                      </td>
                      <td>
                        <span className="ac-pg__turn">
                          <span className="ac-pg__tbar" aria-hidden="true">
                            <span style={{ width: `${Math.max(2, ((r.turnover ?? 0) / top) * 100)}%` }} />
                          </span>
                          <span className="k-num ac-pg__tn">{turn(r) === null ? "nothing in range" : `${turn(r)}×`}</span>
                        </span>
                      </td>
                      <td className="k-num">{r.swaps.toLocaleString("en-GB")}</td>
                      <td className="k-num" title={`${r.symbol0} that crossed the pool in the window`}>
                        {amount(r.volume0)} {r.symbol0}
                      </td>
                      <td>
                        <a className="k-link k-mono" href={bscAddress(r.pool)} target="_blank" rel="noreferrer">
                          {r.pool.slice(0, 8)}…{r.pool.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="k-small ac-pg__how">
              Turnover is the token0 that crossed the pool, over its virtual token0 reserve at the price when the window closed. Amounts are in each pool&apos;s own token0.
            </p>
            {reading.empty.length ? (
              <p className="k-small">
                {reading.empty.length} busy pool{reading.empty.length === 1 ? "" : "s"} had nothing in range when the window closed, so {reading.empty.length === 1 ? "it has" : "they have"} no
                depth to measure against:{" "}
                {reading.empty.map((r, i) => (
                  <span key={r.pool}>
                    {i ? ", " : ""}
                    <a className="k-link" href={bscAddress(r.pool)} target="_blank" rel="noreferrer">
                      {r.symbol0}/{r.symbol1} {fee(r.fee)}
                    </a>
                  </span>
                ))}
                .
              </p>
            ) : null}
            <Source kind="chain" block={reading.to} at={reading.readAt}>
              Every PancakeSwap V3 Swap event from block {reading.from.toLocaleString("en-GB")}, and each pool&apos;s liquidity and price at the end. Reproduce it with{" "}
              <span className="k-mono">npm run pool-gap</span>.
            </Source>
          </section>

          <section className="k-wrap ac-sec" aria-labelledby="h-not">
            <div className="ac-notclaim">
              <h2 id="h-not" className="k-h3">
                What this does not claim
              </h2>
              <ul>
                <li>That a high-turnover pool is mispriced, or that adding liquidity there would pay. Fees earned depend on the price path, which this does not model.</li>
                <li>That the fee tier is wrong. A 0.01% pool with high turnover may be exactly where traders want it.</li>
                <li>Anything about pools that traded fewer than {MIN_SWAPS} times in the window, which are left out on purpose.</li>
                <li>That the window is typical. It is one stretch of blocks, named above, and the next reading may rank differently.</li>
              </ul>
            </div>
          </section>
        </>
      ) : (
        <div className="k-wrap ac-sec">
          <Empty title="The first reading is still being taken" job="rebalancing" pose="dozing">
            A window of every V3 swap is read in slices on the site&apos;s clock and published when complete. Until then, run it yourself with <span className="k-mono">npm run pool-gap</span>.
          </Empty>
        </div>
      )}

      <section className="k-wrap ac-sec ac-nexts" aria-label="Where to go next">
        <Link className="ac-next" href="/agents?category=rebalancing" data-job="rebalancing">
          <Agent job="rebalancing" seed="344119" house size={64} state="ready" slot="pgnext" />
          <span className="ac-next__copy">
            <span className="ac-next__t">Agents that move liquidity back into range</span>
            <span className="k-small">Rebalancing, in the marketplace</span>
          </span>
          <ArrowRight size={18} className="ac-next__go" aria-hidden="true" />
        </Link>
        <Link className="ac-next" href="/proof">
          <span className="ac-next__ic" aria-hidden="true">
            <Scale size={22} />
          </span>
          <span className="ac-next__copy">
            <span className="ac-next__t">Does hiring one beat doing it yourself?</span>
            <span className="k-small">The measured answer, on Proof</span>
          </span>
          <ArrowRight size={18} className="ac-next__go" aria-hidden="true" />
        </Link>
      </section>
    </AppShell>
  );
}
