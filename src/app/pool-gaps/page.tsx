import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
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

function Row({ r, i }: { r: PoolRow; i: number }) {
  return (
    <li className="x-gap">
      <span className="x-gap__n x-mono">{i + 1}</span>
      <span className="x-gap__pair">
        {r.symbol0}/{r.symbol1} <span className="x-dim">{fee(r.fee)}</span>
      </span>
      <span className="x-gap__cell x-mono" title="Swaps in the window">
        {r.swaps.toLocaleString("en-GB")} swaps
      </span>
      <span className="x-gap__cell x-mono" title={`${r.symbol0} that crossed the pool in the window`}>
        {amount(r.volume0)} {r.symbol0}
      </span>
      <span className="x-gap__turn x-mono">{r.turnover === null ? "nothing in range" : `${r.turnover >= 10 ? r.turnover.toFixed(0) : r.turnover.toFixed(2)}×`}</span>
      <a className="x-link x-mono x-gap__pool" href={bscAddress(r.pool)} target="_blank" rel="noreferrer">
        {r.pool.slice(0, 8)}…{r.pool.slice(-4)}
      </a>
    </li>
  );
}

/**
 * PancakeSwap's pool gaps, as a page.
 *
 * PancakeSwap asked for research that finds "demand where creating PancakeSwap
 * pools could improve liquidity efficiency". This is the narrow version of
 * that which the chain can settle: for every V3 pool that traded in a window,
 * how many times its depth at the current price traded through it. The
 * method's limits are printed on the page at the same size as the ranking,
 * because a ranking without them reads as advice, and it is not.
 */
export default async function PoolGapsPage() {
  await warm(["pool-gap", "pool-gap-progress"]).catch(() => undefined);
  const reading = poolGapReading()?.payload ?? null;
  const progress = poolGapProgress();
  const done = progress ? Math.min(100, Math.round(((progress.cursor - progress.from) / (progress.to - progress.from + 1)) * 100)) : null;

  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Pool gaps</h1>
          <p className="x-mkt-head__sub">Where PancakeSwap V3 liquidity is thin against the demand crossing it.</p>
        </div>
        <p className="x-proof-lede">
          For every V3 pool that traded in a window of blocks, how many times its depth at the current price traded through it. A high number is demand arriving
          faster than depth is being supplied, which is where a liquidity provider or a rebalancing agent should look first.
        </p>
        {reading ? (
          <ul className="x-score" aria-label="The window">
            <li className="x-score__item">
              <span className="x-score__n x-mono">{reading.blocks.toLocaleString("en-GB")}</span> blocks
              {reading.hours ? `, ${reading.hours < 1 ? `${Math.round(reading.hours * 60)} min` : `${reading.hours.toFixed(1)} h`}` : ""}
            </li>
            <li className="x-score__item">
              <span className="x-score__n x-mono">{reading.swaps.toLocaleString("en-GB")}</span> swaps
            </li>
            <li className="x-score__item">
              <span className="x-score__n x-mono">{reading.poolsTraded.toLocaleString("en-GB")}</span> pools traded
            </li>
          </ul>
        ) : null}
      </section>

      {progress ? (
        <div className="x-wrap">
          <p className="x-ad-src" role="status">
            A new window is being read: blocks {progress.from.toLocaleString("en-GB")} to {progress.to.toLocaleString("en-GB")}, {done}% so far,{" "}
            {progress.swaps.toLocaleString("en-GB")} swaps. It is published when the whole window is in.
          </p>
        </div>
      ) : null}

      {reading ? (
        <>
          <section className="x-wrap x-section--tight" aria-labelledby="h-ranked">
            <h2 id="h-ranked" className="x-proof-h">
              Highest turnover
            </h2>
            <p className="x-ad-src">
              Among the {reading.poolsRead} busiest pools with at least {MIN_SWAPS} swaps in the window. Turnover is the token0 that crossed the pool, over its virtual
              token0 reserve at the price when the window closed.
            </p>
            <ol className="x-gaps">
              {reading.ranked.map((r, i) => (
                <Row key={r.pool} r={r} i={i} />
              ))}
            </ol>
            {reading.empty.length ? (
              <p className="x-ad-src">
                {reading.empty.length} busy pool{reading.empty.length === 1 ? "" : "s"} had nothing in range when the window closed, so {reading.empty.length === 1 ? "it has" : "they have"} no
                depth to measure against:{" "}
                {reading.empty.map((r, i) => (
                  <span key={r.pool}>
                    {i ? ", " : ""}
                    <a className="x-link" href={bscAddress(r.pool)} target="_blank" rel="noreferrer">
                      {r.symbol0}/{r.symbol1} {fee(r.fee)}
                    </a>
                  </span>
                ))}
                .
              </p>
            ) : null}
            <Source kind="chain" block={reading.to} at={reading.readAt}>
              Every PancakeSwap V3 Swap event from block {reading.from.toLocaleString("en-GB")}, and each pool&apos;s liquidity and price at the end. Reproduce it with{" "}
              <span className="x-mono x-src__cmd">npm run pool-gap</span>.
            </Source>
          </section>

          <section className="x-wrap x-section--tight" aria-labelledby="h-not">
            <h2 id="h-not" className="x-proof-h">
              What this does not claim
            </h2>
            <ul className="x-notclaim">
              <li>That a high-turnover pool is mispriced, or that adding liquidity there would pay. Fees earned depend on the price path, which this does not model.</li>
              <li>That the fee tier is wrong. A 0.01% pool with high turnover may be exactly where traders want it.</li>
              <li>Anything about pools that traded fewer than {MIN_SWAPS} times in the window, which are left out on purpose.</li>
              <li>That the window is typical. It is one stretch of blocks, named above, and the next reading may rank differently.</li>
            </ul>
          </section>
        </>
      ) : (
        <div className="x-wrap x-section--tight">
          <Empty title="The first reading is still being taken.">
            A window of every V3 swap is read in slices on the site&apos;s clock and published when complete. Until then, run it yourself with{" "}
            <span className="x-mono">npm run pool-gap</span>.
          </Empty>
        </div>
      )}

      <section className="x-wrap x-section--tight">
        <p className="x-ad-src">
          Agents that move liquidity back into range are in{" "}
          <Link className="x-link" href="/agents?category=rebalancing">
            Rebalancing
          </Link>
          . Whether hiring one beats doing it yourself is on{" "}
          <Link className="x-link" href="/proof">
            Proof
          </Link>
          .
        </p>
      </section>
    </AppShell>
  );
}
