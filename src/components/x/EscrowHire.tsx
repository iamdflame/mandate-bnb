"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseEventLogs, type Address, type Hash } from "viem";
import { Check, Loader2 } from "lucide-react";
import { marketClient } from "@/lib/chain/market";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";
import OpenInWallet from "./OpenInWallet";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW, POLICY_ABI, ROUTER_ABI, TOKEN_ABI, VIA } from "@/lib/escrow/contracts";

/**
 * Hiring one of our agents through ERC-8183 escrow, from the buyer's own wallet.
 *
 * Five transactions, each shown before it is signed: open the job naming our
 * agent's wallet as provider, bind it to the optimistic policy, set the
 * budget, approve exactly that budget of $U to the escrow, and fund it. The
 * $U sits in the escrow, not with us. Our agent delivers within minutes; the
 * budget is released to it once the policy's dispute window passes, and comes
 * back to the buyer if it does not deliver in time.
 */
export interface EscrowOffer {
  provider: string;
  budget: string;
  tokenId: string;
  name: string;
}

const STEPS = ["Open the job", "Bind it to the policy", "Set the budget", "Approve exactly the budget", "Fund the escrow"] as const;
const days = (s: bigint) => `${Number(s) / 86_400} days`;

export default function EscrowHire({ offer, subject }: { offer: EscrowOffer; subject: string | null }) {
  const { address, ready, connect, switchChain, available } = useWallet();
  const budget = BigInt(offer.budget);
  const [disputeWindow, setDisputeWindow] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [at, setAt] = useState(-1);
  const [jobId, setJobId] = useState<bigint | null>(null);
  const [txs, setTxs] = useState<Hash[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<{ status: string; deliverableUrl: string | null; submitTx?: string | null } | null>(null);

  useEffect(() => {
    marketClient
      .readContract({ address: ESCROW.policy, abi: POLICY_ABI, functionName: "disputeWindow" })
      .then((w) => setDisputeWindow(BigInt(w)))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!address) return;
    marketClient
      .readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [address] })
      .then(setBalance)
      .catch(() => undefined);
  }, [address]);

  // After funding, the job is read back until our agent's submission shows.
  const poll = useCallback(async (id: bigint) => {
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`/api/escrow/jobs/${id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const d = r?.data;
      if (d) {
        setJob({ status: d.status, deliverableUrl: d.deliverableUrl, submitTx: d.record?.submitTx ?? null });
        if (d.status !== "FUNDED") return;
      }
      await new Promise((ok) => setTimeout(ok, 5_000));
    }
  }, []);

  const run = async () => {
    if (!address || disputeWindow === null) return;
    setError(null);
    const hashes: Hash[] = [];
    const step = async (i: number, fn: () => Promise<Hash>) => {
      setAt(i);
      const h = await fn();
      hashes.push(h);
      setTxs([...hashes]);
      return h;
    };
    try {
      const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + BigInt(DELIVERY_SECONDS);
      const about = subject ?? address;
      const description = `${VIA}: ${offer.name} (ERC-8004 #${offer.tokenId}) for ${about}`;
      const created = await step(0, () =>
        sendMarketTx(address, "createJob", [offer.provider as Address, ESCROW.router, expiredAt, description, ESCROW.router], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }),
      );
      const receipt = await marketClient.getTransactionReceipt({ hash: created });
      const log = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: receipt.logs })[0];
      if (!log) throw new Error("The job opened, but its number could not be read from the receipt.");
      const id = log.args.jobId;
      setJobId(id);
      await step(1, () => sendMarketTx(address, "registerJob", [id, ESCROW.policy], undefined, undefined, { address: ESCROW.router, abi: ROUTER_ABI }));
      await step(2, () => sendMarketTx(address, "setBudget", [id, budget, "0x"], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }));
      const allowance = (await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [address, ESCROW.commerce] })) as bigint;
      if (allowance < budget) {
        await step(3, () => sendMarketTx(address, "approve", [ESCROW.commerce, budget], undefined, undefined, { address: ESCROW.paymentToken, abi: TOKEN_ABI }));
      }
      const funded = await step(4, () => sendMarketTx(address, "fund", [id, budget, "0x"], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }));
      setAt(5);
      await fetch("/api/escrow/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: id.toString(), tx: funded, subject }) });
      void poll(id);
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    }
  };

  const short = formatUnits(budget, 18);
  if (!available)
    return (
      <div className="x-escrow">
        <p className="x-escrow__note">A wallet is needed: the escrow is funded from it.</p>
        <OpenInWallet />
      </div>
    );
  if (!address)
    return (
      <button type="button" className="x-btn x-btn--block" onClick={connect}>
        Connect a wallet
      </button>
    );
  if (!ready)
    return (
      <button type="button" className="x-btn x-btn--block" onClick={switchChain}>
        Switch to BNB Smart Chain
      </button>
    );

  return (
    <div className="x-escrow">
      <p className="x-escrow__note">
        {short} $U goes into the ERC-8183 escrow, not to us. {offer.name} delivers within minutes; the $U is released to it{" "}
        {disputeWindow === null ? "after the dispute window" : `${days(disputeWindow)} after it delivers`} unless you dispute, and comes back to you if it does not deliver
        within {DELIVERY_SECONDS / 60} minutes.
      </p>
      <ol className="x-escrow__steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < at || at >= 5 ? "x-escrow__done" : i === at ? "x-escrow__now" : undefined}>
            {i < at || at >= 5 ? <Check size={14} aria-hidden="true" /> : i === at ? <Loader2 size={14} className="x-spin" aria-hidden="true" /> : <span className="x-escrow__n">{i + 1}</span>}
            {s}
            {txs[i] ? (
              <a className="x-link x-mono" href={`https://bscscan.com/tx/${txs[i]}`} target="_blank" rel="noreferrer">
                {txs[i]!.slice(0, 8)}…
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      {at < 0 ? (
        balance !== null && balance < budget ? (
          <p className="x-escrow__err">This wallet holds {formatUnits(balance, 18)} $U; the job needs {short}.</p>
        ) : (
          <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={run} disabled={disputeWindow === null}>
            Fund the job, {short} $U
          </button>
        )
      ) : null}
      {jobId !== null && at >= 5 ? (
        <div className="x-escrow__job" role="status">
          <p>
            Job <span className="x-mono">#{jobId.toString()}</span>:{" "}
            {job?.status === "SUBMITTED" || job?.status === "COMPLETED" ? "delivered." : "funded. Waiting for our agent to deliver…"}
          </p>
          {job?.deliverableUrl ? (
            <p>
              <a className="x-link" href={job.deliverableUrl} target="_blank" rel="noreferrer">
                Read what it delivered
              </a>
              {job.submitTx ? (
                <>
                  {" · "}
                  <a className="x-link x-mono" href={`https://bscscan.com/tx/${job.submitTx}`} target="_blank" rel="noreferrer">
                    submission
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="x-escrow__err">{error}</p> : null}
    </div>
  );
}
