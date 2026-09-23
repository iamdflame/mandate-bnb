"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { formatEther, parseEther } from "viem";
import { marketChain } from "@/lib/chain/market";
import { useWallet, sendMarketTx, type TxState } from "@/lib/chain/wallet";
import type { MarketMandate } from "@/lib/market/market-state";

/**
 * One job waiting for an agent, as a card: what it is, what it pays against,
 * what an agent must stake, how long it runs, and how many have bid.
 *
 * The bid itself is the same contract call the old board made, with the same
 * refusals, now one click away inside the card rather than a form on every
 * row. The bond is described plainly because it is the whole disclosure: it
 * is money an agent loses, a quarter at a time, for falling behind.
 */

const bnb = (wei: bigint | string, dp = 4) => `${Number(formatEther(BigInt(wei))).toFixed(dp)} BNB`;

export default function JobTile({ m, art, title, viewHref }: { m: MarketMandate; art: ReactNode; title: string; viewHref: string }) {
  const { address, ready, available, connect, switchChain, balanceWei } = useWallet();
  const [target, setTarget] = useState("200");
  const [bond, setBond] = useState("");
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const floorWei = m.requiredBondWei ? BigInt(m.requiredBondWei) : null;
  const floor = floorWei ? Number(formatEther(floorWei)) : null;
  // A little over the floor by default, so a rounding difference between what
  // we read and what the contract recomputes can never refuse the bid.
  const suggested = floor ? (floor * 1.05).toFixed(6) : "";
  const value = bond.trim() === "" ? suggested : bond;
  const valueNum = Number(value);
  const targetNum = Number(target);
  const bids = m.bids.filter((b) => !b.spent).length;

  const refusal = (() => {
    if (!Number.isFinite(targetNum)) return "The target has to be a number, in basis points.";
    if (targetNum < 0) return "A negative target is a promise to lose money; the contract refuses it.";
    if (targetNum > 32_767) return "That target does not fit in the field the contract stores it in.";
    if (!Number.isFinite(valueNum) || valueNum <= 0) return "Enter the bond you are staking.";
    if (floor !== null && valueNum < floor) return `The contract requires at least ${floor.toFixed(6)} BNB on this job. Anything less is rejected.`;
    if (balanceWei !== null && parseEther(value as `${number}`) > balanceWei) return "This wallet does not hold that much BNB, and gas is on top of it.";
    return null;
  })();

  const submit = async () => {
    if (!address || refusal) return;
    try {
      await sendMarketTx(address, "bid", [BigInt(m.id), Math.round(targetNum), 0n, 0n], parseEther(value as `${number}`), setTx);
    } catch {
      /* the phase carries it */
    }
  };

  return (
    <article className="x-job">
      <div className="x-job__art">
        {art}
        <span className="x-job__open">
          <span className="x-status__dot" aria-hidden="true" />
          Open
        </span>
      </div>
      <div className="x-job__body">
        <h3 className="x-job__t">{title}</h3>
        <dl className="x-job__facts">
          <div>
            <dt>Capital</dt>
            <dd className="x-mono">{bnb(m.capitalWei)}</dd>
          </div>
          <div>
            <dt>Bond required</dt>
            <dd className="x-mono">{floorWei ? bnb(floorWei, 5) : "Not read"}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{m.epochsTotal} hours</dd>
          </div>
          <div>
            <dt>Bids</dt>
            <dd>{bids}</dd>
          </div>
        </dl>

        <div className="x-job__act">
          <Link href={viewHref} className="x-btn x-btn--sm x-btn--ghost">
            View job
          </Link>
          <details className="x-job__bid">
            <summary className="x-btn x-btn--sm x-btn--primary">Bid</summary>
            <div className="x-job__form">
              {tx.phase === "confirmed" ? (
                <p className="x-pay__ok">
                  Bid placed.{" "}
                  <a className="x-link" href={`${marketChain.blockExplorers?.default.url}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                    View it
                  </a>
                  . The buyer decides from here.
                </p>
              ) : !available ? (
                <p className="x-pay__what">Bidding stakes real BNB, so it needs a wallet. There is none in this browser.</p>
              ) : !address ? (
                <button className="x-btn x-btn--primary x-btn--block" type="button" onClick={() => void connect()}>
                  Connect wallet
                </button>
              ) : !ready ? (
                <button className="x-btn x-btn--primary x-btn--block" type="button" onClick={() => void switchChain()}>
                  Switch to {marketChain.name}
                </button>
              ) : (
                <>
                  <label className="x-field">
                    <span className="x-field__l">You will beat the benchmark by (basis points an hour)</span>
                    <input className="x-input x-mono" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} />
                    <span className="x-pay__note">{Number.isFinite(targetNum) ? `${(targetNum / 100).toFixed(2)}% an hour.` : "A whole number of basis points."}</span>
                  </label>
                  <label className="x-field">
                    <span className="x-field__l">Your bond, in BNB</span>
                    <input className="x-input x-mono" inputMode="decimal" placeholder={suggested} value={bond} onChange={(e) => setBond(e.target.value)} />
                    <span className="x-pay__note">A quarter is taken for each hour you fall behind. Returned in full if you serve the term.</span>
                  </label>
                  {refusal ? <p className="x-pay__err">{refusal}</p> : null}
                  {tx.phase === "failed" ? <p className="x-pay__err">{tx.error}</p> : null}
                  <button
                    className="x-btn x-btn--primary x-btn--block"
                    type="button"
                    disabled={Boolean(refusal) || tx.phase === "signing" || tx.phase === "pending"}
                    onClick={() => void submit()}
                  >
                    {tx.phase === "signing" ? "Waiting for your wallet…" : tx.phase === "pending" ? "Placing the bid…" : `Stake ${valueNum ? valueNum.toFixed(6) : "0"} BNB and bid`}
                  </button>
                </>
              )}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
