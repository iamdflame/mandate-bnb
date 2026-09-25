"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { Check, Clock } from "lucide-react";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";
import { COMMERCE_ABI, ESCROW } from "@/lib/escrow/contracts";
import RateAgent from "./RateAgent";
import OpenInWallet from "./OpenInWallet";

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
      <div className="x-yours-empty">
        <p className="x-muted">Connect a wallet to see every hire it paid for, each escrowed job, and the agents it registered.</p>
        {available ? (
          <button type="button" className="x-btn x-btn--primary" onClick={connect}>
            Connect wallet
          </button>
        ) : (
          <OpenInWallet />
        )}
      </div>
    );
  }
  if (hires === null) return <p className="x-muted">Reading your hires…</p>;

  const rated = new Set(ratings.map((r) => r.hireTx?.toLowerCase()).filter(Boolean));
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="x-hires">
      {hires.length === 0 ? (
        <div className="x-yours-empty">
          <p className="x-muted">No hires from this wallet yet.</p>
          <Link className="x-btn x-btn--primary" href="/quest">
            Start with the quest
          </Link>
        </div>
      ) : (
        <ul className="x-hires__list">
          {hires.map((h) => {
            const job = h.jobId ? jobs[h.jobId] : undefined;
            const lapsed = job && job.status === "FUNDED" && now > job.expiredAt;
            const symbol = h.asset ? (SYMBOL[h.asset.toLowerCase()] ?? "") : h.kind === "market-job" ? "BNB" : "";
            return (
              <li key={`${h.kind}:${h.tx ?? h.jobId}`} className="x-hire-row">
                <div className="x-hire-row__main">
                  <p className="x-hire-row__t">
                    <Link className="x-link" href={`/agents/${h.agentId}`}>
                      {h.agentName ?? `Agent #${h.agentId}`}
                    </Link>
                    {h.category ? <span className="x-hire-row__job">{JOB_WORD[h.category] ?? h.category}</span> : null}
                  </p>
                  <p className="x-hire-row__d">
                    {h.kind === "paid-call" ? "Paid call" : h.kind === "escrow-job" ? `Escrowed job #${h.jobId}` : `Job #${h.jobId}`}
                    {h.amount ? ` · ${formatUnits(BigInt(h.amount), 18)} ${symbol}` : ""}
                    {h.at ? ` · ${when(h.at)}` : ""}
                  </p>
                </div>
                <div className="x-hire-row__side">
                  {h.onChain ? (
                    <span className="x-hire-row__ok">
                      <Check size={13} aria-hidden="true" /> on chain
                    </span>
                  ) : (
                    <span className="x-hire-row__wait">
                      <Clock size={13} aria-hidden="true" /> confirming
                    </span>
                  )}
                  {h.tx ? (
                    <a className="x-link x-mono" href={`https://bscscan.com/tx/${h.tx}`} target="_blank" rel="noreferrer">
                      {shortTx(h.tx)}
                    </a>
                  ) : null}
                  {job?.deliverableUrl ? (
                    <a className="x-link" href={job.deliverableUrl} target="_blank" rel="noreferrer">
                      delivery
                    </a>
                  ) : null}
                  {job ? <span className="x-hire-row__job">{job.status.toLowerCase()}</span> : null}
                </div>
                {lapsed ? (
                  <button type="button" className="x-btn x-btn--sm" onClick={() => refund(h.jobId!)} disabled={refunding === h.jobId}>
                    {refunding === h.jobId ? "Claiming…" : "Claim your refund"}
                  </button>
                ) : null}
                {h.kind === "paid-call" && h.tx && h.onChain && !rated.has(h.tx.toLowerCase()) ? (
                  <details className="x-hire-row__rate">
                    <summary>Rate this hire</summary>
                    <RateAgent tokenId={h.agentId} name={h.agentName ?? `Agent #${h.agentId}`} category={h.category} hireTx={h.tx} />
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="x-approvals__err">{error}</p> : null}

      {owned.length ? (
        <div className="x-hires__owned">
          <p className="x-hires__h">Agents you registered</p>
          <ul>
            {owned.map((a) => (
              <li key={a.agentId}>
                <Link className="x-link" href={`/agents/${a.agentId}`}>
                  {a.name ?? `Agent #${a.agentId}`}
                </Link>{" "}
                <span className="x-hire-row__job">{a.rungName}</span>{" "}
                <Link className="x-link" href={`/list?id=${a.agentId}`}>
                  what moves it up
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
