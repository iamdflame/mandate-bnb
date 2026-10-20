import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatEther } from "viem";
import AppShell from "@/components/v2/shell/AppShell";
import None from "@/components/account/None";
import { ReceiptCheck, ReceiptHead, ReceiptPaper, ReceiptPart, ReceiptTape } from "@/components/account/Receipt";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/config";
import { readBook } from "@/lib/chain/book";
import { openAttestation, epochAttestation, alphaBetween } from "@/lib/chain/marketV2";
import { OPERATED_WALLETS } from "@/lib/market/hires";
import { MARKET_V2 } from "@/lib/chain/deployments";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Receipt for job ${id} | Mandate` };
}

const bnb = (w: bigint, dp = 5) => `${Number(formatEther(w)).toFixed(dp)} BNB`;
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;
const STATE = ["waiting for an agent", "running", "finished its term", "cancelled before it started", "ended early"] as const;

/**
 * One job, and everything that has happened to it.
 *
 * The point of a receipt is that it is checkable by somebody who does not
 * trust the person handing it over, so every figure here is read from the
 * chain at request time and every one of them links to the block explorer.
 * Nothing on this page comes from a database.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mandateId = Number(id);
  if (!Number.isInteger(mandateId) || mandateId < 0) notFound();

  const book = await readBook().catch(() => null);
  const row = book?.rows.find(
    (r) => r.id === mandateId && r.deployment.status === "canonical",
  );
  if (!row) notFound();

  const category = CATEGORIES[row.category] ?? null;
  const open = await openAttestation(mandateId).catch(() => null);
  const marks = await Promise.all(
    Array.from({ length: Math.max(0, row.epochsSettled) }, (_, e) =>
      epochAttestation(mandateId, e).catch(() => null),
    ),
  );
  const operated = OPERATED_WALLETS.has(row.agent.toLowerCase());
  const explorer = "https://bscscan.com";

  const tone = row.state === 1 ? "live" : row.state === 0 ? "warn" : "neutral";
  const alpha = row.epochsSettled === 0 ? null : Number(row.cumulativeAlphaBps) / 100;
  const addr = (a: string) => (
    <a className="k-link k-mono" href={`${explorer}/address/${a}`} target="_blank" rel="noreferrer">
      {short(a)}
    </a>
  );

  return (
    <AppShell>
      <ReceiptHead
        kind="Receipt"
        title={`Job #${mandateId}`}
        status={(STATE[row.state] ?? `in state ${row.state}`).replace(/^./, (c) => c.toUpperCase())}
        tone={tone}
        lede={`${bnb(row.capitalWei)} committed to a ${category ? CATEGORY_LABEL[category].toLowerCase() : "mandate"} job.`}
        job={category}
        seed={`job:${mandateId}`}
        pose={row.state === 1 ? "working" : row.state === 0 ? "ready" : "dozing"}
        views={[
          { href: `/receipts/${mandateId}`, label: "Receipt", current: true },
          { href: `/mandate/${mandateId}`, label: "The full record" },
        ]}
      />

      <div className="k-wrap ac-rbody">
        <ReceiptPaper
          title="The terms"
          note="Written into the contract when the job opened."
          rows={[
            { k: "Capital committed", v: <span className="k-num">{bnb(row.capitalWei)}</span>, strong: true },
            { k: <>Agent&rsquo;s bond at risk</>, v: <span className="k-num">{row.bondWei === 0n ? "none yet" : bnb(row.bondWei)}</span> },
            {
              k: "Term",
              v: (
                <span className="ac-term">
                  <span className="ac-run__bar" aria-hidden="true">
                    <span style={{ width: `${row.epochsTotal ? Math.min(100, (row.epochsSettled / row.epochsTotal) * 100) : 0}%` }} />
                  </span>
                  <span className="k-num">
                    {row.epochsSettled} of {row.epochsTotal} hours settled
                  </span>
                </span>
              ),
            },
            {
              k: "Against the benchmark",
              v: alpha === null ? "nothing settled yet" : <span className={`k-num ${alpha >= 0 ? "ac-alpha--up" : "ac-alpha--down"}`}>{alpha.toFixed(2)}%</span>,
              strong: true,
            },
            { k: "Buyer", v: addr(row.principal) },
            { k: "Agent holding it", v: row.agent && !/^0x0+$/.test(row.agent) ? addr(row.agent) : "nobody yet" },
            { k: "Contract", v: addr(MARKET_V2) },
          ]}
        >
          {operated ? <p className="k-small">This job is held by a wallet we operate. It carries a real bond on the same slashing terms as any other agent, and it is not a third party choosing this market. Every row on this site that is ours says so.</p> : null}
          <p className="k-small">
            Measured against <strong>Hold</strong>, which is what the settlement engine can currently derive. For rebalancing and grid trading that is the right yardstick. For yield and loan health it is not, and the figure above should be read as a raw return
            until the other two benchmarks are implemented.
          </p>
        </ReceiptPaper>

        <div className="ac-rbody__side">
          <ReceiptPart title="The marks" note="Every valuation this job has been settled against, committed on chain before the outcome was known.">
            {!open ? (
              <None job={category ?? "rebalancing"} seed={`marks-${mandateId}`} pose="ready">
                <p className="ac-none__claim">No opening mark yet.</p>
                <p className="k-small">The opening valuation is written when the buyer accepts a bid. Until then there is nothing to measure against.</p>
              </None>
            ) : (
              <ReceiptTape
                rows={[
                  {
                    key: "open",
                    t: "Opening mark",
                    d: (
                      <>
                        The agent&rsquo;s wallet valued at <span className="k-num">{bnb(open.valuationWei)}</span> at block{" "}
                        <a className="k-link k-mono" href={`${explorer}/block/${open.blockNumber}`} target="_blank" rel="noreferrer">
                          {open.blockNumber.toString()}
                        </a>
                        . Benchmark set at <span className="k-num">{bnb(open.benchmarkWei)}</span>.
                      </>
                    ),
                  },
                  ...marks.flatMap((m, e) => {
                    if (!m) return [];
                    const prev = e === 0 ? open : marks[e - 1];
                    const a = prev ? alphaBetween(prev, m) : null;
                    return [
                      {
                        key: `h${e}`,
                        t: `Hour ${e + 1}`,
                        tone: (a === null || Number(a) === 0 ? "plain" : Number(a) > 0 ? "up" : "down") as "plain" | "up" | "down",
                        d: (
                          <>
                            Valued at <span className="k-num">{bnb(m.valuationWei)}</span> at block{" "}
                            <a className="k-link k-mono" href={`${explorer}/block/${m.blockNumber}`} target="_blank" rel="noreferrer">
                              {m.blockNumber.toString()}
                            </a>
                            .
                          </>
                        ),
                        fig: a !== null ? `${(Number(a) / 100).toFixed(2)}%` : undefined,
                      },
                    ];
                  }),
                ]}
              />
            )}
          </ReceiptPart>

          <ReceiptCheck commands={[`npx mandate-verify --mandate ${mandateId} --chain 56`]} />
        </div>
      </div>
    </AppShell>
  );
}
