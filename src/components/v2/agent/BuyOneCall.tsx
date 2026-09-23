"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodeFunctionData, parseAbi, type Address, type Hex } from "viem";
import { useWallet, readableError } from "@/lib/chain/wallet";
import { marketChain, marketClient } from "@/lib/chain/market";
import {
  PAYABLE_ASSETS,
  PERMIT2,
  paymentEnvelope,
  paymentTypedData,
  readRequirements,
  whyUnpayable,
  type Requirement,
} from "@/lib/x402/pay";

/**
 * Buying a single call, in the browser, with the visitor's own wallet.
 *
 * The handshake happens in the order the protocol specifies: ask unpaid, read
 * the price the seller names, sign, ask again carrying the signature. The
 * buyer sends no transaction for an EIP-3009 token (USD1, U): the signature
 * authorises a transfer the seller submits and pays gas for. A seller priced
 * in a token without EIP-3009 (USDT) is paid through Permit2, which needs one
 * approval transaction, for exactly this amount, before the signature.
 *
 * The terms are read and the envelope built by the same code the server uses
 * to pay strangers (lib/x402/pay). This button used to hand-roll x402 v1 and
 * would have failed against every seller that speaks v2, which is most of
 * them. Nothing is signed before the price is on screen.
 */

export type Phase =
  | { at: "idle" }
  | { at: "quoting" }
  | { at: "quoted"; req: Requirement }
  | { at: "approving"; req: Requirement }
  | { at: "signing"; req: Requirement }
  | { at: "settling"; req: Requirement }
  | { at: "done"; body: unknown; tx: string | null }
  | { at: "failed"; why: string };

const ERC20 = parseAbi([
  "function balanceOf(address a) view returns (uint256)",
  "function allowance(address o, address s) view returns (uint256)",
  "function approve(address s, uint256 v) returns (bool)",
]);

/** Atomic units to a readable figure, without a float in the middle. */
function human(atomic: bigint, decimals = 18): string {
  const base = 10n ** BigInt(decimals);
  const whole = atomic / base;
  const frac = (atomic % base).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function symbolOf(r: Requirement): string {
  return PAYABLE_ASSETS[r.asset.toLowerCase()]?.symbol ?? (r.raw.extra as { name?: string } | undefined)?.name ?? "tokens";
}

/**
 * What went wrong, in a sentence.
 *
 * The seller returns the settlement failure verbatim, which for the commonest
 * case is a hundred and eighty characters wrapping the four words that matter.
 */
function sellerError(body: unknown, status: number): string {
  const b = body as { error?: string; detail?: string } | null;
  const detail = `${b?.error ?? ""} ${b?.detail ?? ""}`;
  if (/exceeds balance/i.test(detail)) return "This wallet does not hold enough to cover the call. Nothing was charged.";
  if (/already used|authorization is used/i.test(detail)) return "That authorisation has already been spent. Ask for a fresh price and sign again.";
  if (/invalid signature|does not recover/i.test(detail)) return "The signature did not recover to your address, so the payment was refused.";
  if (/expired|validBefore/i.test(detail)) return "The authorisation expired before it reached the chain. Ask for a price and sign again.";
  if (b?.error) return `The seller refused it: ${String(b.error).slice(0, 200)}`;
  return status === 402 ? "The payment was refused. Nothing was charged." : `The seller answered ${status}.`;
}

/**
 * A refusal in the wallet is the buyer's decision, not an error, and the one
 * thing they want to know after it is that no money moved.
 */
function whyFailed(e: unknown, stage: "approve" | "sign" | "other"): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/User rejected|denied|rejected the request|4001/i.test(raw)) {
    return stage === "approve" ? "You declined the approval. Nothing was charged." : "Your signature was rejected. Nothing was charged.";
  }
  return readableError(e);
}

/** What the drawer around this needs to know, each time the state moves. */
export interface PhaseReport {
  at: Phase["at"];
  tx?: string | null;
  body?: unknown;
  why?: string;
  price?: string;
}

/** Decodes a settlement receipt header, in either of the two spellings. */
function txFrom(res: Answer): string | null {
  const raw = res.header("payment-response") ?? res.header("x-payment-response");
  if (!raw) return null;
  try {
    const d = JSON.parse(atob(raw)) as { transaction?: string; txHash?: string; tx?: string };
    return d.transaction ?? d.txHash ?? d.tx ?? null;
  } catch {
    return null;
  }
}

/** What a call returned, whether it went straight to the seller or through the relay. */
interface Answer {
  status: number;
  header: (name: string) => string | null;
  text: string;
}

export default function BuyOneCall({
  path,
  what,
  method = "GET",
  body,
  tokenId,
  subject,
  onPhase,
  autoQuote = false,
  quiet = false,
}: {
  path: string;
  what: string;
  /** Some sellers (MCP) take the call as a POST with a body; the 402 and the paid call use the same one. */
  method?: "GET" | "POST";
  body?: unknown;
  /**
   * Given for an agent we do not operate: the call then goes through
   * /api/x402/relay, because a seller that sends no CORS headers (Muster) is
   * unreachable from a page, while our own endpoints are called directly.
   */
  tokenId?: string;
  subject?: string;
  /** Called on every state change, so a surrounding flow can show where the payment is. */
  onPhase?: (p: PhaseReport) => void;
  /** Ask for the price as soon as it mounts, for a flow where the buyer already chose to pay. */
  autoQuote?: boolean;
  /** Leave the result to the surrounding flow instead of printing it here. */
  quiet?: boolean;
}) {
  const { address, ready, available, connect, switchChain } = useWallet();
  const [phase, setPhase] = useState<Phase>({ at: "idle" });
  const [balance, setBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [unpayable, setUnpayable] = useState<string | null>(null);

  const send = async (paid?: { header: string; value: string }): Promise<Answer> => {
    if (tokenId) {
      const res = await fetch("/api/x402/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenId, subject, paid }),
      });
      const r = (await res.json()) as { error?: string; status?: number; headers?: Record<string, string>; body?: string };
      if (!res.ok || typeof r.status !== "number") throw new Error(r.error ?? `The relay answered ${res.status}.`);
      const h = r.headers ?? {};
      return { status: r.status, header: (n) => h[n.toLowerCase()] ?? null, text: r.body ?? "" };
    }
    const res = await fetch(path, {
      method,
      headers: {
        accept: "application/json, text/event-stream",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(paid ? { [paid.header]: paid.value } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, header: (n) => res.headers.get(n), text: await res.text() };
  };

  /** Step one: ask unpaid, and read the price the seller names. */
  const quote = useCallback(async () => {
    setPhase({ at: "quoting" });
    setUnpayable(null);
    try {
      const res = await send();
      const text = res.text;
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      if (res.status !== 402) {
        setPhase({ at: "done", body: parsed ?? text, tx: null });
        return;
      }
      const offers = readRequirements(parsed, res.header("payment-required"));
      if (!offers.length) throw new Error("The seller refused payment without naming a price we can read.");
      const req = offers.find((o) => !whyUnpayable(o)) ?? offers[0];
      setUnpayable(whyUnpayable(req));
      setPhase({ at: "quoted", req });

      if (address) {
        const [bal, allow] = await Promise.all([
          marketClient.readContract({ address: req.asset, abi: ERC20, functionName: "balanceOf", args: [address] }).catch(() => null),
          req.method === "permit2"
            ? marketClient.readContract({ address: req.asset, abi: ERC20, functionName: "allowance", args: [address, PERMIT2] }).catch(() => null)
            : Promise.resolve(null),
        ]);
        setBalance(bal as bigint | null);
        setAllowance(allow as bigint | null);
      }
    } catch (e) {
      setPhase({ at: "failed", why: whyFailed(e, "other") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, method, body, address, tokenId, subject]);

  /** Permit2 needs one approval for exactly this amount; the wallet pays that gas. */
  const approve = useCallback(
    async (req: Requirement) => {
      if (!address) return;
      setPhase({ at: "approving", req });
      try {
        const data = encodeFunctionData({ abi: ERC20, functionName: "approve", args: [PERMIT2, req.amount] });
        const hash = (await window.ethereum!.request({
          method: "eth_sendTransaction",
          params: [{ from: address, to: req.asset, data }],
        })) as Hex;
        const receipt = await marketClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
        if (receipt.status !== "success") throw new Error("The approval reverted.");
        setAllowance(req.amount);
        setPhase({ at: "quoted", req });
      } catch (e) {
        setPhase({ at: "failed", why: whyFailed(e, "approve") });
      }
    },
    [address],
  );

  /** Sign the terms with the wallet, and ask again carrying the signature. */
  const pay = useCallback(
    async (req: Requirement) => {
      if (!address) return;
      setPhase({ at: "signing", req });
      try {
        const td = paymentTypedData(req, address as Address);
        const domainType =
          "version" in td.domain
            ? [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
              ]
            : [
                { name: "name", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
              ];
        const signature = (await window.ethereum!.request({
          method: "eth_signTypedData_v4",
          params: [
            address,
            JSON.stringify(
              { types: { EIP712Domain: domainType, ...td.types }, primaryType: td.primaryType, domain: td.domain, message: td.message },
              (_, v) => (typeof v === "bigint" ? v.toString() : v),
            ),
          ],
        })) as Hex;

        setPhase({ at: "settling", req });
        const signed = paymentEnvelope(req, address as Address, signature, td);
        const res = await send({ header: signed.header, value: signed.value });
        const text = res.text;
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        if (res.status >= 400) throw new Error(sellerError(parsed, res.status));
        setPhase({ at: "done", body: parsed, tx: txFrom(res) });
      } catch (e) {
        setPhase({ at: "failed", why: whyFailed(e, "sign") });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [address, path, method, body, tokenId, subject],
  );

  const req = "req" in phase ? phase.req : null;
  const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

  // Report every move to whoever is listening; the ref keeps a new callback from re-reporting.
  const report = useRef(onPhase);
  report.current = onPhase;
  useEffect(() => {
    const price = "req" in phase ? `${human(phase.req.amount)} ${symbolOf(phase.req)}` : undefined;
    report.current?.({
      at: phase.at,
      tx: phase.at === "done" ? phase.tx : undefined,
      body: phase.at === "done" ? phase.body : undefined,
      why: phase.at === "failed" ? phase.why : undefined,
      price,
    });
  }, [phase]);

  const started = useRef(false);
  useEffect(() => {
    if (autoQuote && !started.current) {
      started.current = true;
      void quote();
    }
  }, [autoQuote, quote]);

  if (phase.at === "idle") {
    return (
      <div className="x-pay">
        <p className="x-pay__what">{what}</p>
        <button className="x-btn x-btn--block" onClick={() => void quote()} type="button">
          Ask for a price
        </button>
        <p className="x-pay__note">Nothing is signed until the price is on screen.</p>
      </div>
    );
  }

  if (phase.at === "quoting") return <p className="x-pay__wait">Asking the seller for its current price…</p>;

  if (phase.at === "failed") {
    return (
      <div className="x-pay">
        <p className="x-pay__err" role="alert">
          {phase.why}
        </p>
        <button className="x-btn x-btn--sm" onClick={() => setPhase({ at: "idle" })} type="button">
          Try again
        </button>
      </div>
    );
  }

  if (phase.at === "done") {
    if (quiet) return null;
    return (
      <div className="x-pay">
        <p className="x-pay__ok">
          {phase.tx ? "Paid, and the agent answered. " : "The agent answered. "}
          {phase.tx ? (
            <a className="x-link x-mono" href={`${marketChain.blockExplorers?.default.url}/tx/${phase.tx}`} target="_blank" rel="noreferrer">
              {short(phase.tx)}
            </a>
          ) : null}
        </p>
        <pre className="x-pre">{typeof phase.body === "string" ? phase.body.slice(0, 4000) : JSON.stringify(phase.body, null, 2).slice(0, 4000)}</pre>
        <button className="x-btn x-btn--sm" onClick={() => setPhase({ at: "idle" })} type="button">
          Buy another
        </button>
      </div>
    );
  }

  /* quoted, approving, signing or settling: the price is on screen and a decision is due */
  const sym = symbolOf(req!);
  const price = human(req!.amount);
  const needsApproval = req!.method === "permit2" && allowance !== null && allowance < req!.amount;

  return (
    <div className="x-pay">
      <dl className="x-kv">
        <div>
          <dt>Price now</dt>
          <dd className="x-mono">
            {price} {sym}
          </dd>
        </div>
        <div>
          <dt>You pay in gas</dt>
          <dd>{req!.method === "permit2" ? "One approval, once" : "Nothing"}</dd>
        </div>
        <div>
          <dt>What it buys</dt>
          <dd>{(req!.raw.description as string | undefined) ?? req!.resource?.description ?? "One call"}</dd>
        </div>
      </dl>

      {unpayable ? (
        <p className="x-pay__what">We cannot settle this one for you, because {unpayable}.</p>
      ) : !available ? (
        <p className="x-pay__what">
          There is no wallet in this browser. Install one, or pay the same call over the API with a signed payment header.
        </p>
      ) : !address ? (
        <button className="x-btn x-btn--primary x-btn--block x-btn--lg" onClick={() => void connect()} type="button">
          Connect wallet
        </button>
      ) : !ready ? (
        <button className="x-btn x-btn--primary x-btn--block x-btn--lg" onClick={() => void switchChain()} type="button">
          Switch to {marketChain.name}
        </button>
      ) : balance !== null && balance < req!.amount ? (
        <p className="x-pay__err">
          This wallet holds {human(balance)} {sym} and the call costs {price}. Nothing has been signed.
        </p>
      ) : needsApproval ? (
        <button className="x-btn x-btn--primary x-btn--block x-btn--lg" onClick={() => void approve(req!)} disabled={phase.at !== "quoted"} type="button">
          {phase.at === "approving" ? "Waiting for the approval…" : `Approve exactly ${price} ${sym}`}
        </button>
      ) : (
        <button className="x-btn x-btn--primary x-btn--block x-btn--lg" onClick={() => void pay(req!)} disabled={phase.at !== "quoted"} type="button">
          {phase.at === "signing" ? "Waiting for your signature…" : phase.at === "settling" ? "The seller is settling it…" : `Sign to pay ${price} ${sym}`}
        </button>
      )}

      <p className="x-pay__note">
        {req!.method === "permit2"
          ? "Permit2 moves the tokens on your signature. The approval is for this amount only and this call spends it."
          : "You sign an authorisation. The seller submits the transfer and pays the gas."}
      </p>
    </div>
  );
}
