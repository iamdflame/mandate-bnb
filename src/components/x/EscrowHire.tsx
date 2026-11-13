"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFunctionData, formatUnits, parseEventLogs, type Address, type Hash } from "viem";
import { Check, Loader2, X } from "lucide-react";
import { marketClient } from "@/lib/chain/market";
import { fmtBnb, sendMarketTx, useWallet } from "@/lib/chain/wallet";
import OpenInWallet from "./OpenInWallet";
import RateAgent from "./RateAgent";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW, outsideDescription, POLICY_ABI, ROUTER_ABI, TOKEN_ABI, VIA } from "@/lib/escrow/contracts";
import { canBatch, NotBatchable, sendBatch } from "@/lib/escrow/batch";
import { claimEscrowRefund } from "@/lib/escrow/refund";
import { planSwap, SWAP_ROUTER_ABI, type SwapPlan } from "@/lib/escrow/pay-with-bnb";
import { PROTOCOLS } from "@/lib/config";
import { track } from "@/lib/ops/funnel-client";

/**
 * Hiring an agent through ERC-8183 escrow, from the buyer's own wallet.
 *
 * Five transactions, each shown before it is signed: open the job naming the
 * agent's wallet as provider, bind it to the optimistic policy, set the
 * budget, approve exactly that budget of $U to the escrow, and fund it. The
 * $U sits in the escrow, not with us or the seller. The agent delivers within
 * minutes; the budget is released to it once the policy's dispute window
 * passes, and comes back to the buyer if it does not deliver in time.
 *
 * For an outside seller the job's description is the JSON its seller reads
 * ({task, service, via}), and once funded our server tells the seller, with
 * what the buyer entered. Its answer is shown here as it gave it.
 */
export interface EscrowOffer {
  provider: string;
  budget: string;
  tokenId: string;
  name: string;
  /** Set for an outside seller that quoted over A2A; null for our own agents. */
  outside: null | { service: string | null; serviceName: string | null; etaSeconds: number | null; /** Answers its task free before a job is paid for (BNB's standard, and our last check got an answer). */ tryable?: boolean };
  /** One of ours: it answers a free try with the same service a paid job runs (/api/try). */
  tryable?: boolean;
}

/** Gas for all five steps with room to spare: they used 0.0000376 BNB at 0.05 gwei on job 56802. */
const GAS_FOR_FIVE = 100_000_000_000_000n;

const STEPS = ["Open the job", "Bind it to the policy", "Set the budget", "Approve exactly the budget", "Fund the escrow"] as const;
const days = (s: bigint) => `${Number(s) / 86_400} days`;

export default function EscrowHire({
  offer,
  subject,
  inputs = {},
  category = null,
}: {
  offer: EscrowOffer;
  subject: string | null;
  /** What the buyer entered, for an outside seller. */
  inputs?: Record<string, string>;
  category?: string | null;
}) {
  const { address, ready, connect, connectError, switchChain, available } = useWallet();
  const budget = BigInt(offer.budget);
  const [disputeWindow, setDisputeWindow] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [bnb, setBnb] = useState<bigint | null>(null);
  const [at, setAt] = useState(-1);
  const [jobId, setJobId] = useState<bigint | null>(null);
  // Each step's transaction, by the step's own number: a skipped approval must not shift the ones after it.
  const [txs, setTxs] = useState<Partial<Record<number, Hash>>>({});
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [failedAt, setFailedAt] = useState<number | null>(null);
  /*
    What is already on chain, kept across a retry. A buyer who rejects step
    three has an open job already; trying again carries on from step three on
    that job rather than opening, and paying gas for, a second one.
  */
  const progress = useRef<{
    id: bigint | null;
    expiredAt: bigint | null;
    steps: Set<number>;
    /** An outside agent's live quote: who to name, what to fund, the description it signed, and until when it stands. */
    quote: { provider: Address; price: bigint; description: string; expiresAt: number | null } | null;
    /** A price the buyer has seen and accepted, when the live quote differs from the listed one. */
    accepted: bigint | null;
  }>({ id: null, expiredAt: null, steps: new Set(), quote: null, accepted: null });
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<{ status: string; deliverableUrl: string | null; submitTx?: string | null; settleTx?: string | null; expiredAt?: number | null; answer?: unknown; verified?: boolean | null } | null>(null);
  const [refunding, setRefunding] = useState<"sending" | "failed" | null>(null);
  const [fundTx, setFundTx] = useState<Hash | null>(null);
  // This wallet sends the five steps as one atomic batch: one confirmation instead of five.
  const [batch, setBatch] = useState(false);
  /*
    Short of $U, a buyer can pay the difference in BNB: PancakeSwap swaps
    exactly the shortfall inside the hire (lib/escrow/pay-with-bnb), in the
    same confirmation where the wallet batches. The plan is shown before
    anything is signed and read again at the moment of sending.
  */
  const [withBnb, setWithBnb] = useState(false);
  const [plan, setPlan] = useState<SwapPlan | null>(null);
  const [swapTx, setSwapTx] = useState<Hash | null>(null);
  const [swapping, setSwapping] = useState(false);
  const swapped = useRef(false);

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
    marketClient.getBalance({ address }).then(setBnb).catch(() => undefined);
    void canBatch(address).then(setBatch);
  }, [address]);

  useEffect(() => {
    if (!withBnb || !address || balance === null || balance >= budget) return;
    let gone = false;
    planSwap(marketClient, address, budget - balance)
      .then((p) => !gone && setPlan(p))
      .catch((e: Error) => !gone && setError(`${e.message.slice(0, 160)} Get $U on PancakeSwap instead, or try again.`));
    return () => {
      gone = true;
    };
  }, [withBnb, address, balance, budget]);

  const outside = Boolean(offer.outside);
  // After funding, the job is read back until the agent's submission shows.
  /*
    The funded job, told to us so our agent delivers it and the desk shows it.
    Retried: our node can be a block behind the buyer's wallet and answer that
    the funding is not on chain yet, and a job we never hear about is one a
    buyer paid for and waits on until it lapses.
  */
  const recordBody = useRef<string | null>(null);
  const counted = useRef(false);
  const record = useCallback(async (): Promise<boolean> => {
    if (!recordBody.current) return false;
    for (let i = 0; i < 6; i++) {
      const r = await fetch("/api/escrow/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: recordBody.current }).catch(() => null);
      if (r?.ok) {
        // A funded job counts once toward the hire funnel, however often it is recorded.
        if (!counted.current) track("funded", offer.tokenId);
        counted.current = true;
        return true;
      }
      // A plain refusal will not change on a retry; not-found-yet, too-many and server errors can.
      if (r && r.status >= 400 && r.status < 500 && r.status !== 404 && r.status !== 429) return false;
      await new Promise((ok) => setTimeout(ok, 3_000));
    }
    return false;
  }, [offer.tokenId]);

  const poll = useCallback(async (id: bigint) => {
    /*
      Every five seconds for five minutes, then every half minute for two
      hours: the receipt used to stop reading after five minutes, so a job
      delivered or run out later showed "waiting" for as long as it stayed open.
    */
    for (let i = 0; i < 300; i++) {
      const r = await fetch(`/api/escrow/jobs/${id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      const d = r?.data;
      // Still not on our books half a minute on: tell us again.
      if (d && !d.ours && i % 6 === 5) void record();
      if (d) {
        setJob({ status: d.status, deliverableUrl: d.deliverableUrl, submitTx: d.record?.submitTx ?? null, settleTx: d.record?.settleTx ?? null, expiredAt: d.expiredAt ?? null, answer: d.sellerAnswer ?? null, verified: d.sellerVerified ?? null });
        // An outside seller can submit before its answer reaches us; wait for both.
        // An outside agent's answer counts once it is verified against its on-chain hash, or after two minutes of trying.
        if (d.status !== "FUNDED" && (!outside || d.sellerVerified || (d.sellerAnswer && i > 24))) return;
      }
      await new Promise((ok) => setTimeout(ok, i < 60 ? 5_000 : 30_000));
    }
  }, [outside, record]);

  const run = async () => {
    if (!address || disputeWindow === null) return;
    setError(null);
    setFailedAt(null);
    const d = progress.current;
    let current = -1;
    const step = async (i: number, fn: () => Promise<Hash>) => {
      current = i;
      setAt(i);
      const h = await fn();
      d.steps.add(i);
      setDoneSteps([...d.steps]);
      setTxs((t) => ({ ...t, [i]: h }));
      return h;
    };
    try {
      d.expiredAt ??= BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + BigInt(DELIVERY_SECONDS);
      const about = subject ?? address;
      /*
        An outside agent is asked for its price again now, not from the census:
        an agent on BNB's SDK signs a quote that lasts minutes, and refuses a
        job whose description does not carry it. A price above the one shown
        is put to the buyer before anything is signed.
      */
      if (offer.outside && d.id === null) {
        setAt(0);
        const r = await fetch("/api/escrow/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId: offer.tokenId, inputs }) });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.data) throw new Error(j?.error ?? "The agent's seller did not quote just now.");
        const live = { provider: j.data.provider as Address, price: BigInt(j.data.price), description: String(j.data.description), expiresAt: j.data.expiresAt ?? null };
        if (live.price > budget && d.accepted !== live.price) {
          d.accepted = live.price;
          setAt(-1);
          setError(`The seller's price is now ${formatUnits(live.price, 18)} $U. Press the button again to accept it.`);
          return;
        }
        d.quote = live;
      }
      const cost = d.quote?.price ?? budget;
      const provider = d.quote?.provider ?? (offer.provider as Address);
      // Paying in BNB: the shortfall is read again now, against the final price, and the pool's price with it.
      let swap: SwapPlan | null = null;
      if (withBnb && !swapped.current) {
        const held = (await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [address] })) as bigint;
        if (held < cost) swap = await planSwap(marketClient, address, cost - held);
      }
      // An outside seller reads its task from the description; ours is the line any indexer can match.
      const description = d.quote?.description ?? (offer.outside ? outsideDescription(offer.outside.serviceName ?? offer.name, offer.outside.service, inputs) : `${VIA}: ${offer.name} (ERC-8004 #${offer.tokenId}) for ${about}`);
      /*
        One confirmation, where the wallet batches: all five calls at once,
        naming the job number they will create. Only on a fresh start; a job
        already opened by the steps carries on by the steps.
      */
      if (batch && d.id === null && d.steps.size === 0) {
        if (d.quote?.expiresAt && Math.floor(Date.now() / 1000) > d.quote.expiresAt - 20) {
          d.quote = null;
          throw new Error("The agent's signed quote ran out before you confirmed. Try again for a fresh one.");
        }
        const next = ((await marketClient.readContract({ address: ESCROW.commerce, abi: COMMERCE_ABI, functionName: "jobCounter" })) as bigint) + 1n;
        const allowance = (await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [address, ESCROW.commerce] })) as bigint;
        const calls = [
          // The $U the job is short of, bought with BNB first, so the funding below can spend it.
          ...(swap ? [swap.call] : []),
          { to: ESCROW.commerce as Address, data: encodeFunctionData({ abi: COMMERCE_ABI, functionName: "createJob", args: [provider, ESCROW.router, d.expiredAt, description, ESCROW.router] }) },
          { to: ESCROW.router as Address, data: encodeFunctionData({ abi: ROUTER_ABI, functionName: "registerJob", args: [next, ESCROW.policy] }) },
          { to: ESCROW.commerce as Address, data: encodeFunctionData({ abi: COMMERCE_ABI, functionName: "setBudget", args: [next, cost, "0x"] }) },
          ...(allowance < cost ? [{ to: ESCROW.paymentToken as Address, data: encodeFunctionData({ abi: TOKEN_ABI, functionName: "approve", args: [ESCROW.commerce, cost] }) }] : []),
          { to: ESCROW.commerce as Address, data: encodeFunctionData({ abi: COMMERCE_ABI, functionName: "fund", args: [next, cost, "0x"] }) },
        ];
        current = 0;
        setAt(0);
        let hash: Hash | null = null;
        try {
          hash = await sendBatch(address, calls, () => setAt(4));
        } catch (e) {
          if (!(e instanceof NotBatchable)) throw e;
          // The wallet said it could batch and then would not: the steps, from the start.
          setBatch(false);
        }
        if (hash) {
          const receipt = await marketClient.waitForTransactionReceipt({ hash });
          const fundedLog = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobFunded", logs: receipt.logs }).find((l) => l.args.client.toLowerCase() === address.toLowerCase());
          if (!fundedLog) throw new Error("The batch went through, but no funded job for this wallet is in it. Check My Desk before trying again.");
          // The batch is atomic: a funded job in it means the swap in front of it went through too.
          if (swap) {
            swapped.current = true;
            setSwapTx(hash);
          }
          const id = fundedLog.args.jobId;
          d.id = id;
          [0, 1, 2, 3, 4].forEach((i) => d.steps.add(i));
          setJobId(id);
          setDoneSteps([0, 1, 2, 3, 4]);
          setTxs({ 0: hash, 1: hash, 2: hash, 3: hash, 4: hash });
          setAt(5);
          setFundTx(hash);
          recordBody.current = JSON.stringify(offer.outside ? { jobId: id.toString(), tx: hash, subject, tokenId: offer.tokenId, inputs } : { jobId: id.toString(), tx: hash, subject });
          void record();
          void poll(id);
          return;
        }
      }
      // A wallet that cannot batch signs the swap on its own first; a retry never swaps twice.
      if (swap) {
        setSwapping(true);
        try {
          const h = await sendMarketTx(address, "multicall", [swap.call.deadline, swap.call.inner], swap.call.value, undefined, { address: PROTOCOLS.pancakeSmartRouter as Address, abi: SWAP_ROUTER_ABI });
          swapped.current = true;
          setSwapTx(h);
        } finally {
          setSwapping(false);
        }
      }
      if (d.id === null) {
        const created = await step(0, () =>
          sendMarketTx(address, "createJob", [provider, ESCROW.router, d.expiredAt, description, ESCROW.router], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }),
        );
        const receipt = await marketClient.getTransactionReceipt({ hash: created });
        const log = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: receipt.logs })[0];
        if (!log) throw new Error("The job opened, but its number could not be read from the receipt.");
        d.id = log.args.jobId;
        setJobId(d.id);
      }
      const id = d.id;
      if (!d.steps.has(1)) await step(1, () => sendMarketTx(address, "registerJob", [id, ESCROW.policy], undefined, undefined, { address: ESCROW.router, abi: ROUTER_ABI }));
      if (!d.steps.has(2)) await step(2, () => sendMarketTx(address, "setBudget", [id, cost, "0x"], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }));
      if (!d.steps.has(3)) {
        const allowance = (await marketClient.readContract({ address: ESCROW.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [address, ESCROW.commerce] })) as bigint;
        if (allowance < cost) {
          await step(3, () => sendMarketTx(address, "approve", [ESCROW.commerce, cost], undefined, undefined, { address: ESCROW.paymentToken, abi: TOKEN_ABI }));
        } else {
          // Already approved for at least the budget: nothing to sign.
          d.steps.add(3);
          setDoneSteps([...d.steps]);
        }
      }
      /*
        A signed quote stands for minutes, and the agent checks it at the block
        the job is funded in. Funding after it lapses would lock the budget in
        a job the agent will refuse, so the flow stops here and starts over
        with a fresh quote instead; the unfunded job simply lapses.
      */
      if (d.quote?.expiresAt && Math.floor(Date.now() / 1000) > d.quote.expiresAt - 20) {
        progress.current = { id: null, expiredAt: null, steps: new Set(), quote: null, accepted: null };
        setDoneSteps([]);
        setTxs({});
        setJobId(null);
        throw new Error("The agent's signed quote ran out before the job was funded, so it was not funded. Try again for a fresh quote.");
      }
      const funded = await step(4, () => sendMarketTx(address, "fund", [id, cost, "0x"], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI }));
      setAt(5);
      setFundTx(funded);
      recordBody.current = JSON.stringify(offer.outside ? { jobId: id.toString(), tx: funded, subject, tokenId: offer.tokenId, inputs } : { jobId: id.toString(), tx: funded, subject });
      void record();
      void poll(id);
    } catch (e) {
      // A lapsed quote starts the job over, so the retry begins at step one.
      setFailedAt(progress.current.steps.size === 0 ? 0 : current);
      // Until the fund step confirms, no token has left the buyer's wallet, whatever else was signed.
      setError(`${(e as Error).message.slice(0, 200)} Nothing has left your wallet.`);
    }
  };

  const short = formatUnits(budget, 18);
  const who = offer.outside ? offer.name : "our agent";
  const eta = offer.outside?.etaSeconds ? `in about ${Math.max(1, Math.round(offer.outside.etaSeconds / 60))} minutes` : "within minutes";
  const delivered = job?.status === "SUBMITTED" || job?.status === "COMPLETED";
  const refunded = job?.status === "EXPIRED" || job?.status === "REJECTED";
  // Past its deadline and never delivered: the kernel lets the buyer take the money back.
  const overdue = job?.status === "FUNDED" && Boolean(job.expiredAt) && Date.now() / 1000 > job.expiredAt!;
  if (!available)
    return (
      <div className="x-escrow">
        <p className="x-escrow__note">A wallet is needed: the escrow is funded from it.</p>
        <OpenInWallet />
      </div>
    );
  if (!address)
    return (
      <div className="x-escrow">
        <button type="button" className="x-btn x-btn--block" onClick={() => void connect().catch(() => undefined)}>
          Connect a wallet
        </button>
        {connectError ? (
          <p className="x-escrow__err" role="alert">
            {connectError}
          </p>
        ) : null}
      </div>
    );
  if (!ready)
    return (
      <div className="x-escrow__gate">
        <p className="x-hire__note">Your wallet is on another network. Nothing is signed until you switch.</p>
        {/* A switch the wallet refuses or the person closes is not an error to report. */}
        <button type="button" className="x-btn x-btn--block" onClick={() => void Promise.resolve(switchChain()).catch(() => undefined)}>
          Switch to BNB Smart Chain
        </button>
      </div>
    );

  return (
    <div className="x-escrow">
      <p className="x-escrow__note">
        {short} $U goes into the ERC-8183 escrow, not to {offer.outside ? "the seller or to us" : "us"}. {offer.name} delivers {eta}; the $U is released to it{" "}
        {disputeWindow === null ? "after the dispute window" : `${days(disputeWindow)} after it delivers`} unless you dispute, and comes back to you if it does not deliver
        within {DELIVERY_SECONDS / 60} minutes.
      </p>
      {batch && at < 5 ? <p className="x-escrow__note">Your wallet takes all {withBnb ? "six" : "five"} steps as one confirmation: they happen together or not at all.</p> : null}
      <ol className="x-escrow__steps">
        {withBnb ? (
          <li className={swapTx ? "x-escrow__done" : swapping ? "x-escrow__now" : undefined}>
            {swapTx ? <Check size={14} aria-hidden="true" /> : swapping ? <Loader2 size={14} className="x-spin" aria-hidden="true" /> : <span className="x-escrow__n">0</span>}
            Swap BNB for {plan ? formatUnits(plan.need, 18) : "the"} $U on PancakeSwap
            {swapTx ? (
              <a className="x-link x-mono" href={`https://bscscan.com/tx/${swapTx}`} target="_blank" rel="noreferrer">
                {swapTx.slice(0, 8)}…
              </a>
            ) : null}
          </li>
        ) : null}
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={doneSteps.includes(i) || at >= 5 ? "x-escrow__done" : i === failedAt ? "x-escrow__failed" : i === at ? "x-escrow__now" : undefined}
          >
            {doneSteps.includes(i) || at >= 5 ? (
              <Check size={14} aria-hidden="true" />
            ) : i === failedAt ? (
              <X size={14} aria-hidden="true" />
            ) : i === at ? (
              <Loader2 size={14} className="x-spin" aria-hidden="true" />
            ) : (
              <span className="x-escrow__n">{i + 1}</span>
            )}
            {s}
            {txs[i] ? (
              <a className="x-link x-mono" href={`https://bscscan.com/tx/${txs[i]}`} target="_blank" rel="noreferrer">
                {txs[i]!.slice(0, 8)}…
              </a>
            ) : null}
          </li>
        ))}
      </ol>
      {failedAt !== null ? (
        <>
          {error ? <p className="x-escrow__err">{error}</p> : null}
          <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={run}>
            Try again from step {failedAt + 1}
          </button>
        </>
      ) : null}
      {at < 0 && !swapping ? (
        balance !== null && balance < budget && !withBnb ? (
          <div className="x-escrow__short">
            <p className="x-escrow__err">
              This wallet holds {Number(Number(formatUnits(balance, 18)).toFixed(4))} $U; the job needs {short}.
            </p>
            <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={() => setWithBnb(true)} disabled={bnb !== null && bnb < GAS_FOR_FIVE}>
              Pay the difference in BNB
            </button>
            <p className="x-escrow__note">
              PancakeSwap swaps exactly the $U the job is short of, for at most 2% over its price, {batch ? "in the same confirmation as the job" : "as one more signature before the job"}. Unused BNB comes straight back.{" "}
              <a className="x-link" href={`https://pancakeswap.finance/swap?chain=bsc&outputCurrency=${ESCROW.paymentToken}`} target="_blank" rel="noreferrer">
                Or get $U on PancakeSwap yourself
              </a>
            </p>
          </div>
        ) : bnb !== null && bnb < GAS_FOR_FIVE + (withBnb && plan ? plan.maxIn : 0n) ? (
          <p className="x-escrow__err">
            This wallet holds {fmtBnb(bnb, 5)} BNB.{" "}
            {withBnb && plan ? `The swap takes up to ${fmtBnb(plan.maxIn, 6)} BNB, plus about 0.0001 BNB of gas` : "About 0.0001 BNB of gas covers the five steps"}; add a little BNB on BNB
            Smart Chain first.
          </p>
        ) : withBnb && !plan && !error ? (
          <p className="x-escrow__note">Reading PancakeSwap&apos;s price…</p>
        ) : (
          <>
            {withBnb && !plan && error && failedAt === null ? <p className="x-escrow__err">{error}</p> : null}
            {withBnb && plan ? (
              <p className="x-escrow__note">
                About {fmtBnb(plan.quote, 6)} BNB, at most {fmtBnb(plan.maxIn, 6)}, buys the {formatUnits(plan.need, 18)} $U this wallet is short of. Unused BNB comes straight back.{" "}
                <button
                  type="button"
                  className="x-linkbtn"
                  onClick={() => {
                    setWithBnb(false);
                    setPlan(null);
                  }}
                >
                  Pay in $U instead
                </button>
              </p>
            ) : null}
            <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={run} disabled={disputeWindow === null || (withBnb && !plan)}>
              {withBnb
                ? batch
                  ? `Swap and fund the job, ${short} $U, in one confirmation`
                  : `Swap BNB and fund the job, ${short} $U`
                : batch
                  ? `Fund the job, ${short} $U, in one confirmation`
                  : `Fund the job, ${short} $U`}
            </button>
          </>
        )
      ) : null}
      {jobId !== null && at >= 5 ? (
        <div className="x-escrow__job" role="status">
          <p>
            Job <span className="x-mono">#{jobId.toString()}</span>
          </p>
          {/* The receipt: three lines that fill in as the chain records each one. */}
          <ol className="x-escrow__lines">
            <li data-done="1">
              <Check size={13} strokeWidth={3} aria-hidden="true" /> Paid into escrow
              {fundTx ? (
                <a className="x-link x-mono" href={`https://bscscan.com/tx/${fundTx}`} target="_blank" rel="noreferrer">
                  {fundTx.slice(0, 6)}…{fundTx.slice(-4)}
                </a>
              ) : null}
            </li>
            <li data-done={delivered ? "1" : undefined}>
              {delivered ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : refunded || overdue ? <X size={13} aria-hidden="true" /> : <Loader2 size={13} className="bd-spin" aria-hidden="true" />}{" "}
              {delivered ? "Delivered on chain" : refunded || overdue ? "Not delivered" : `Waiting for ${who} to deliver`}
              {delivered && job?.submitTx ? (
                <a className="x-link x-mono" href={`https://bscscan.com/tx/${job.submitTx}`} target="_blank" rel="noreferrer">
                  {job.submitTx.slice(0, 6)}…{job.submitTx.slice(-4)}
                </a>
              ) : null}
            </li>
            <li data-done={job?.status === "COMPLETED" || refunded ? "1" : undefined}>
              {job?.status === "COMPLETED" || refunded ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <span className="x-escrow__dot" aria-hidden="true" />}{" "}
              {job?.status === "COMPLETED"
                ? `Paid to ${who}`
                : refunded
                  ? "Refunded to your wallet"
                  : overdue
                    ? "Your money is still in escrow. Take it back:"
                    : delivered
                      ? `Paid to ${who} once the dispute window closes`
                      : `Held in escrow. You take it back if ${who} does not deliver`}
              {job?.status === "COMPLETED" && job.settleTx ? (
                <a className="x-link x-mono" href={`https://bscscan.com/tx/${job.settleTx}`} target="_blank" rel="noreferrer">
                  {job.settleTx.slice(0, 6)}…{job.settleTx.slice(-4)}
                </a>
              ) : null}
            </li>
          </ol>
          {overdue && address ? (
            <>
              <button
                type="button"
                className="x-btn x-btn--block"
                disabled={refunding === "sending"}
                onClick={() => {
                  setRefunding("sending");
                  claimEscrowRefund(address as Address, jobId).then(
                    () => {
                      setRefunding(null);
                      void poll(jobId);
                    },
                    () => setRefunding("failed"),
                  );
                }}
              >
                {refunding === "sending" ? "Claiming your refund…" : "Claim your refund"}
              </button>
              {refunding === "failed" ? <p className="x-escrow__err">The refund was not sent. Nothing moved; try again, or claim it from My desk.</p> : null}
            </>
          ) : null}
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
          {job?.answer ? (
            <details className="x-hire__adv" open={delivered}>
              <summary>
                What {offer.name} delivered
                {job.verified ? " · matches the hash it committed on chain" : ""}
              </summary>
              <pre className="x-pre">{JSON.stringify(job.answer, null, 2).slice(0, 6000)}</pre>
            </details>
          ) : null}
          {delivered && fundTx ? <RateAgent tokenId={offer.tokenId} name={offer.name} category={category} hireTx={fundTx} /> : null}
        </div>
      ) : null}
      {error && failedAt === null ? <p className="x-escrow__err">{error}</p> : null}
    </div>
  );
}
