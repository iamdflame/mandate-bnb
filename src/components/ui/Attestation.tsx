import CopyLine from "@/components/account/CopyLine";

export interface AttestationView {
  /** Which epoch this commitment covers. "open" is the pre-award reading. */
  epoch: number | "open";
  observationHash: string;
  valuationWei?: bigint | string | null;
  blockNumber: bigint | number | string;
  takenAt?: string | number | Date | null;
  /** Greenfield object holding the token-by-token preimage. */
  breakdownUrl?: string | null;
  /** The digest of that preimage, as committed on chain. */
  breakdownRef?: string | null;
  /** True where the emitted observation re-hashes to the committed digest. */
  matches?: boolean | null;
}

/**
 * A commitment made before the outcome was known.
 *
 * This is the component that answers the only question that ever mattered
 * about this product: where does the number come from. The digest was written
 * to the chain at award time; the preimage is on Greenfield; the settlement
 * event carries the full observation. Anyone can hash the one and compare it
 * to the other, and the command to do it is printed underneath.
 *
 * Nothing here is asserted by us. Every field is a chain read or a link to
 * one.
 */
export default function Attestation({
  attestations,
  mandateId,
  chainId = 56,
}: {
  attestations: AttestationView[];
  mandateId: number;
  chainId?: number;
}) {
  return (
    <section className="ac-part" aria-labelledby="attest-title">
      <div className="ac-part__head">
        <h2 id="attest-title" className="k-h3">
          Attestations
        </h2>
        <p className="k-small">Each valuation was committed on chain before the outcome was known. The preimage is on Greenfield.</p>
      </div>

      {attestations.length === 0 ? (
        <p className="k-small">No attestation has been committed yet.</p>
      ) : (
        <ul className="ac-att">
          {attestations.map((a) => (
            <li className="ac-att__row" key={String(a.epoch)}>
              <span className="ac-att__e">{a.epoch === "open" ? "Opening" : `Epoch ${a.epoch}`}</span>
              <code className="k-mono ac-att__h" title={a.observationHash}>
                {short(a.observationHash)}
              </code>
              <span className="k-small k-num">
                {a.valuationWei ? `${weiToBnb(a.valuationWei)} BNB, ` : ""}block {String(a.blockNumber)}
                {a.takenAt ? `, ${new Date(a.takenAt).toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}
              </span>
              <span className="ac-att__l">
                {a.breakdownUrl ? (
                  <a className="k-link" href={a.breakdownUrl} target="_blank" rel="noreferrer" title={a.breakdownRef ?? undefined}>
                    Preimage
                  </a>
                ) : (
                  <span className="k-small">no preimage</span>
                )}
              </span>
              {a.matches === null || a.matches === undefined ? null : <span className={`k-tag ${a.matches ? "k-tag--ours" : "k-tag--err"}`}>{a.matches ? "re-hashes" : "mismatch"}</span>}
            </li>
          ))}
        </ul>
      )}

      <CopyLine note="Reads the chain and nothing else: no database, no API, no file we control. Exit 0 verified, 1 mismatch, 3 inconclusive.">{`npx mandate-verify --mandate ${mandateId} --chain ${chainId}`}</CopyLine>
    </section>
  );
}

const short = (h: string) => (h.length > 20 ? `${h.slice(0, 10)}…${h.slice(-8)}` : h);

/** Six decimals: enough to see a bond move, few enough to stay tabular. */
export const weiToBnb = (wei: bigint | string | number): string => {
  const v = BigInt(wei);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 6);
  return `${whole}.${frac}`;
};
