import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatEther } from "viem";
import SiteHeader from "@/components/shell/SiteHeader";
import {
  CATEGORY_NAMES,
  readBids,
  readMandate,
  readMandateCount,
  STATE_NAMES,
} from "@/lib/chain/market";
import { previousMark, readEpochAttestation, readOpenAttestation } from "@/lib/settlement";
import { bucketName, objectName } from "@/lib/chain/greenfield";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHAIN = Number(process.env.NEXT_PUBLIC_MARKET_CHAIN_ID ?? 56);
const EXPLORER = CHAIN === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";
const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS ?? "";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Mandate ${id} — MANDATE`,
    description: `Every measurement mandate ${id} was settled against, committed on chain before the outcome was known, with the command that re-derives them.`,
  };
}

const bnb = (wei: bigint) => {
  const n = Number(formatEther(wei));
  return n === 0 ? "0" : n < 0.001 ? n.toFixed(8) : n.toFixed(5);
};
const pct = (bps: bigint | number) => {
  const n = Number(bps) / 100;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
};

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 0) notFound();

  const count = await readMandateCount().catch(() => 0);
  if (n >= count) notFound();

  const m = await readMandate(n);
  const [bids, opening] = await Promise.all([
    readBids(n).catch(() => []),
    readOpenAttestation(n).catch(() => null),
  ]);

  // One row per settled epoch, each against the mark before it.
  const epochs = [];
  for (let e = 0; e < m.epochsSettled; e++) {
    const [att, prev] = await Promise.all([
      readEpochAttestation(n, e).catch(() => null),
      previousMark(n, e).catch(() => null),
    ]);
    const implied =
      att && prev && prev.valuationWei > 0n
        ? (att.valuationWei * 10_000n) / prev.valuationWei - 10_000n
        : null;
    epochs.push({ e, att, prev, implied });
  }

  const bucket = bucketName();
  const gwUrl = (epoch: number | "open") =>
    `https://greenfield-sp.lumibot.org:443/view/${bucket}/${objectName(n, epoch)}`;

  return (
    <div className="app">
      <SiteHeader live status={`mandate ${n} of ${count}`} />
      <main className="shell mandate-page">
        <p className="eyebrow">Mandate {n}</p>
        <h1 className="reg-title">
          {CATEGORY_NAMES[m.category] ?? "Mandate"} · {STATE_NAMES[m.state] ?? ""}
        </h1>

        <dl className="career-totals">
          <div>
            <dt>Capital</dt>
            <dd>{bnb(m.capital)} BNB</dd>
          </div>
          <div>
            <dt>Bond at risk</dt>
            <dd>{bnb(m.bond)} BNB</dd>
          </div>
          <div>
            <dt>Epochs</dt>
            <dd>
              {m.epochsSettled}/{m.epochsTotal}
            </dd>
          </div>
          <div>
            <dt>Cumulative α</dt>
            <dd>{pct(m.cumulativeAlphaBps)}</dd>
          </div>
          <div>
            <dt>Strikes</dt>
            <dd>{m.strikes}</dd>
          </div>
        </dl>

        <p className="au-lede">
          Held by{" "}
          <a href={`${EXPLORER}/address/${m.agent}`} rel="noreferrer">
            <code>{m.agent}</code>
          </a>
          , for{" "}
          <a href={`${EXPLORER}/address/${m.principal}`} rel="noreferrer">
            <code>{m.principal.slice(0, 12)}…</code>
          </a>
          . Tolerance {m.toleranceBps} bps, fee {m.feeBps} bps of positive alpha,
          slash {m.slashBps} bps of the bond per failing epoch.
        </p>

        <section className="autopsy">
          <h2 className="section-title">Attestations</h2>
          <p className="au-lede">
            Every figure below was committed on chain before its outcome was
            known — the observation is emitted whole in the log and its hash
            stored beside it, so the arithmetic of each settlement can be
            re-derived by anyone without asking us for anything.
          </p>

          {opening ? (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Mark</th>
                  <th className="num">Value</th>
                  <th className="num">Block</th>
                  <th>Commitment</th>
                  <th>Working</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Opening</td>
                  <td className="num">{bnb(opening.valuationWei)}</td>
                  <td className="num">{opening.blockNumber.toString()}</td>
                  <td>
                    <code>{opening.observationHash.slice(0, 14)}…</code>
                  </td>
                  <td>
                    <a href={gwUrl("open")} rel="noreferrer">
                      Greenfield
                    </a>
                  </td>
                </tr>
                {epochs.map(({ e, att, implied }) =>
                  att ? (
                    <tr key={e}>
                      <td>Epoch {e}</td>
                      <td className="num">{bnb(att.valuationWei)}</td>
                      <td className="num">{att.blockNumber.toString()}</td>
                      <td>
                        <code>{att.observationHash.slice(0, 14)}…</code>
                      </td>
                      <td>
                        <a href={gwUrl(e)} rel="noreferrer">
                          Greenfield
                        </a>
                      </td>
                    </tr>
                  ) : (
                    <tr key={e}>
                      <td>Epoch {e}</td>
                      <td className="num" colSpan={4}>
                        no attestation stored
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          ) : (
            <p className="au-lede">
              This mandate has no opening attestation, so nothing can be settled
              against it.
            </p>
          )}

          {epochs.length ? (
            <>
              <h3 className="section-title">What the marks imply</h3>
              <table className="au-table">
                <thead>
                  <tr>
                    <th>Epoch</th>
                    <th className="num">Previous mark</th>
                    <th className="num">This mark</th>
                    <th className="num">Implied α</th>
                  </tr>
                </thead>
                <tbody>
                  {epochs.map(({ e, att, prev, implied }) => (
                    <tr key={e}>
                      <td>{e}</td>
                      <td className="num">{prev ? bnb(prev.valuationWei) : "—"}</td>
                      <td className="num">{att ? bnb(att.valuationWei) : "—"}</td>
                      <td className="num">{implied === null ? "—" : pct(implied)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <p className="au-foot">
            Re-derive all of it yourself, from the chain alone:{" "}
            <code>npx mandate-verify --mandate {n} --chain {CHAIN}</code>
          </p>
        </section>

        <section className="career">
          <h2 className="section-title">Succession queue</h2>
          {bids.length ? (
            <>
              <p className="au-lede">
                If the incumbent is dismissed, one of these takes the mandate in
                the same transaction. Each has its own capital escrowed against
                the target it is committing to.
              </p>
              <table className="au-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th className="num">Bond</th>
                    <th className="num">Target α</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((b, i) => (
                    <tr key={i}>
                      <td>
                        <a href={`${EXPLORER}/address/${b.agent}`} rel="noreferrer">
                          <code>{b.agent.slice(0, 14)}…</code>
                        </a>
                      </td>
                      <td className="num">{bnb(b.bond)}</td>
                      <td className="num">{pct(b.targetAlphaBps)}</td>
                      <td>{b.spent ? "promoted or withdrawn" : "waiting"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="au-lede">
              Nobody is waiting to take this mandate. A dismissal here would
              return the capital rather than hand it on.
            </p>
          )}
          <p className="au-foot">
            Contract:{" "}
            <a href={`${EXPLORER}/address/${MARKET}`} rel="noreferrer">
              <code>{MARKET}</code>
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
