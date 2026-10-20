import "@/styles/account.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatEther } from "viem";
import AppShell from "@/components/v2/shell/AppShell";
import Ledger, { type LedgerEvent } from "@/components/ui/Ledger";
import Attestation, { type AttestationView } from "@/components/ui/Attestation";
import { Reading } from "@/components/account/None";
import { ReceiptHead, ReceiptPaper, ReceiptPart } from "@/components/account/Receipt";
import {
  CATEGORY_NAMES,
  MARKET_ADDRESS,
  readBids,
  readMandate,
  readMandateCount,
  STATE_NAMES,
} from "@/lib/chain/market";
import { previousMark, readEpochAttestation, readOpenAttestation } from "@/lib/settlement";
import { bucketName, objectName } from "@/lib/chain/greenfield";
import { readCareerForWallet } from "@/lib/career";
import { CATEGORIES, CHAIN_ID, EXPLORER } from "@/lib/config";
import { withTimeout } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Mandate ${id}, the full record | Mandate`,
    description: `Every measurement mandate ${id} was settled against, committed on chain before the outcome was known, with the command that re-derives them.`,
  };
}

interface EpochRead {
  e: number;
  att: Awaited<ReturnType<typeof readEpochAttestation>> | null;
  prev: Awaited<ReturnType<typeof previousMark>> | null;
  implied: bigint | null;
}

/** A panel that is still reading. A hairline pulse, never a spinner. */
function PendingPanel({ title }: { title: string }) {
  return (
    <section className="ac-part" aria-busy="true">
      <div className="ac-part__head">
        <h2 className="k-h3">{title}</h2>
        <p className="k-small">Scanning event logs. This can take a few seconds.</p>
      </div>
      <Reading label="Scanning event logs" rows={3} />
    </section>
  );
}

/**
 * The life of the mandate, in the order it happened.
 *
 * Each row is an event the chain recorded, with the transaction that did it. A
 * mandate is a sequence of occurrences, not a performance figure, and the
 * figure would rest on these rows anyway, so the rows are what is published.
 */
async function Life({
  mandateId,
  mandate: m,
  opening,
  epochs,
}: {
  mandateId: number;
  mandate: Awaited<ReturnType<typeof readMandate>>;
  opening: Awaited<ReturnType<typeof readOpenAttestation>> | null;
  epochs: EpochRead[];
}) {
  const n = mandateId;
  // Capped: a log scan with no deadline holds the response open indefinitely.
  const career = await withTimeout(
    readCareerForWallet(m.agent).catch(() => null),
    20_000,
  );
  const settledHere = (career?.epochs ?? []).filter((x) => x.mandateId === n);
  const dismissedHere = (career?.dismissals ?? []).filter((x) => x.mandateId === n);

  const events: LedgerEvent[] = [];
  if (opening) {
    events.push({
      at: Number(opening.takenAt) * 1000,
      block: opening.blockNumber,
      title: "Opening mark taken",
      figure: `${bnb(opening.valuationWei)} BNB`,
      note: `Committed as ${opening.observationHash.slice(0, 18)}… before any outcome existed`,
    });
    events.push({
      at: Number(opening.takenAt) * 1000,
      block: opening.blockNumber,
      title: "Capital escrowed",
      figure: `${bnb(m.capital)} BNB`,
    });
    if (m.bond > 0n) {
      events.push({
        at: Number(opening.takenAt) * 1000,
        block: opening.blockNumber,
        title: "Bond posted by holder",
        figure: `${bnb(m.bond)} BNB`,
        note: m.agent,
      });
    }
  }
  for (const { e, att, implied } of epochs) {
    const settled = settledHere.find((x) => x.epoch === e);
    const slashed = settled ? BigInt(settled.slashedWei) : 0n;
    const alpha = settled ? Number(settled.alphaBps) : implied === null ? null : Number(implied);
    events.push({
      at: att ? Number(att.takenAt) * 1000 : null,
      block: att?.blockNumber ?? settled?.blockNumber,
      title: `Epoch ${e} settled`,
      figure: alpha === null ? "none" : pct(alpha),
      // Zero alpha is neither a gain nor a loss and takes the neutral ink; a
      // loss is shown as a loss, softly, never as an alarm.
      tone:
        alpha === null || alpha === 0
          ? null
          : alpha > 0
            ? "var(--c-accent-hi)"
            : "#ff9aa8",
      flag:
        slashed > 0n
          ? `slashed ${bnb(slashed)}`
          : settled && BigInt(settled.feePaidWei) > 0n
            ? `fee ${bnb(BigInt(settled.feePaidWei))}`
            : null,
      txHash: settled?.txHash ?? null,
      note: att
        ? `Against mark ${att.observationHash.slice(0, 18)}… at block ${att.blockNumber}`
        : "No attestation stored for this epoch",
    });
  }
  for (const d of dismissedHere) {
    events.push({
      block: d.blockNumber,
      title: "Holder dismissed",
      figure: "bond forfeit",
      tone: "var(--c-err)",
      flag: "dismissed",
      txHash: d.txHash,
      note: d.reason || "no reason recorded",
    });
  }

  return (
    <>
      <section className="ac-part" aria-labelledby="life-title">
        <div className="ac-part__head">
          <h2 id="life-title" className="k-h3">
            What happened, in order
          </h2>
          <p className="k-small">{m.lastSettledAt ? `Last settled ${new Date(m.lastSettledAt * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC. ` : ""}Each row is an event the chain recorded, with the transaction that did it.</p>
        </div>
        <Ledger events={events} />
        {career && !career.logsRead ? (
          <p className="k-small">No provider would serve the log range, so the transactions behind these epochs could not be listed. The attestations below are contract storage and are complete.</p>
        ) : null}
      </section>

      {epochs.length ? (
        <section className="ac-part" aria-labelledby="marks-title">
          <div className="ac-part__head">
            <h2 id="marks-title" className="k-h3">
              What the marks imply
            </h2>
            <p className="k-small">Recomputed here from the two commitments.</p>
          </div>
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>Hour</th>
                  <th className="ac-r">Previous mark</th>
                  <th className="ac-r">This mark</th>
                  <th className="ac-r">Implied</th>
                  <th className="ac-r">Settled</th>
                </tr>
              </thead>
              <tbody>
                {epochs.map(({ e, att, prev, implied }) => {
                  const settled = settledHere.find((x) => x.epoch === e);
                  return (
                    <tr key={e}>
                      <td className="k-table__main">{e}</td>
                      <td className="ac-r">{prev ? bnb(prev.valuationWei) : "none"}</td>
                      <td className="ac-r">{att ? bnb(att.valuationWei) : "none"}</td>
                      <td className="ac-r">{implied === null ? "none" : pct(implied)}</td>
                      <td className="ac-r">{settled ? pct(Number(settled.alphaBps)) : "none"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="k-small">The two right-hand columns are computed independently: the implied figure is this page&rsquo;s arithmetic over the committed marks, the settled figure is what the contract wrote. Their agreeing is the check.</p>
        </section>
      ) : null}
    </>
  );
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

  /*
    One row per settled epoch, each against the mark before it.

    Read in parallel. Sequentially this was two round trips per epoch against a
    free provider, and the page took eighteen seconds to paint for a mandate
    with a handful of epochs behind it.
  */
  const epochs = await Promise.all(
    Array.from({ length: m.epochsSettled }, async (_, e) => {
      const [att, prev] = await Promise.all([
        readEpochAttestation(n, e).catch(() => null),
        previousMark(n, e).catch(() => null),
      ]);
      const implied =
        att && prev && prev.valuationWei > 0n
          ? (att.valuationWei * 10_000n) / prev.valuationWei - 10_000n
          : null;
      return { e, att, prev, implied };
    }),
  );

  const bucket = bucketName();
  const gwUrl = (epoch: number | "open") =>
    `https://greenfield-sp.lumibot.org:443/view/${bucket}/${objectName(n, epoch)}`;

  /*
    The life of the mandate, in the order it happened.

    Each row is an event the chain recorded, with the transaction that did it.
    A mandate is a sequence of occurrences, not a performance figure, and the
    figure would rest on these rows anyway, so the rows are what is published.
  */
  const attestations: AttestationView[] = [
    ...(opening
      ? [
          {
            epoch: "open" as const,
            observationHash: opening.observationHash,
            valuationWei: opening.valuationWei,
            blockNumber: opening.blockNumber,
            takenAt: Number(opening.takenAt) * 1000,
            breakdownUrl: gwUrl("open"),
          },
        ]
      : []),
    ...epochs
      .filter((x) => x.att)
      .map((x) => ({
        epoch: x.e,
        observationHash: x.att!.observationHash,
        valuationWei: x.att!.valuationWei,
        blockNumber: x.att!.blockNumber,
        takenAt: Number(x.att!.takenAt) * 1000,
        breakdownUrl: gwUrl(x.e),
      })),
  ];

  const job = CATEGORIES[m.category] ?? null;
  const alpha = Number(m.cumulativeAlphaBps);

  return (
    <AppShell>
      <ReceiptHead
        kind={`Mandate ${n}, the full record`}
        title={`${CATEGORY_NAMES[m.category] ?? "Mandate"}, job #${n}`}
        status={STATE_NAMES[m.state] ?? `State ${m.state}`}
        tone={m.state === 1 ? "live" : m.state === 0 ? "warn" : "neutral"}
        job={job}
        seed={`job:${n}`}
        pose={m.state === 1 ? "working" : m.state === 0 ? "ready" : "dozing"}
        views={[
          { href: `/receipts/${n}`, label: "Receipt" },
          { href: `/mandate/${n}`, label: "The full record", current: true },
        ]}
      >
        <div className="k-figs ac-rh__figs k-rise" style={{ ["--i" as string]: 5 }}>
          <div className="k-fig">
            <span className="k-fig__n">{bnb(m.capital)}</span>
            <span className="k-fig__l">BNB capital</span>
          </div>
          <div className="k-fig">
            <span className="k-fig__n">{bnb(m.bond)}</span>
            <span className="k-fig__l">BNB bond at risk</span>
          </div>
          <div className="k-fig">
            <span className="k-fig__n">
              {m.epochsSettled}/{m.epochsTotal}
            </span>
            <span className="k-fig__l">hours settled</span>
          </div>
          <div className={`k-fig ${alpha > 0 ? "ac-up" : alpha < 0 ? "ac-down" : ""}`}>
            <span className="k-fig__n">{pct(m.cumulativeAlphaBps)}</span>
            <span className="k-fig__l">against the benchmark</span>
          </div>
          <div className="k-fig">
            <span className="k-fig__n">{m.strikes}</span>
            <span className="k-fig__l">strikes</span>
          </div>
        </div>
      </ReceiptHead>

      <div className="k-wrap ac-rbody ac-rbody--full">
        <ReceiptPaper
          title="The terms"
          note="Read from the contract as this page renders."
          rows={[
            {
              k: "Held by",
              v: (
                <a className="k-link k-mono ac-break" href={`${EXPLORER}/address/${m.agent}`} rel="noreferrer" target="_blank">
                  {m.agent}
                </a>
              ),
            },
            {
              k: "For",
              v: (
                <a className="k-link k-mono" href={`${EXPLORER}/address/${m.principal}`} rel="noreferrer" target="_blank">
                  {m.principal.slice(0, 14)}…
                </a>
              ),
            },
            { k: "Tolerance", v: <span className="k-num">{m.toleranceBps} bps</span> },
            { k: "Fee", v: <span className="k-num">{m.feeBps} bps of positive alpha</span> },
            { k: "Slash", v: <span className="k-num">{m.slashBps} bps of the bond per failing hour</span> },
          ]}
        />

        <div className="ac-rbody__side">
          {/*
            The ledger and the settled-alpha column both come from an event log
            scan, which against a free provider is the whole cost of this page,
            eighteen seconds for a mandate with a few epochs behind it. The
            attestations are contract reads and arrive at once, so they are not
            made to wait behind the logs.
          */}
          <Suspense fallback={<PendingPanel title="What happened, in order" />}>
            <Life mandateId={n} mandate={m} opening={opening} epochs={epochs} />
          </Suspense>

          <Attestation attestations={attestations} mandateId={n} chainId={CHAIN_ID} />

          <ReceiptPart title="Who takes over" note={`${bids.length} ${bids.length === 1 ? "bid" : "bids"} in the queue, waiting or already spent.`}>
            {bids.length ? (
              <>
                <p className="k-small">If the agent holding it is dismissed, one of these takes the mandate in the same transaction. Each has its own capital escrowed against the target it is committing to.</p>
                <div className="k-table-wrap">
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th className="ac-r">Bond</th>
                        <th className="ac-r">Target</th>
                        <th>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bids.map((b, i) => (
                        <tr key={`${b.agent}-${i}`}>
                          <td>
                            <a className="k-link k-mono" href={`${EXPLORER}/address/${b.agent}`} rel="noreferrer" target="_blank">
                              {b.agent.slice(0, 16)}…
                            </a>
                          </td>
                          <td className="ac-r">{bnb(b.bond)}</td>
                          <td className="ac-r">{pct(b.targetAlphaBps)}</td>
                          <td>{b.spent ? "promoted or withdrawn" : "waiting"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="k-small">Nobody is waiting to take this mandate. A dismissal here would return the capital rather than hand it on.</p>
            )}
          </ReceiptPart>
        </div>
      </div>
    </AppShell>
  );
}
