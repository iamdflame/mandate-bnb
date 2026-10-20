"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { useWallet } from "@/lib/chain/wallet";
import Agent from "@/components/characters/Agent";
import None, { Reading } from "@/components/account/None";

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

/** Our two agents that go on a buyer's wallet, as drawn. */
const FACE: Record<string, { job: string; seed: string }> = {
  "yield-1": { job: "yield-optimisation", seed: "344122" },
  "guard-1": { job: "health-factor", seed: "344123" },
};
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

  if (!address) return <p className="ac-gate k-small">Connect a wallet to see any agent you have leashed.</p>;
  if (leashes === null) return <Reading label="Reading your leashes…" rows={1} />;
  if (!leashes.length) {
    return (
      <None
        job="health-factor"
        seed="desk-leash"
        action={
          <Link className="k-btn k-btn--sm" href="/leash">
            Leash an agent
          </Link>
        }
      >
        No agent acts on a wallet of yours.
      </None>
    );
  }

  const now = Date.now() / 1000;
  return (
    <ul className="ac-list">
      {leashes.map((l, i) => {
        const last = l.runs.find((r) => r.outcome === "acted") ?? l.runs[0];
        const tx = last?.txs?.[0]?.tx;
        const state = l.revokedAt ? "revoked" : l.expiry < now ? "expired" : "live";
        const face = FACE[l.agent.toLowerCase()] ?? null;
        return (
          <li key={l.id} className="ac-row" data-job={face?.job} data-live={state === "live" ? "1" : undefined}>
            <span className="ac-row__face" aria-hidden="true">
              {face ? <Agent job={face.job} seed={face.seed} house size={44} state={state === "live" ? "leashed" : "ready"} omit={["leash"]} slot={`ls${i}`} /> : null}
            </span>
            <div className="ac-row__main">
              <p className="ac-row__t">
                <span className="ac-row__name">{l.agent}</span>
                <span className="ac-row__job">
                  on <span className="k-mono">{short(l.wallet)}</span>
                </span>
              </p>
              <p className="ac-row__d">
                <span className="k-num">Up to {l.dailyUsdt} USDT a day</span>
                <span>{state === "revoked" ? `revoked ${day(l.revokedAt!)}` : state === "expired" ? `ended ${day(l.expiry)}` : `until ${day(l.expiry)}`}</span>
              </p>
              {last ? <p className="ac-row__d">Last: {last.reason}</p> : null}
            </div>
            <div className="ac-row__side">
              {state === "live" ? (
                <span className="k-tag k-tag--ours">
                  <Check size={12} aria-hidden="true" /> active
                </span>
              ) : state === "revoked" ? (
                <span className="k-tag">
                  <X size={12} aria-hidden="true" /> revoked
                </span>
              ) : (
                <span className="k-tag">
                  <Clock size={12} aria-hidden="true" /> ended
                </span>
              )}
              {tx ? (
                <a className="k-link k-mono ac-row__tx" href={`https://bscscan.com/tx/${tx}`} target="_blank" rel="noreferrer">
                  {tx.slice(0, 8)}…
                </a>
              ) : null}
              {state === "live" ? (
                <Link className="k-btn k-btn--sm k-btn--danger" href="/leash">
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
