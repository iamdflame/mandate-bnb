import { formatEther } from "viem";
import type { Career } from "@/lib/career";

const bnb = (wei: string) => {
  const n = Number(formatEther(BigInt(wei)));
  if (n === 0) return "0";
  return n < 0.001 ? n.toFixed(8) : n.toFixed(4);
};

const pct = (bps: string) => {
  const n = Number(bps) / 100;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
};

/**
 * What this agent has actually done with capital.
 *
 * Not a score. Every mandate it has held, every epoch settled, every fee
 * earned and every slash taken, each with the transaction that did it — the
 * "how has it performed" the brief asks for, answered with a list rather than
 * a rating.
 */
export default function CareerPanel({
  career,
  explorer,
}: {
  career: Career;
  explorer: string;
}) {
  const t = career.totals;
  const nothing = t.mandates === 0 && t.epochs === 0;

  return (
    <section className="career" aria-labelledby="career-title">
      <h2 id="career-title" className="section-title">
        Career
      </h2>

      {nothing ? (
        <p className="au-lede">
          This agent has never held a mandate here. That is the ordinary case:
          nobody from the registry has posted a bond yet, which is the gap the
          market exists to close rather than a fact about this agent.
        </p>
      ) : (
        <>
          <dl className="career-totals">
            <div>
              <dt>Mandates held</dt>
              <dd>{t.mandates}</dd>
            </div>
            <div>
              <dt>Epochs settled</dt>
              <dd>{t.epochs}</dd>
            </div>
            <div>
              <dt>Fees earned</dt>
              <dd>{bnb(t.feesEarnedWei)} BNB</dd>
            </div>
            <div>
              <dt>Slashed</dt>
              <dd>{bnb(t.slashedWei)} BNB</dd>
            </div>
            <div>
              <dt>Dismissals</dt>
              <dd>{t.dismissals}</dd>
            </div>
          </dl>

          {career.mandates.length ? (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Mandate</th>
                  <th>Category</th>
                  <th>State</th>
                  <th className="num">Capital</th>
                  <th className="num">Bond</th>
                  <th className="num">Epochs</th>
                  <th className="num">Cumulative α</th>
                  <th className="num">Strikes</th>
                </tr>
              </thead>
              <tbody>
                {career.mandates.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <a href={`/mandate/${m.id}`}>#{m.id}</a>
                    </td>
                    <td>{m.category}</td>
                    <td>{m.state}</td>
                    <td className="num">{bnb(m.capitalWei)}</td>
                    <td className="num">{bnb(m.bondWei)}</td>
                    <td className="num">
                      {m.epochsSettled}/{m.epochsTotal}
                    </td>
                    <td className="num">{pct(m.cumulativeAlphaBps)}</td>
                    <td className="num">{m.strikes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {career.epochs.length ? (
            <table className="au-table">
              <thead>
                <tr>
                  <th>Epoch</th>
                  <th className="num">Realized α</th>
                  <th className="num">Fee</th>
                  <th className="num">Slashed</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {career.epochs.map((e) => (
                  <tr key={`${e.mandateId}-${e.epoch}`}>
                    <td>
                      #{e.mandateId} · {e.epoch}
                    </td>
                    <td className="num">{pct(e.alphaBps)}</td>
                    <td className="num">{bnb(e.feePaidWei)}</td>
                    <td className="num">{bnb(e.slashedWei)}</td>
                    <td>
                      <a href={`${explorer}/tx/${e.txHash}`} rel="noreferrer">
                        {e.txHash.slice(0, 12)}…
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {career.dismissals.length ? (
            <ul className="au-reasons">
              {career.dismissals.map((d) => (
                <li key={d.txHash}>
                  Dismissed from mandate #{d.mandateId} — {d.reason || "no reason recorded"}
                </li>
              ))}
            </ul>
          ) : null}

          {!career.logsRead ? (
            <p className="au-foot">
              The epoch list could not be read: no provider would serve the log
              range. What is shown above comes from contract storage, so the
              mandates are complete and the per-epoch rows may not be.
            </p>
          ) : career.verify ? (
            <p className="au-foot">
              Check any of this yourself: <code>{career.verify}</code>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
