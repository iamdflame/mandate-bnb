"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { Check, Clock } from "lucide-react";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";
import { COMMERCE_ABI, ESCROW } from "@/lib/escrow/contracts";
import RateAgent from "./RateAgent";
import OpenInWallet from "./OpenInWallet";
import Agent from "@/components/characters/Agent";
import None, { Reading } from "@/components/account/None";

interface Hire {
  kind: "paid-call" | "market-job" | "escrow-job";
  agentId: string;
  agentName: string | null;
  category: string | null;
  tx: string | null;
  jobId: string | null;
  amount: string | null;
  asset: string | null;
  completed: boolean;
  onChain: boolean;
  at: string | null;
  sponsored: boolean;
}
interface Rating {
  agentId: string;
  score: number;
  tx: string;
  hireTx: string | null;
}
interface Owned {
  agentId: string;
  name: string | null;
  rungName: string;
  registeredTx: string | null;
}
interface Job {
  status: string;
  expiredAt: number;
  deliverableUrl: string | null;
}

const SYMBOL: Record<string, string> = {
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": "USD1",
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0xce24439f2d9c6a2289f741120fe202248b666666": "$U",
};
const JOB_WORD: Record<string, string> = { "rebalancing": "Rebalancing", "grid-trading": "Grid Trading", "yield-optimisation": "Yield", "health-factor": "Health Factor" };
const shortTx = (t: string) => `${t.slice(0, 8)}…${t.slice(-4)}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

/**
 * The connected wallet's own record: every hire it paid, each escrowed job
 * and what became of it, the ratings it wrote, and the agents it registered.
 * Read from the same tracking API BNB reads, so what a buyer sees here is
 * exactly what counts.
 */
export default function YourHires() {
  const { address, available, connect } = useWallet();
  const [hires, setHires] = useState<Hire[] | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [refunding, setRefunding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    if (!address) return;
    const [h, o] = await Promise.all([
      fetch(`/api/v1/wallets/${address}/hires`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/v1/owners/${address}/agents`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    const list = ((h?.data?.hires ?? []) as Hire[]).filter((x) => !x.sponsored);
    setHires(list);
    setRatings((h?.data?.ratings ?? []) as Rating[]);
    setOwned((o?.data?.agents ?? []) as Owned[]);
    const escrow = list.filter((x) => x.kind === "escrow-job" && x.jobId);
    const read = await Promise.all(
      escrow.map((x) =>
        fetch(`/api/escrow/jobs/${x.jobId}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((r) => [x.jobId!, r?.data as Job] as const)
          .catch(() => null),
      ),
    );
    setJobs(Object.fromEntries(read.filter((x): x is readonly [string, Job] => Boolean(x && x[1]))));
  }, [address]);

  useEffect(() => {
    void read();
  }, [read]);

  const refund = async (jobId: string) => {
    if (!address) return;
    setRefunding(jobId);
    setError(null);
    try {
      await sendMarketTx(address as Address, "claimRefund", [BigInt(jobId)], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI });
      await read();
    } catch (e) {
      setError((e as Error).message.slice(0, 160));
    } finally {
      setRefunding(null);
    }
  };

  if (!address) {
    return (
      <div className="ac-gate">
        <p className="k-small">Connect a wallet to see every hire it paid for, each escrowed job, and the agents it registered.</p>
        {available ? (
          <button type="button" className="k-btn k-btn--sm" onClick={connect}>
            Connect wallet
          </button>
        ) : (
          <OpenInWallet />
        )}
      </div>
    );
  }
  if (hires === null) return <Reading label="Reading your hires…" />;

  const rated = new Set(ratings.map((r) => r.hireTx?.toLowerCase()).filter(Boolean));
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="ac-hires">
      {hires.length === 0 ? (
        <None
          job="rebalancing"
          seed="desk-hires"
          action={
            <Link className="k-btn k-btn--sm" href="/quest">
              Start with the quest
            </Link>
          }
        >
          No hires from this wallet yet.
        </None>
      ) : (
        <ul className="ac-list">
          {hires.map((h, i) => {
            const job = h.jobId ? jobs[h.jobId] : undefined;
            const lapsed = job && job.status === "FUNDED" && now > job.expiredAt;
            const symbol = h.asset ? (SYMBOL[h.asset.toLowerCase()] ?? "") : h.kind === "market-job" ? "BNB" : "";
            return (
              <li key={`${h.kind}:${h.tx ?? h.jobId}`} className="ac-row" data-job={h.category ?? undefined}>
                <span className="ac-row__face" aria-hidden="true">
                  <Agent job={h.category} seed={h.agentId} size={44} state={h.completed ? "delivered" : "working"} slot={`hire${i}`} />
                </span>
                <div className="ac-row__main">
                  <p className="ac-row__t">
                    <Link className="ac-row__name" href={`/agents/${h.agentId}`}>
                      {h.agentName ?? `Agent #${h.agentId}`}
                    </Link>
                    {h.category ? <span className="ac-row__job">{JOB_WORD[h.category] ?? h.category}</span> : null}
                  </p>
                  <p className="ac-row__d">
                    <span>{h.kind === "paid-call" ? "Paid call" : h.kind === "escrow-job" ? `Escrowed job #${h.jobId}` : `Job #${h.jobId}`}</span>
                    {h.amount ? (
                      <span className="k-num ac-row__amt">
                        {formatUnits(BigInt(h.amount), 18)} {symbol}
                      </span>
                    ) : null}
                    {h.at ? <span>{when(h.at)}</span> : null}
                  </p>
                </div>
                <div className="ac-row__side">
                  {h.onChain ? (
                    <span className="k-tag k-tag--ours">
                      <Check size={12} aria-hidden="true" /> on chain
                    </span>
                  ) : (
                    <span className="k-tag k-tag--warn">
                      <Clock size={12} aria-hidden="true" /> confirming
                    </span>
                  )}
                  {job ? <span className="k-tag">{job.status.toLowerCase()}</span> : null}
                  {h.tx ? (
                    <a className="k-link k-mono ac-row__tx" href={`https://bscscan.com/tx/${h.tx}`} target="_blank" rel="noreferrer">
                      {shortTx(h.tx)}
                    </a>
                  ) : null}
                  {job?.deliverableUrl ? (
                    <a className="k-link ac-row__tx" href={job.deliverableUrl} target="_blank" rel="noreferrer">
                      delivery
                    </a>
                  ) : null}
                </div>
                {lapsed ? (
                  <div className="ac-row__act">
                    <button type="button" className={`k-btn k-btn--sm k-btn--primary${refunding === h.jobId ? " k-btn--busy" : ""}`} onClick={() => refund(h.jobId!)} disabled={refunding === h.jobId}>
                      {refunding === h.jobId ? "Claiming…" : "Claim your refund"}
                    </button>
                    <span className="k-small">Nothing was delivered by the deadline, so the money is yours to take back.</span>
                  </div>
                ) : null}
                {(h.kind === "paid-call" || (h.kind === "escrow-job" && h.completed)) && h.tx && h.onChain && !rated.has(h.tx.toLowerCase()) ? (
                  <details className="ac-row__rate">
                    <summary>Rate this hire</summary>
                    <RateAgent tokenId={h.agentId} name={h.agentName ?? `Agent #${h.agentId}`} category={h.category} hireTx={h.tx} />
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="k-note k-note--err">{error}</p> : null}

      {owned.length ? (
        <div className="ac-owned">
          <p className="k-label">Agents you registered</p>
          <ul className="ac-owned__list">
            {owned.map((a) => (
              <li key={a.agentId}>
                <Link className="ac-owned__a" href={`/agents/${a.agentId}`}>
                  {a.name ?? `Agent #${a.agentId}`}
                </Link>
                <span className="k-tag">{a.rungName}</span>
                <Link className="k-link k-small" href={`/list?id=${a.agentId}`}>
                  What moves it up
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
