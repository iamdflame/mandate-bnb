"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, encodeFunctionData, formatEther, formatUnits, parseAbi, parseEther, parseUnits, type Address, type Hex } from "viem";
import { Check, Fingerprint, Loader2, ShieldOff } from "lucide-react";
import Agent from "@/components/characters/Agent";
import { anchors } from "@/components/characters/engine";
import { marketChain, marketClient } from "@/lib/chain/market";
import { useWallet } from "@/lib/chain/wallet";
import OpenInWallet from "./OpenInWallet";
import NeedHelp from "./NeedHelp";

// The same addresses the server's leash policy names; a test holds them equal.
export const USDT: Address = "0x55d398326f99059fF775485246999027B3197955";
export const VUSDT: Address = "0xfD5840Cd36d94D7229439859C0112a4185BC0255";
const ERC20 = parseAbi(["function approve(address,uint256) returns (bool)", "function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const VTOKEN = parseAbi(["function balanceOf(address) view returns (uint256)", "function redeem(uint256) returns (uint256)", "function borrowBalanceStored(address) view returns (uint256)"]);
/** The relay's fees and the KeyStore's registration fee, with room for a few of the agent's own actions. */
const BNB_NEEDED = parseEther("0.002");
const STORE = "mandate:leash-wallet";

type Slug = "yield-1" | "guard-1";
/** Our two agents that can go on a buyer's wallet, as drawn: their job family and their token id. */
const HOUSE: Record<Slug, { job: "yield-optimisation" | "health-factor"; seed: string }> = {
  "yield-1": { job: "yield-optimisation", seed: "344122" },
  "guard-1": { job: "health-factor", seed: "344123" },
};
const AGENTS: Record<Slug, { name: string; line: string }> = {
  "yield-1": { name: "Yield-1", line: "Puts idle USDT in this wallet to work on Venus when Venus pays a rate. What it supplies stays credited to this wallet." },
  "guard-1": { name: "Guard-1", line: "Repays this wallet's own Venus USDT debt when its health factor falls near liquidation." },
};

interface Terms {
  sessionSigner: { address: Address; publicKey: Hex };
  permissions: { calls: { to: Address; signature: string }[]; spend: { limit: string; period: string; token?: Address }[] };
  expiry: number;
  may: string[];
}
interface Run {
  at: string;
  outcome: string;
  reason: string;
  txs: { step: string; tx: string }[];
}
interface Leash {
  id: string;
  slug: Slug;
  dailyUsdt: string;
  expiry: number;
  revokedAt: string | null;
  publicKey: Hex;
  runs: Run[];
}

type Sdk = {
  createClient: (o: { chains: unknown[] }) => SdkClient;
  BNB: unknown;
};
type SdkClient = {
  createPasskeyWallet(o: { name: string }): Promise<{ address: Address; signer: unknown }>;
  recoverFromPasskey(o?: Record<string, unknown>): Promise<{ address: Address; signer: unknown }>;
  execute(o: Record<string, unknown>): Promise<{ transactionHash?: Hex; status: string }>;
  grantSession(o: Record<string, unknown>): Promise<{ publicKey: Hex; transactionHash?: Hex }>;
  revokeSession(o: Record<string, unknown>): Promise<{ transactionHash?: Hex; status: string }>;
};

let clientPromise: Promise<SdkClient> | null = null;
/** The SDK is loaded only when someone starts a leash, so no other page carries its weight. */
const sdkClient = () =>
  (clientPromise ??= import("@altananetwork/sdk").then((m) => {
    const sdk = m as unknown as Sdk;
    return sdk.createClient({ chains: [sdk.BNB] });
  }));

const tx = (h?: string | null) =>
  h ? (
    <a className="k-link k-mono ac-tx" href={`https://bscscan.com/tx/${h}`} target="_blank" rel="noreferrer">
      {h.slice(0, 8)}…
    </a>
  ) : null;

/**
 * A leash on your own wallet, in the order it happens: a passkey wallet the
 * agent can act on and you alone own, the funds you choose to put in it, the
 * limits, and the one signature that grants them. Then what the agent does,
 * and the button that ends it.
 */
export default function LeashWizard({
  initial = "yield-1",
  policy,
}: {
  initial?: Slug;
  /** The words of each agent's call list and its daily relay allowance, from the server's leash policy, for the label. */
  policy?: Record<Slug, { touch: string[]; relay: string }>;
}) {
  const { address: owner, available, connect, ready, switchChain } = useWallet();
  const [slug, setSlug] = useState<Slug>(initial);
  const [pk, setPk] = useState<{ address: Address; signer: unknown } | null>(null);
  const [known, setKnown] = useState<Address | null>(null);
  const [bal, setBal] = useState<{ bnb: bigint; usdt: bigint; vusdt: bigint } | null>(null);
  const [budget, setBudget] = useState("1");
  const [daily, setDaily] = useState("0.5");
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leashes, setLeashes] = useState<Leash[]>([]);
  const [done, setDone] = useState<Record<string, string | null>>({});
  /*
    Whether this browser can make a passkey at all. Several wallet apps' own
    browsers cannot, and there the button would wait on a prompt that never
    comes. "platform" is whether this device has its own fingerprint or face
    unlock; without one a passkey can still live on a phone or a security key.
  */
  const [passkeys, setPasskeys] = useState<"unknown" | "none" | "roaming" | "platform">("unknown");
  useEffect(() => {
    const P = (window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }).PublicKeyCredential;
    if (!P || !navigator.credentials) return setPasskeys("none");
    (P.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? Promise.resolve(false)).then(
      (yes) => setPasskeys(yes ? "platform" : "roaming"),
      () => setPasskeys("roaming"),
    );
  }, []);

  const wallet = pk?.address ?? known;
  useEffect(() => {
    try {
      const w = localStorage.getItem(STORE);
      if (w && /^0x[0-9a-fA-F]{40}$/.test(w)) setKnown(w as Address);
    } catch {
      /* private window: nothing remembered */
    }
  }, []);

  const read = useCallback(async () => {
    if (!wallet) return;
    const [bnb, usdt, vusdt, l] = await Promise.all([
      marketClient.getBalance({ address: wallet }),
      marketClient.readContract({ address: USDT, abi: ERC20, functionName: "balanceOf", args: [wallet] }) as Promise<bigint>,
      marketClient.readContract({ address: VUSDT, abi: VTOKEN, functionName: "balanceOf", args: [wallet] }) as Promise<bigint>,
      fetch(`/api/leash?address=${wallet}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);
    setBal({ bnb, usdt, vusdt });
    setLeashes((l?.data?.leashes ?? []) as Leash[]);
  }, [wallet]);
  useEffect(() => {
    void read();
    const t = setInterval(() => void read(), 12_000);
    return () => clearInterval(t);
  }, [read]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await read();
    } catch (e) {
      const m = (e as Error).message ?? String(e);
      setError(/NotAllowedError|cancel/i.test(m) ? "The passkey prompt was closed, so nothing was signed." : m.split("\n")[0].slice(0, 220));
    } finally {
      setBusy(null);
    }
  };

  const remember = (a: Address) => {
    try {
      localStorage.setItem(STORE, a);
    } catch {
      /* not remembered; the passkey still finds it */
    }
  };
  const create = () =>
    run("create", async () => {
      const w = await (await sdkClient()).createPasskeyWallet({ name: "MANDATE" });
      setPk(w);
      remember(w.address);
    });
  const unlock = () =>
    run("unlock", async () => {
      const w = await (await sdkClient()).recoverFromPasskey();
      setPk(w);
      remember(w.address);
    });

  const eoa = () => createWalletClient({ account: owner as Address, chain: marketChain, transport: custom(window.ethereum as never) });
  const fundBnb = () =>
    run("bnb", async () => {
      const need = bal && bal.bnb < BNB_NEEDED ? BNB_NEEDED - bal.bnb : BNB_NEEDED;
      const h = await eoa().sendTransaction({ to: wallet!, value: need } as never);
      await marketClient.waitForTransactionReceipt({ hash: h });
      setDone((d) => ({ ...d, bnb: h }));
    });
  const fundUsdt = () =>
    run("usdt", async () => {
      const h = await eoa().writeContract({ address: USDT, abi: ERC20, functionName: "transfer", args: [wallet!, parseUnits(budget, 18)] } as never);
      await marketClient.waitForTransactionReceipt({ hash: h });
      setDone((d) => ({ ...d, usdt: h }));
    });

  const grant = () =>
    run("grant", async () => {
      if (!pk) throw new Error("Unlock the wallet with its passkey first.");
      const client = await sdkClient();
      const t = (await fetch(`/api/leash/terms?wallet=${pk.address}&slug=${slug}&daily=${daily}&days=${days}`).then((r) => r.json())) as { data?: Terms; error?: string };
      if (!t.data) throw new Error(t.error ?? "The terms could not be read.");
      // The owner approves Venus for exactly the budget; the session itself can approve nothing.
      const approved = await client.execute({ wallet: pk, signer: pk.signer, calls: [{ to: USDT, data: encodeFunctionData({ abi: ERC20, functionName: "approve", args: [VUSDT, parseUnits(budget, 18)] }) }] });
      setDone((d) => ({ ...d, approve: approved.transactionHash ?? null }));
      // The session names our agent's key; its private half never reaches this browser.
      const sessionSigner = { type: "privateKey", ...t.data.sessionSigner, signDigest: async () => { throw new Error("held by the agent, not here"); } };
      const permissions = { calls: t.data.permissions.calls, spend: t.data.permissions.spend.map((s) => ({ ...s, limit: BigInt(s.limit) })) };
      const g = await client.grantSession({ wallet: pk, signer: pk.signer, permissions, expiry: t.data.expiry, sessionSigner, register: true });
      setDone((d) => ({ ...d, grant: g.transactionHash ?? null }));
      const rec = await fetch("/api/leash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: pk.address, slug, daily: Number(daily), owner }) }).then((r) => r.json());
      if (rec.error) throw new Error(rec.error);
    });

  const revoke = (l: Leash) =>
    run(`revoke:${l.id}`, async () => {
      if (!pk) throw new Error("Unlock the wallet with its passkey first.");
      const r = await (await sdkClient()).revokeSession({ wallet: pk, signer: pk.signer, session: l.publicKey });
      await fetch("/api/leash/revoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: pk.address, slug: l.slug, tx: r.transactionHash }) });
      setDone((d) => ({ ...d, [`revoke:${l.id}`]: r.transactionHash ?? null }));
    });

  const withdraw = () =>
    run("withdraw", async () => {
      if (!pk || !owner) throw new Error("Unlock the wallet and connect the wallet to send it to.");
      const client = await sdkClient();
      const v = (await marketClient.readContract({ address: VUSDT, abi: VTOKEN, functionName: "balanceOf", args: [pk.address] })) as bigint;
      if (v > 0n) await client.execute({ wallet: pk, signer: pk.signer, calls: [{ to: VUSDT, data: encodeFunctionData({ abi: VTOKEN, functionName: "redeem", args: [v] }) }] });
      const u = (await marketClient.readContract({ address: USDT, abi: ERC20, functionName: "balanceOf", args: [pk.address] })) as bigint;
      const bnb = await marketClient.getBalance({ address: pk.address });
      const back = bnb > parseEther("0.0003") ? bnb - parseEther("0.0003") : 0n;
      const calls = [
        ...(u > 0n ? [{ to: USDT, data: encodeFunctionData({ abi: ERC20, functionName: "transfer", args: [owner, u] }) }] : []),
        ...(back > 0n ? [{ to: owner, value: back }] : []),
      ];
      if (calls.length) {
        const r = await client.execute({ wallet: pk, signer: pk.signer, calls });
        setDone((d) => ({ ...d, withdraw: r.transactionHash ?? null }));
      }
    });

  const live = leashes.filter((l) => !l.revokedAt && l.expiry * 1000 > Date.now());
  const ready2 = useMemo(() => {
    const b = Number(budget);
    const d = Number(daily);
    const n = Number(days);
    if (!(b > 0 && d >= 0.01 && d <= 100 && n >= 1 && n <= 30)) return "Set a budget, a daily cap between 0.01 and 100 USDT, and 1 to 30 days.";
    if (d > b) return "The daily cap cannot be more than the budget.";
    if (!bal || bal.bnb < parseEther("0.0012")) return "Add about 0.002 BNB first: it pays the relay and the registry's fee.";
    if (bal.usdt < parseUnits(budget, 18)) return `Add ${budget} USDT to the wallet first.`;
    return null;
  }, [budget, daily, days, bal, slug]);

  const latest = leashes.find((l) => l.slug === slug) ?? null;
  const held = live.find((l) => l.slug === slug) ?? null;
  const stage: "held" | "cut" | "open" = held ? "held" : latest && (latest.revokedAt || done[`revoke:${latest.id}`] !== undefined) ? "cut" : "open";
  const touch = policy?.[slug]?.touch ?? [AGENTS[slug].line];
  const relay = policy?.[slug]?.relay ?? null;
  const step1 = Boolean(wallet);
  const step2 = Boolean(wallet && bal && bal.bnb >= parseEther("0.0012"));
  const step3 = live.some((l) => l.slug === slug);
  const current = !step1 ? 1 : !step2 ? 2 : !step3 ? 3 : 0;
  const stepState = (n: number, ok: boolean) => (ok ? "done" : current === n ? "now" : "next");

  /* The picture of the leash: your passkey wallet, the agent, and the line between them, drawn from this wallet's real state. */
  const who = HOUSE[slug];
  const SIZE = 176;
  const ring = anchors({ job: who.job, seed: who.seed, state: "leashed", house: true, size: SIZE }).ring as [number, number];
  const ax = 330;
  const ay = 70;
  const collar = { x: ax + ((ring[0] - 8) / 104) * SIZE, y: ay + ((ring[1] - 10) / 104) * SIZE };
  const from = { x: 180, y: 150 };
  const line = `M ${from.x} ${from.y} C ${from.x + 70} ${from.y + 60}, ${collar.x - 90} ${collar.y + 70}, ${collar.x} ${collar.y}`;

  const scene = (
    <div className="ac-stage" data-state={stage} data-job={who.job}>
      <div className="ac-stage__box">
        <div className="ac-stage__floor" aria-hidden="true" />
        <div className="ac-stage__wallet">
          <span className="ac-stage__fp" aria-hidden="true">
            <Fingerprint size={22} />
          </span>
          <span className="ac-stage__wt">Your passkey wallet</span>
          <span className="ac-stage__wa k-mono">{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "not made yet"}</span>
          {bal ? (
            <span className="ac-stage__wb k-num">
              {Number(formatEther(bal.bnb)).toFixed(4)} BNB · {Number(formatUnits(bal.usdt, 18)).toFixed(2)} USDT
            </span>
          ) : null}
        </div>
        <svg className="ac-stage__leash" viewBox="0 0 560 300" aria-hidden="true" focusable="false">
          <path className="ac-stage__case" d={line} pathLength={1} />
          <path className="ac-stage__line" d={line} pathLength={1} key={stage} />
          <circle cx={collar.x} cy={collar.y} r="4.5" />
        </svg>
        <div className="ac-stage__agent" style={{ left: `${(ax / 560) * 100}%`, top: `${(ay / 300) * 100}%`, width: `${(SIZE / 560) * 100}%` }}>
          <Agent job={who.job} seed={who.seed} house size={SIZE} state={stage === "held" ? "leashed" : "ready"} omit={["leash"]} slot={`stage${slug}`} label={`${AGENTS[slug].name}, ${stage === "held" ? "on a leash on this wallet" : "not on a leash on this wallet"}`} />
        </div>
      </div>
      <p className="ac-stage__cap" role="status">
        <span className={`k-dot ${stage === "held" ? "k-dot--live" : stage === "cut" ? "k-dot--err" : ""}`} aria-hidden="true" />
        {stage === "held" && held
          ? `${AGENTS[slug].name} is on a leash on this wallet until ${new Date(held.expiry * 1000).toLocaleDateString("en-GB")}`
          : stage === "cut"
            ? `${AGENTS[slug].name}'s leash on this wallet has ended`
            : `${AGENTS[slug].name} is not on a leash yet`}
      </p>
    </div>
  );

  /* The leash label: everything the agent may and may not do, shown before any signature. */
  const label = (
    <dl className="ac-label" aria-label={`What ${AGENTS[slug].name} may do on your wallet`}>
      <div className="ac-label__row">
        <dt>Can touch</dt>
        <dd>
          {touch.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </dd>
      </div>
      <div className="ac-label__row">
        <dt>Cap</dt>
        <dd>
          <span className="k-num">
            At most <strong>{daily || "?"} USDT a day</strong>, never more than the <strong>{budget || "?"} USDT</strong> you approve
          </span>
          {relay ? <span className="k-small">plus {relay} BNB a day for its relay</span> : null}
        </dd>
      </div>
      <div className="ac-label__row">
        <dt>Ends</dt>
        <dd>
          <span className="k-num">
            In <strong>{days || "?"} days</strong>, or the moment you revoke it
          </span>
        </dd>
      </div>
      <div className="ac-label__row ac-label__row--no">
        <dt>Cannot</dt>
        <dd>Transfer, withdraw to anyone, or approve anything. Everything it moves stays in this wallet.</dd>
      </div>
      <div className="ac-label__row ac-label__row--revoke">
        <dt>Take it back</dt>
        <dd>One tap, on chain, any time. The key is registered in the public KeyStore.</dd>
      </div>
    </dl>
  );

  const picker = (
    <div className="ac-pick" role="radiogroup" aria-label="Which agent">
      {(Object.keys(AGENTS) as Slug[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={slug === s} className="ac-pick__a" data-job={HOUSE[s].job} onClick={() => setSlug(s)}>
          <span className="ac-pick__art" aria-hidden="true">
            <Agent job={HOUSE[s].job} seed={HOUSE[s].seed} house size={56} state="ready" slot={`pick${s}`} />
          </span>
          <span className="ac-pick__copy">
            <strong>{AGENTS[s].name}</strong>
            <span>{AGENTS[s].line}</span>
          </span>
          <span className="ac-pick__tick" aria-hidden="true">
            <Check size={14} strokeWidth={3} />
          </span>
        </button>
      ))}
    </div>
  );

  if (!available) {
    return (
      <div className="ac-wiz">
        <div className="ac-wiz__show">
          {scene}
          {label}
        </div>
        <div className="ac-wiz__do">
          {picker}
          <div className="ac-wiz__gate">
            <OpenInWallet />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-wiz">
      <div className="ac-wiz__show">
        {scene}
        {label}
      </div>

      <div className="ac-wiz__do">
        {picker}

        <ol className="ac-steps2">
          <li className="ac-step" data-state={stepState(1, step1)}>
            <span className="ac-step__n k-num" aria-hidden="true">
              {step1 ? <Check size={15} strokeWidth={3} /> : 1}
            </span>
            <div className="ac-step__body">
              <p className="ac-step__t">A wallet only you control</p>
              <p className="ac-step__d">A passkey wallet: your fingerprint or face unlocks it, with no seed phrase. The agent will act on this wallet and nothing else.</p>
              {pk ? (
                <p className="ac-step__ok">
                  <Check size={14} aria-hidden="true" /> Unlocked <span className="k-mono">{pk.address}</span>
                </p>
              ) : passkeys === "none" ? (
                <p className="k-note k-note--warn">
                  <span>
                    This browser cannot make a passkey, which is how the wallet is unlocked. Wallet apps&apos; built-in browsers often cannot. Open{" "}
                    <span className="k-mono">mandatemarkets.com/leash</span> in Chrome, Safari or Edge; your main wallet can still connect there.
                  </span>
                </p>
              ) : (
                <div className="ac-step__row">
                  {passkeys === "roaming" ? <p className="k-small ac-step__full">This device has no fingerprint or face unlock of its own, so the passkey will live on your phone or a security key when you are asked.</p> : null}
                  {known ? (
                    <button type="button" className={`k-btn k-btn--primary${busy === "unlock" ? " ac-btn--wait" : ""}`} onClick={unlock} disabled={busy !== null}>
                      <Fingerprint size={16} aria-hidden="true" /> {busy === "unlock" ? "Waiting for your passkey…" : `Unlock ${known.slice(0, 6)}…${known.slice(-4)}`}
                    </button>
                  ) : null}
                  <button type="button" className={`k-btn${known ? "" : " k-btn--primary"}${busy === "create" ? " ac-btn--wait" : ""}`} onClick={create} disabled={busy !== null}>
                    <Fingerprint size={16} aria-hidden="true" /> {busy === "create" ? "Waiting for your passkey…" : "Create a passkey wallet"}
                  </button>
                  {!known ? (
                    <button type="button" className="k-btn k-btn--ghost" onClick={unlock} disabled={busy !== null}>
                      I already have one
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </li>

          <li className="ac-step" data-state={stepState(2, step2)}>
            <span className="ac-step__n k-num" aria-hidden="true">
              {step2 ? <Check size={15} strokeWidth={3} /> : 2}
            </span>
            <div className="ac-step__body">
              <p className="ac-step__t">Put in what the agent may use</p>
              <p className="ac-step__d">About 0.002 BNB pays the relay and the key registry&apos;s fee. {slug === "yield-1" ? "Then the USDT you want put to work." : "Guard-1 repays from USDT held in this wallet, against this wallet's own Venus loan."}</p>
              {wallet ? (
                <>
                  <p className="ac-step__bal k-num">
                    Holds {bal ? `${Number(formatEther(bal.bnb)).toFixed(5)} BNB, ${Number(formatUnits(bal.usdt, 18)).toFixed(2)} USDT` : "…"}
                    {bal && bal.vusdt > 0n ? " and a Venus supply" : ""}
                  </p>
                  {!owner ? (
                    <button type="button" className="k-btn" onClick={connect}>
                      Connect the wallet to fund it from
                    </button>
                  ) : !ready ? (
                    <button type="button" className="k-btn" onClick={switchChain}>
                      Switch to BNB Smart Chain
                    </button>
                  ) : (
                    <div className="ac-step__row">
                      <button type="button" className="k-btn" onClick={fundBnb} disabled={busy !== null}>
                        {busy === "bnb" ? "Sending…" : "Send 0.002 BNB"}
                      </button>
                      <label className="ac-in">
                        <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" aria-label="Budget in USDT" />
                        <span>USDT</span>
                      </label>
                      <button type="button" className="k-btn" onClick={fundUsdt} disabled={busy !== null || !(Number(budget) > 0)}>
                        {busy === "usdt" ? "Sending…" : `Send ${budget} USDT`}
                      </button>
                      {tx(done.bnb)} {tx(done.usdt)}
                    </div>
                  )}
                  <p className="k-small">
                    Or send to <span className="k-mono ac-break">{wallet}</span> from anywhere, on BNB Smart Chain only.
                  </p>
                </>
              ) : null}
            </div>
          </li>

          <li className="ac-step" data-state={stepState(3, step3)}>
            <span className="ac-step__n k-num" aria-hidden="true">
              {step3 ? <Check size={15} strokeWidth={3} /> : 3}
            </span>
            <div className="ac-step__body">
              <p className="ac-step__t">Set its limits, and grant</p>
              <p className="ac-step__d">The label beside this is exactly what you sign. Change a limit and it changes there.</p>
              <div className="ac-limits">
                <label className="ac-in ac-in--l">
                  <span className="ac-in__k">Budget</span>
                  <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" />
                  <span>USDT</span>
                </label>
                <label className="ac-in ac-in--l">
                  <span className="ac-in__k">At most</span>
                  <input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" />
                  <span>USDT a day</span>
                </label>
                <label className="ac-in ac-in--l">
                  <span className="ac-in__k">For</span>
                  <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="numeric" />
                  <span>days</span>
                </label>
              </div>
              {ready2 ? <p className="k-small ac-step__wait">{ready2}</p> : null}
              <button type="button" className={`k-btn k-btn--primary k-btn--lg ac-grant${busy === "grant" ? " ac-btn--wait" : ""}`} onClick={grant} disabled={!pk || busy !== null || ready2 !== null}>
                <Fingerprint size={18} aria-hidden="true" /> {busy === "grant" ? "Two passkey prompts: approve, then grant…" : `Grant ${AGENTS[slug].name} this leash`}
              </button>
              {!pk && wallet ? <p className="k-small">Unlock the wallet with its passkey first.</p> : null}
              {done.approve !== undefined || done.grant !== undefined ? (
                <p className="k-small ac-step__txs">
                  {tx(done.approve)} {tx(done.grant)}
                </p>
              ) : null}
            </div>
          </li>
        </ol>

        {leashes.length ? (
          <section className="ac-onwallet" aria-labelledby="ac-onwallet-h">
            <h2 className="k-h3" id="ac-onwallet-h">
              On this wallet
            </h2>
            {leashes.map((l) => {
              const active = !l.revokedAt && l.expiry * 1000 > Date.now();
              return (
                <div key={l.id} className="ac-held" data-active={active ? "1" : undefined} data-job={HOUSE[l.slug].job}>
                  <div className="ac-held__top">
                    <Agent job={HOUSE[l.slug].job} seed={HOUSE[l.slug].seed} house size={48} state={active ? "leashed" : "ready"} omit={["leash"]} slot={`held${l.id}`} />
                    <div className="ac-held__who">
                      <strong>{AGENTS[l.slug].name}</strong>
                      <span className="k-state">
                        <span className={`k-dot ${active ? "k-dot--live" : ""}`} aria-hidden="true" />
                        {active ? `on a leash until ${new Date(l.expiry * 1000).toLocaleDateString("en-GB")}` : l.revokedAt ? "revoked" : "expired"}
                      </span>
                      <span className="k-small k-num">at most {l.dailyUsdt} USDT a day</span>
                    </div>
                    {active ? (
                      <button type="button" className="k-btn k-btn--sm k-btn--danger" onClick={() => revoke(l)} disabled={busy !== null || !pk}>
                        {busy === `revoke:${l.id}` ? <Loader2 size={14} className="ac-spin" aria-hidden="true" /> : <ShieldOff size={14} aria-hidden="true" />} Revoke now
                      </button>
                    ) : null}
                    {tx(done[`revoke:${l.id}`])}
                  </div>
                  <ul className="ac-runs">
                    {l.runs.length ? (
                      l.runs.slice(0, 6).map((r) => (
                        <li key={r.at}>
                          <span className="ac-runs__at k-num">{new Date(r.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="ac-runs__r">{r.reason}</span>
                          {tx(r.txs[0]?.tx)}
                        </li>
                      ))
                    ) : (
                      <li className="ac-runs__none">It takes its first look within minutes.</li>
                    )}
                  </ul>
                </div>
              );
            })}
            <button type="button" className="k-btn" onClick={withdraw} disabled={!pk || !owner || busy !== null}>
              {busy === "withdraw" ? "Withdrawing…" : "Withdraw everything to my connected wallet"}
            </button>
            {tx(done.withdraw)}
          </section>
        ) : null}

        {error ? (
          <p className="k-note k-note--err" role="alert">
            {error}
          </p>
        ) : null}
        <div className="ac-help ac-help--in">
          <NeedHelp />
        </div>
      </div>
    </div>
  );
}
