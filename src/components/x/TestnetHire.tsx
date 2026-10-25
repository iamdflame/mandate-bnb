"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, encodeFunctionData, fallback, formatUnits, http, parseEventLogs, type Address, type Hash, type Hex } from "viem";
import { bscTestnet } from "viem/chains";
import { Check, Loader2 } from "lucide-react";
import { readableError, useWallet } from "@/lib/chain/wallet";
import { COMMERCE_ABI, DELIVERY_SECONDS, ESCROW_TESTNET, POLICY_ABI, ROUTER_ABI, TOKEN_ABI } from "@/lib/escrow/contracts";
import { canBatch, NotBatchable, sendBatch } from "@/lib/escrow/batch";
import { track } from "@/lib/ops/funnel-client";
import OpenInWallet from "./OpenInWallet";
import { PasskeyStart } from "./Passkey";
import { FAUCET, toTestnet } from "./TestnetPack";

const GAS = 1_000_000_000_000_000n;
const EXPLORER = "https://testnet.bscscan.com";

type Phase = "idle" | "quoting" | "signing" | "confirming" | "recording" | "done" | "failed";
type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
const eth = (): Eth | null => (typeof window === "undefined" ? null : ((window.ethereum as unknown as Eth | undefined) ?? null));

/**
 * Hires one other builder's agent on BNB Smart Chain testnet, from its card.
 *
 * The agent signs a quote for the testnet kernel; our quote route checks the
 * signature against the wallets its testnet registration names and hands back
 * that quote as the job's description, with "via mandatemarkets.com" inside
 * the signed task. The buyer's wallet opens, binds, budgets and funds the job
 * in test $U (one confirmation where the wallet can batch), we take it on
 * after reading every fact from the chain, and the agent delivers its own work.
 */
export default function TestnetHire({ tokenId, name, price }: { tokenId: string; name: string; price: string }) {
  const { address, available, chainId, connect, connectError } = useWallet();
  const onTestnet = chainId === 97;
  const reader = useMemo(() => createPublicClient({ chain: bscTestnet, transport: fallback([http("https://bsc-testnet-rpc.publicnode.com"), http("https://data-seed-prebsc-1-s1.bnbchain.org:8545")]) }), []);
  const [open, setOpen] = useState(false);
  const [tbnb, setTbnb] = useState<bigint | null>(null);
  const [u, setU] = useState<bigint | null>(null);
  const [batch, setBatch] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<{ id: string; status: string } | null>(null);
  const cost = BigInt(price);
  const label = `${formatUnits(cost, 18)} test $U`;

  const readBalances = useCallback(() => {
    if (!address) return;
    reader.getBalance({ address }).then(setTbnb).catch(() => undefined);
    reader.readContract({ address: ESCROW_TESTNET.paymentToken, abi: TOKEN_ABI, functionName: "balanceOf", args: [address] }).then((v) => setU(v as bigint)).catch(() => undefined);
  }, [address, reader]);

  useEffect(() => {
    if (!open) return;
    readBalances();
    if (address && onTestnet) void canBatch(address, 97).then(setBatch);
  }, [open, address, onTestnet, readBalances]);

  const poll = useCallback(async (id: string) => {
    for (let i = 0; i < 150; i++) {
      const s = await fetch(`/api/escrow/testnet/jobs/${id}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((r) => String(r?.data?.status ?? "FUNDED"))
        .catch(() => "FUNDED");
      setJob({ id, status: s });
      if (s === "COMPLETED" || s === "REJECTED" || s === "EXPIRED") return;
      await new Promise((ok) => setTimeout(ok, 6_000));
    }
  }, []);

  const run = async () => {
    if (!address) return;
    setError(null);
    setPhase("quoting");
    track("open", `97:${tokenId}`);
    try {
      // A fresh signed quote, checked by us before anything is signed.
      const qr = await fetch("/api/escrow/testnet/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenId, wallet: address }) });
      const qj = (await qr.json()) as { data?: { provider: Address; price: string; description: string }; error?: string };
      if (!qr.ok || !qj.data) throw new Error(qj.error ?? "The agent did not quote just now. Try again in a minute.");
      const q = qj.data;
      const budget = BigInt(q.price);
      const [disputeWindow, counter, allowance] = await Promise.all([
        reader.readContract({ address: ESCROW_TESTNET.policy, abi: POLICY_ABI, functionName: "disputeWindow" }) as Promise<bigint>,
        reader.readContract({ address: ESCROW_TESTNET.commerce, abi: COMMERCE_ABI, functionName: "jobCounter" }) as Promise<bigint>,
        reader.readContract({ address: ESCROW_TESTNET.paymentToken, abi: TOKEN_ABI, functionName: "allowance", args: [address, ESCROW_TESTNET.commerce] }) as Promise<bigint>,
      ]);
      const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + BigInt(DELIVERY_SECONDS);
      const openJob = encodeFunctionData({ abi: COMMERCE_ABI, functionName: "createJob", args: [q.provider, ESCROW_TESTNET.router, expiredAt, q.description, ESCROW_TESTNET.router] });
      const bind = (id: bigint) => encodeFunctionData({ abi: ROUTER_ABI, functionName: "registerJob", args: [id, ESCROW_TESTNET.policy] });
      const setBudget = (id: bigint) => encodeFunctionData({ abi: COMMERCE_ABI, functionName: "setBudget", args: [id, budget, "0x"] });
      const approve = encodeFunctionData({ abi: TOKEN_ABI, functionName: "approve", args: [ESCROW_TESTNET.commerce, budget] });
      const fund = (id: bigint) => encodeFunctionData({ abi: COMMERCE_ABI, functionName: "fund", args: [id, budget, "0x"] });

      let id: bigint;
      if (batch) {
        // The next job number; if anyone else's job takes it first, the batch is refused whole and nothing moves.
        id = counter + 1n;
        setPhase("signing");
        const hash = await sendBatch(
          address,
          [
            { to: ESCROW_TESTNET.commerce as Address, data: openJob },
            { to: ESCROW_TESTNET.router as Address, data: bind(id) },
            { to: ESCROW_TESTNET.commerce as Address, data: setBudget(id) },
            ...(allowance < budget ? [{ to: ESCROW_TESTNET.paymentToken as Address, data: approve }] : []),
            { to: ESCROW_TESTNET.commerce as Address, data: fund(id) },
          ],
          () => setPhase("confirming"),
          97,
        );
        setPhase("confirming");
        const receipt = await reader.waitForTransactionReceipt({ hash });
        const funded = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobFunded", logs: receipt.logs }).find((l) => l.args.client.toLowerCase() === address.toLowerCase());
        if (!funded) throw new Error("The batch went through, but the job in it was not funded.");
        id = funded.args.jobId;
      } else {
        // One transaction at a time: the job's number read from its own receipt, so no other buyer can take it.
        const e = eth();
        if (!e) throw new Error("No wallet in this browser.");
        const w = createWalletClient({ account: address, chain: bscTestnet, transport: custom(e) });
        const steps = allowance < budget ? 5 : 4;
        let n = 0;
        const send = async (what: string, to: Address, data: Hex) => {
          n += 1;
          setStep(`${what} (${n} of ${steps})`);
          setPhase("signing");
          const hash: Hash = await w.sendTransaction({ to, data });
          setPhase("confirming");
          const r = await reader.waitForTransactionReceipt({ hash });
          if (r.status !== "success") throw new Error(`${what} was undone on chain.`);
          return r;
        };
        const r = await send("Open the job", ESCROW_TESTNET.commerce, openJob);
        const made = parseEventLogs({ abi: COMMERCE_ABI, eventName: "JobCreated", logs: r.logs })[0]?.args.jobId;
        if (made === undefined) throw new Error("The job was opened, but its number could not be read.");
        id = made;
        await send("Bind it to the dispute policy", ESCROW_TESTNET.router, bind(id));
        await send("Set its budget", ESCROW_TESTNET.commerce, setBudget(id));
        if (allowance < budget) await send("Approve the test $U", ESCROW_TESTNET.paymentToken, approve);
        await send("Fund it", ESCROW_TESTNET.commerce, fund(id));
        setStep(null);
      }
      setPhase("recording");
      // Told to us so we check it and tell the agent now. Retried: our node can be a block behind the wallet's.
      for (let i = 0; i < 8; i++) {
        const r = await fetch("/api/escrow/testnet/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jobId: id.toString(), tokenId }) }).catch(() => null);
        if (r?.ok) {
          track("funded", `97:${tokenId}`);
          break;
        }
        if (r && r.status === 409) break;
        await new Promise((ok) => setTimeout(ok, 3_000));
      }
      setPhase("done");
      setJob({ id: id.toString(), status: "FUNDED" });
      readBalances();
      void poll(id.toString());
    } catch (e) {
      setPhase("failed");
      setStep(null);
      const m = e instanceof NotBatchable ? "Your wallet would not take the batch on testnet." : readableError(e);
      setError(`${m.slice(0, 200)} A job already opened refunds its test $U after its deadline.`);
      setBatch(e instanceof NotBatchable ? false : batch);
    }
  };

  if (!open) {
    return (
      <button type="button" className="k-btn k-btn--block" onClick={() => setOpen(true)}>
        Hire free for {label}
      </button>
    );
  }

  const busy = phase === "quoting" || phase === "signing" || phase === "confirming" || phase === "recording";
  const shortGas = tbnb !== null && tbnb < GAS;
  const shortU = u !== null && u < cost;
  const delivered = job && (job.status === "SUBMITTED" || job.status === "COMPLETED");

  return (
    <div className="bd-tnhire" role="group" aria-label={`Hire ${name} on testnet`}>
      {job ? (
        <p className="bd-tnhire__job" role="status">
          <span className="bd-pack__mark" aria-hidden="true">
            {delivered ? <Check size={14} strokeWidth={3} /> : <Loader2 size={14} className="bd-spin" />}
          </span>
          <span>
            Testnet job{" "}
            <a className="k-link k-mono" href={`${EXPLORER}/address/${ESCROW_TESTNET.commerce}#events`} target="_blank" rel="noreferrer">
              #{job.id}
            </a>
            :{" "}
            {job.status === "COMPLETED"
              ? "delivered and settled."
              : delivered
                ? "delivered on chain; settled after its 15-minute dispute window."
                : job.status === "EXPIRED" || job.status === "REJECTED"
                  ? "not delivered; your test $U comes back."
                  : "funded. The agent delivers its own work on chain, usually within minutes."}
          </span>
        </p>
      ) : !available ? (
        <>
          <p className="bd-tnhire__note">Hiring needs a wallet. On a phone, open this page in your wallet app, or make one here with a passkey:</p>
          <OpenInWallet label="Open this page in your wallet app" />
          <PasskeyStart quiet />
        </>
      ) : !address ? (
        <>
          <button type="button" className="k-btn k-btn--primary k-btn--block" onClick={() => void connect().catch(() => undefined)}>
            Connect your campaign wallet
          </button>
          {connectError ? (
            <p className="bd-pack__err" role="alert">
              {connectError}
            </p>
          ) : null}
        </>
      ) : !onTestnet ? (
        <button type="button" className="k-btn k-btn--primary k-btn--block" onClick={() => void toTestnet().catch((e) => setError(readableError(e)))}>
          Switch to BNB Smart Chain testnet
        </button>
      ) : shortGas || shortU ? (
        <p className="bd-tnhire__note">
          This wallet needs a little tBNB for gas and {label}. BNB Chain&apos;s{" "}
          <a className="k-link" href={FAUCET.bot} target="_blank" rel="noreferrer">
            {FAUCET.botHandle}
          </a>{" "}
          sends both; this updates when they arrive.
        </p>
      ) : (
        <button type="button" className="k-btn k-btn--primary k-btn--block" onClick={() => void run()} disabled={batch === null || busy}>
          {phase === "quoting"
            ? "Asking for its signed price…"
            : phase === "signing"
              ? step ? `Confirm in your wallet: ${step}` : "Confirm in your wallet…"
              : phase === "confirming" || phase === "recording"
                ? step ? `Waiting for the chain: ${step}` : "Funding the job…"
                : batch
                  ? `Hire for ${label}, in one confirmation`
                  : `Hire for ${label} (your wallet signs each step)`}
        </button>
      )}
      {error ? (
        <p className="bd-pack__err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
