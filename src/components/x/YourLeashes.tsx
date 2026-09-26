"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { useWallet } from "@/lib/chain/wallet";

/**
 * The agents acting on wallets this address owns, for My Desk.
 *
 * Read from the same record `/leash` writes: every session granted from this
 * wallet (or on it, when it is itself a passkey wallet), its daily cap, when
 * it ends, and the last thing the agent did through it. Revoking needs the
 * passkey, which lives on the leash page, so each row links there.
 */
interface Run {
  at: string;
  outcome: string;
  reason: string;
  txs?: { step: string; tx: string }[];
}
interface Leash {
  id: string;
  wallet: string;
  agent: string;
  dailyUsdt: string;
  expiry: number;
  revokedAt: string | null;
  revokeTx: string | null;
  runs: Run[];
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const day = (iso: string | number) =>
  new Date(typeof iso === "number" ? iso * 1000 : iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function YourLeashes() {
  const { address } = useWallet();
  const [leashes, setLeashes] = useState<Leash[] | null>(null);

  useEffect(() => {
    if (!address) return;
    let gone = false;
    fetch(`/api/leash?address=${address}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !gone && setLeashes((j?.data?.leashes ?? []) as Leash[]))
      .catch(() => !gone && setLeashes([]));
    return () => {
      gone = true;
    };
  }, [address]);

  if (!address) return <p className="x-muted">Connect a wallet to see any agent you have leashed.</p>;
  if (leashes === null) return <p className="x-muted">Reading your leashes…</p>;
  if (!leashes.length) {
    return (
      <div className="x-yours-empty">
        <p className="x-muted">No agent acts on a wallet of yours.</p>
        <Link className="x-btn" href="/leash">
          Leash an agent
        </Link>
      </div>
    );
  }

  const now = Date.now() / 1000;
  return (
    <ul className="x-hires__list">
      {leashes.map((l) => {
        const last = l.runs.find((r) => r.outcome === "acted") ?? l.runs[0];
        const tx = last?.txs?.[0]?.tx;
        const state = l.revokedAt ? "revoked" : l.expiry < now ? "expired" : "live";
        return (
          <li key={l.id} className="x-hire-row">
            <div className="x-hire-row__main">
              <p className="x-hire-row__t">
                {l.agent}
                <span className="x-hire-row__job">on {short(l.wallet)}</span>
              </p>
              <p className="x-hire-row__d">
                Up to {l.dailyUsdt} USDT a day ·{" "}
                {state === "revoked" ? `revoked ${day(l.revokedAt!)}` : state === "expired" ? `ended ${day(l.expiry)}` : `until ${day(l.expiry)}`}
              </p>
              {last ? <p className="x-hire-row__d">Last: {last.reason}</p> : null}
            </div>
            <div className="x-hire-row__side">
              {state === "live" ? (
                <span className="x-hire-row__ok">
                  <Check size={13} aria-hidden="true" /> active
                </span>
              ) : state === "revoked" ? (
                <span className="x-hire-row__wait">
                  <X size={13} aria-hidden="true" /> revoked
                </span>
              ) : (
                <span className="x-hire-row__wait">
                  <Clock size={13} aria-hidden="true" /> ended
                </span>
              )}
              {tx ? (
                <a className="x-link x-mono" href={`https://bscscan.com/tx/${tx}`} target="_blank" rel="noreferrer">
                  {tx.slice(0, 8)}…
                </a>
              ) : null}
              {state === "live" ? (
                <Link className="x-btn x-btn--sm" href="/leash">
                  Revoke
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
