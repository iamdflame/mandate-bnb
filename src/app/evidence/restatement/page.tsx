import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, EyeOff } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import Command from "@/components/ui/Command";
import Source from "@/components/x/Source";
import TrustHead from "@/components/trust/TrustHead";
import { EXPLORER } from "@/lib/config";
import restatement from "@/data/restatement.json";

export const metadata: Metadata = {
  title: "Where we were wrong | Mandate",
  description:
    "We measured our own agents wrong and slashed one for it. Every settled epoch, re-run through the corrected gauge, including what we still cannot prove.",
};

const bnb = (wei: string) => (Number(BigInt(wei)) / 1e18).toFixed(8);
const pct = (bps: number | null) => (bps === null ? "none" : `${bps >= 0 ? "+" : ""}${(bps / 100).toFixed(2)}%`);

/** What the old gauge could see in a wallet, and what it counted as zero. */
const SEEN = ["Native BNB", "USDT"];
const UNSEEN = ["A PancakeSwap V3 position", "A Venus supply", "A debt repayment", "A WBNB wrap"];

/**
 * The confession, kept as a record: what the gauge got wrong, the slashes it
 * caused, the re-derivation that would prove them wrong, and why it has not
 * been done. No money has been returned on an assumption.
 */
export default function RestatementPage() {
  const r = restatement;
  const slashed = r.epochs.filter((e) => BigInt(e.slashWei) > 0n);
  const pending = slashed.filter((s) => !s.slashResolved).length;

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          crumbs={[
            { href: "/trust", label: "Trust" },
            { href: "/evidence", label: "What is true now" },
          ]}
          title="We measured our own agents wrong, and slashed their bonds for it."
          lede="The gauge read native BNB and USDT and nothing else. Every strategy this market runs moves capital into something it could not see, so the better an agent performed, the harder it was punished."
          art={
            <figure className="tr-gauge" aria-label="What the old gauge counted">
              <span className="tr-gauge__who" aria-hidden="true">
                <Agent job="yield-optimisation" seed="restatement-gauge" size={110} state="failed" slot="gauge" />
              </span>
              <figcaption className="tr-gauge__k">What the old gauge counted in a wallet</figcaption>
              <ul className="tr-gauge__rows">
                {SEEN.map((s) => (
                  <li key={s} data-seen="1">
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                    <span>{s}</span>
                    <span className="tr-gauge__v">counted</span>
                  </li>
                ))}
                {UNSEEN.map((s) => (
                  <li key={s}>
                    <EyeOff size={14} aria-hidden="true" />
                    <span>{s}</span>
                    <span className="tr-gauge__v k-num">counted as 0</span>
                  </li>
                ))}
              </ul>
            </figure>
          }
        >
          <ul className="tr-figs">
            <li className="k-fig">
              <span className="k-fig__n k-num">{r.totals.settledEpochs}</span>
              <span className="k-fig__l">settled epochs on record</span>
            </li>
            <li className="k-fig tr-fig--err">
              <span className="k-fig__n k-num">{r.totals.slashes}</span>
              <span className="k-fig__l">slashes taken</span>
            </li>
            <li className="k-fig">
              <span className="k-fig__n k-num">{bnb(r.totals.slashedWei)}</span>
              <span className="k-fig__l">BNB slashed</span>
            </li>
            <li className="k-fig">
              <span className="k-fig__n k-num">{r.totals.rederived}</span>
              <span className="k-fig__l">re-derived so far</span>
            </li>
          </ul>
          <Source kind="record" at={r.generatedAt} verb="re-run">
            Not theoretical: the wallet holding mandates on the live market carries a Venus supply worth roughly 23% of its total value, and the old gauge valued it at nothing.
          </Source>
        </TrustHead>

        <section className="tr-sec tr-sec--first" aria-labelledby="rs-slashes">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="rs-slashes" className="k-h2">
                  The slashes on record.
                </h2>
                <p className="k-body">
                  <span className="k-num">{pending}</span> of {slashed.length} still pending. None has been resolved.
                </p>
              </div>
            </div>
            <div className="k-table-wrap">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Mandate</th>
                    <th>Epoch</th>
                    <th>Reported α</th>
                    <th>Slashed, BNB</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {slashed.map((e) => (
                    <tr key={`${e.market}-${e.mandateId}-${e.epoch}`}>
                      <td className="k-table__main">
                        <a className="tr-addr" href={`${EXPLORER}/address/${e.market}`} target="_blank" rel="noreferrer">
                          {e.marketName}
                        </a>
                      </td>
                      <td className="k-num">{e.mandateId}</td>
                      <td className="k-num">{e.epoch}</td>
                      <td className="k-num">{pct(e.reportedAlphaBps)}</td>
                      <td className="k-num tr-neg">{bnb(e.slashWei)}</td>
                      <td>{e.slashResolved ? <span className="tr-v tr-v--pass">resolved</span> : <span className="tr-v tr-v--warn">pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="k-small tr-sec__more">
              <span className="k-mono">resolveSlash(mandateId, epoch, false)</span> returns a pending slash to the agent, and this project owns both affected contracts, so the remedy is one transaction away once the error is established.
            </p>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="rs-rederive">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="rs-rederive" className="k-h2">
                  Re-derivation.
                </h2>
                <p className="k-body">
                  <span className="k-num">
                    {r.totals.rederived} of {r.totals.settledEpochs}
                  </span>{" "}
                  settled epochs re-run through the corrected gauge.
                </p>
              </div>
            </div>
            <div className="tr-tally" role="img" aria-label={`${r.totals.rederived} of ${r.totals.settledEpochs} re-derived`}>
              {r.epochs.map((e) => (
                <span key={`t-${e.market}-${e.mandateId}-${e.epoch}`} data-done={e.blockedBy ? undefined : "1"} />
              ))}
            </div>
            <div className="k-table-wrap">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Mandate</th>
                    <th>Epoch</th>
                    <th>Block</th>
                    <th>Reported</th>
                    <th>Corrected</th>
                    <th>Why not yet</th>
                  </tr>
                </thead>
                <tbody>
                  {r.epochs.map((e) => (
                    <tr key={`d-${e.market}-${e.mandateId}-${e.epoch}`}>
                      <td className="k-table__main">{e.marketName}</td>
                      <td className="k-num">{e.mandateId}</td>
                      <td className="k-num">{e.epoch}</td>
                      <td className="k-num">{e.attestedBlock ?? "none"}</td>
                      <td className="k-num">{pct(e.reportedAlphaBps)}</td>
                      <td className="k-num">{pct(e.correctedAlphaBps)}</td>
                      <td className="k-small tr-why">{e.blockedBy ?? "re-derived"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="rs-open">
          <div className="k-wrap">
            <div className="tr-open k-panel">
              <div className="tr-open__copy">
                <h2 id="rs-open" className="k-h3">
                  What is not established.
                </h2>
                <p className="k-body">
                  The slashes above are <strong className="k-strong">not yet proven to have been taken in error</strong>, and no money has been returned on the strength of an assumption. Correcting the record with an unverified correction would repeat the failure this page reports.
                </p>
                <p className="k-small">
                  Re-deriving a valuation at a past block needs archive state, and BSC&rsquo;s public endpoints serve about fifty seconds of it: <span className="k-mono">bsc-dataseed</span> answers <span className="k-mono">missing trie node</span>, <span className="k-mono">blockrazor</span> answers <span className="k-mono">not supported</span>, <span className="k-mono">publicnode</span> demands a token. The attested blocks are hours old.
                </p>
              </div>
              <Command note="Completes the re-derivation and, where a slash is shown to have been taken in error, names the transaction that returns it.">npm run restate -- --archive &lt;archive-rpc-url&gt;</Command>
            </div>
          </div>
        </section>

        <section className="tr-tail">
          <div className="k-wrap tr-tail__in">
            <p className="k-small">The rest of what went against us, and what is not true yet, is on What is true now.</p>
            <div className="k-row">
              <Link className="k-btn k-btn--ghost" href="/graveyard">
                What failed
              </Link>
              <Link className="k-btn" href="/evidence#against">
                What went against us <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
