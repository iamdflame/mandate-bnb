"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import HireDrawer, { type HireOffer } from "@/components/x/HireDrawer";
import { useWallet } from "@/lib/chain/wallet";

export interface QuestCard {
  category: string;
  label: string;
  others: number;
  offer: HireOffer | null;
  price: string | null;
  ours: boolean;
}

interface Row {
  category: string | null;
  agentId: string;
  agentName: string | null;
  tx: string | null;
  onChain: boolean;
  sponsored: boolean;
}

interface Progress {
  team: boolean;
  hired: Record<string, Row | null>;
  listed: number;
  best: { agentId: string; name: string | null; rung: number; rungName: string } | null;
  ratings: number;
}

const short = (tx: string) => `${tx.slice(0, 8)}…${tx.slice(-4)}`;

/**
 * The quest for the connected wallet: four jobs and one listing, each ticked
 * from the tracking API, which counts only the wallet's own hires once the
 * chain confirms them. Re-read while the page is open, since a hire is
 * confirmed a few seconds after it is answered.
 */
export default function QuestBoard({ cards }: { cards: QuestCard[] }) {
  const { address, available, connect } = useWallet();
  const [p, setP] = useState<Progress | null>(null);

  const read = useCallback(async () => {
    if (!address) {
      setP(null);
      return;
    }
    try {
      const [h, q] = await Promise.all([
        fetch(`/api/v1/wallets/${address}/hires`, { cache: "no-store" }).then((r) => r.json()),
        fetch(`/api/v1/quest/${address}`, { cache: "no-store" }).then((r) => r.json()),
      ]);
      const rows = ((h?.data?.hires ?? []) as Row[]).filter((r) => r.onChain && !r.sponsored);
      setP({
        team: Boolean(q?.data?.team),
        hired: Object.fromEntries(cards.map((c) => [c.category, rows.find((r) => r.category === c.category) ?? null])),
        listed: Number(q?.data?.agentsListed ?? 0),
        best: q?.data?.bestAgent ?? null,
        ratings: Number(q?.data?.ratingsGiven ?? 0),
      });
    } catch {
      /* the last reading stands */
    }
  }, [address, cards]);

  useEffect(() => {
    void read();
  }, [read]);
  useEffect(() => {
    if (!address) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, 15_000);
    return () => clearInterval(t);
  }, [address, read]);

  const jobsDone = p ? cards.filter((c) => p.hired[c.category]).length : 0;
  const steps = cards.length + 1;
  const stepsDone = jobsDone + (p && p.listed > 0 ? 1 : 0);

  return (
    <div className="x-quest">
      <div className="x-quest__bar" role="status">
        {address && p ? (
          <>
            <p className="x-quest__count">
              <span className="x-mono">{jobsDone}</span> of {cards.length} jobs hired{p.listed > 0 ? ", agent listed" : ""}
            </p>
            <div className="x-quest__meter" aria-hidden="true">
              {Array.from({ length: steps }, (_, i) => (
                <span key={i} className={i < stepsDone ? "x-quest__seg x-quest__seg--on" : "x-quest__seg"} />
              ))}
            </div>
            {p.team ? <p className="x-quest__note">This is one of MANDATE&apos;s own wallets, so it never counts toward the quest.</p> : null}
          </>
        ) : address ? (
          <p className="x-quest__count">Reading your hires from the chain…</p>
        ) : (
          <>
            <p className="x-quest__count">Connect a wallet to see your progress.</p>
            {available ? (
              <button type="button" className="x-btn x-btn--primary" onClick={connect}>
                Connect wallet
              </button>
            ) : (
              <p className="x-quest__note">Open this page in a wallet&apos;s browser, or install a wallet extension.</p>
            )}
          </>
        )}
      </div>

      <ol className="x-quest__jobs">
        {cards.map((c, i) => {
          const hired = p?.hired[c.category] ?? null;
          const hash = `#hire-${c.category}`;
          return (
            <li key={c.category} className={hired ? "x-quest__job x-quest__job--done" : "x-quest__job"}>
              <p className="x-quest__n x-mono">{hired ? <Check size={14} strokeWidth={3} aria-label="Done" /> : i + 1}</p>
              <h2 className="x-quest__label">{c.label}</h2>
              {hired ? (
                <p className="x-quest__done">
                  Hired {hired.agentName ?? `#${hired.agentId}`}
                  {hired.tx ? (
                    <>
                      {" · "}
                      <a className="x-link x-mono" href={`https://bscscan.com/tx/${hired.tx}`} target="_blank" rel="noreferrer">
                        {short(hired.tx)}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {c.offer ? (
                <>
                  <p className="x-quest__agent">
                    <Link className="x-link" href={`/agents/${c.offer.tokenId}`}>
                      {c.offer.name}
                    </Link>
                    {c.ours ? <span className="x-tag">Ours</span> : null}
                  </p>
                  {c.price ? <p className="x-quest__price">{c.price} a call</p> : null}
                  <a className={hired ? "x-btn x-btn--block" : "x-btn x-btn--primary x-btn--block"} href={hash}>
                    {hired ? "Hire again" : "Hire"}
                  </a>
                  {c.others ? (
                    <Link className="x-quest__alt" href={`/agents?category=${c.category}&hireable=1`}>
                      or one of {c.others} other{c.others === 1 ? "" : "s"}
                    </Link>
                  ) : null}
                  <HireDrawer offer={c.offer} openOn={hash} onDone={read} />
                </>
              ) : (
                <p className="x-quest__none">Nobody can be hired for this job right now.</p>
              )}
            </li>
          );
        })}
        <li className={p && p.listed > 0 ? "x-quest__job x-quest__job--done x-quest__job--build" : "x-quest__job x-quest__job--build"}>
          <p className="x-quest__n x-mono">{p && p.listed > 0 ? <Check size={14} strokeWidth={3} aria-label="Done" /> : cards.length + 1}</p>
          <h2 className="x-quest__label">List your agent</h2>
          {p && p.listed > 0 && p.best ? (
            <p className="x-quest__done">
              {p.best.name ?? `#${p.best.agentId}`} is listed, on the {p.best.rungName} rung.
            </p>
          ) : p?.best ? (
            <p className="x-quest__agent">#{p.best.agentId} is registered, but its card does not parse yet, so it has no name here.</p>
          ) : (
            <p className="x-quest__agent">Register an agent on the ERC-8004 registry from this wallet, and it is listed here within minutes.</p>
          )}
          <Link className={p && p.listed > 0 ? "x-btn x-btn--block" : "x-btn x-btn--primary x-btn--block"} href={p?.best ? `/list?id=${p.best.agentId}` : "/list"}>
            {p?.best ? "See what moves it up" : "List your agent"}
          </Link>
        </li>
      </ol>

      <p className="x-quest__fine">
        Counted from hires your own wallet paid, once the chain confirms them. Calls MANDATE pays for do not count. The same record answers at{" "}
        <span className="x-mono">/api/v1/quest/{"{address}"}</span>.
      </p>
    </div>
  );
}
