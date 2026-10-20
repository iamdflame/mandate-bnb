"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import HireDrawer, { type HireOffer } from "@/components/x/HireDrawer";
import OpenInWallet from "@/components/x/OpenInWallet";
import { PasskeyStart } from "@/components/x/Passkey";
import NeedHelp from "@/components/x/NeedHelp";
import HirePack, { type PackAgent } from "@/components/x/HirePack";
import TestnetPack, { type TestnetPackAgent } from "@/components/x/TestnetPack";
import { useWallet } from "@/lib/chain/wallet";

export interface QuestCard {
  category: string;
  label: string;
  others: number;
  offer: HireOffer | null;
  price: string | null;
  ours: boolean;
  /** The pick, drawn by the page in its real pose (lib/view/state). */
  figure?: ReactNode;
}

interface Counted {
  agentId: string;
  agentName: string | null;
  category: string | null;
  tx: string | null;
  network?: "testnet";
}

interface Elsewhere {
  network: "mainnet" | "testnet";
  jobId: string;
  provider: string;
  agentName: string | null;
  explorer: string;
}

interface Progress {
  team: boolean;
  hired: Counted[];
  elsewhere: Elsewhere[];
  /** Different agents here and on other marketplaces, and whether they span two (null: the chain cannot say). */
  across: { agents: number; twoMarketplaces: boolean | null };
  listed: number;
  best: { agentId: string; name: string | null; rung: number; rungName: string } | null;
}

/** BNB Chain's Set and Earn rules, as its campaign page states them. */
export interface Campaign {
  hires: number;
  marketplaces: number;
  register: string;
  page: string;
  ends: string;
}

const short = (tx: string) => `${tx.slice(0, 8)}…${tx.slice(-4)}`;

/**
 * Set and Earn for the connected wallet, by BNB Chain's rules: register the
 * wallet, hire three different agents across at least two shortlisted
 * marketplaces, and build one agent of your own. Progress here is what
 * MANDATE can confirm from the chain: different agents this wallet paid for
 * here, and its own agents listed here. Re-read while the page is open, since
 * a hire is confirmed a few seconds after it is answered.
 */
export default function QuestBoard({
  cards,
  campaign,
  pack,
  testnetPack,
  ended = false,
}: {
  cards: QuestCard[];
  campaign: Campaign;
  pack?: PackAgent[] | null;
  /** The same two agents under their testnet identities, hired free in test $U. */
  testnetPack?: TestnetPackAgent[] | null;
  /** Past CAMPAIGN_ENDS: the wallet's record stays readable; nothing new counts, so nothing is offered as if it would. */
  ended?: boolean;
}) {
  const { address, available, connect, connectError } = useWallet();
  const [p, setP] = useState<Progress | null>(null);

  const read = useCallback(async () => {
    if (!address) {
      setP(null);
      return;
    }
    try {
      const q = await fetch(`/api/v1/quest/${address}`, { cache: "no-store" }).then((r) => r.json());
      setP({
        team: Boolean(q?.data?.team),
        hired: (q?.data?.agentsHired ?? []) as Counted[],
        elsewhere: (q?.data?.elsewhere ?? []) as Elsewhere[],
        across: {
          agents: Number(q?.data?.across?.agents ?? q?.data?.agentsHired?.length ?? 0),
          twoMarketplaces: q?.data?.across?.twoMarketplaces ?? null,
        },
        listed: Number(q?.data?.agentsListed ?? 0),
        best: q?.data?.bestAgent ?? null,
      });
    } catch {
      /* the last reading stands */
    }
  }, [address]);

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

  const hiredHere = p && !p.team ? p.hired.length : 0;
  const hiredElsewhere = p && !p.team ? p.elsewhere.length : 0;
  // Different agents on every marketplace the chain shows: here, and jobs funded elsewhere through BNB Chain's shared escrow.
  const hiredAll = p && !p.team ? p.across.agents : 0;
  const built = Boolean(p && p.listed > 0);
  // Two of the three can be here; the third has to be on another shortlisted marketplace.
  const roomHere = campaign.hires - (campaign.marketplaces - 1);
  const hiresDone = hiredAll >= campaign.hires && p?.across.twoMarketplaces === true;
  const hiredCategories = new Set((p?.hired ?? []).map((h) => h.category));

  const ends = new Date(campaign.ends).toUTCString().slice(5, 16);
  const slots = Array.from({ length: campaign.hires + 1 }, (_, i) => (i < campaign.hires ? i < hiredAll : built));

  return (
    <div className={`bd-quest${ended ? " bd-quest--ended" : ""}`}>
      {/* Where this wallet stands, first: the reason most people come back. */}
      <section className="k-panel k-panel--raised bd-qprog" role="status" aria-label={ended ? "Your Set and Earn record" : "Your Set and Earn progress"}>
        <div className="bd-qprog__meter" aria-hidden="true">
          {slots.map((on, i) => (
            <span key={i} className={`bd-qprog__slot${on ? " bd-qprog__slot--on" : ""}${i === campaign.hires ? " bd-qprog__slot--build" : ""}`}>
              <span className="bd-qprog__tick">{on ? <Check size={16} strokeWidth={3} /> : null}</span>
              <em>{i < campaign.hires ? `Hire ${i + 1}` : "Your agent"}</em>
            </span>
          ))}
        </div>
        <div className="bd-qprog__copy">
          {address && p ? (
            <>
              <p className="bd-qprog__count">
                <strong className="k-num">{Math.min(hiredAll, campaign.hires)}</strong> of {campaign.hires} different agents hired
                {hiredElsewhere ? ` (${hiredHere} here, ${hiredElsewhere} on other marketplaces)` : hiredHere ? " here" : ""}
                {built ? ", your agent listed" : ""}
              </p>
              {p.team ? <p className="k-small">This is one of MANDATE&apos;s own wallets, so it never counts toward the campaign.</p> : null}
            </>
          ) : address ? (
            <p className="bd-qprog__count">
              <span className="k-dot k-dot--live" aria-hidden="true" /> Reading your hires from the chain…
            </p>
          ) : (
            <>
              <p className="bd-qprog__count">Connect your campaign wallet to see {ended ? "your record" : "your progress"}.</p>
              {available ? (
                <div className="k-row">
                  <button type="button" className="k-btn k-btn--primary" onClick={() => void connect().catch(() => undefined)}>
                    Connect wallet
                  </button>
                  {connectError ? (
                    <p className="bd-pack__err" role="alert">
                      {connectError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="bd-qprog__wallet">
                  <OpenInWallet />
                  <PasskeyStart quiet />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <ol className="bd-qsteps">
        <li className="bd-qstep">
          <span className="bd-qstep__n k-num">1</span>
          <h2 className="bd-qstep__t">Register your campaign wallet</h2>
          <p className="bd-qstep__d">
            With BNB Chain, before anything else: your name, the one wallet you will use, and a public GitHub. Actions from a wallet that is not registered are not counted.
          </p>
          {!ended ? (
            <a className="k-btn k-btn--sm" href={campaign.register} target="_blank" rel="noreferrer">
              Register with BNB Chain <ExternalLink size={14} aria-hidden="true" />
            </a>
          ) : null}
        </li>
        <li className={hiresDone || hiredHere >= roomHere ? "bd-qstep bd-qstep--done" : "bd-qstep"}>
          <span className="bd-qstep__n k-num">{hiresDone || hiredHere >= roomHere ? <Check size={14} strokeWidth={3} aria-label={hiresDone ? "Done" : "Done here"} /> : 2}</span>
          <h2 className="bd-qstep__t">
            Hire {campaign.hires} different agents, on at least {campaign.marketplaces} marketplaces
          </h2>
          <p className="bd-qstep__d">
            Up to {roomHere} can be here; at least one has to be on another shortlisted marketplace (listed on{" "}
            <a className="k-link" href={campaign.page} target="_blank" rel="noreferrer">
              BNB Chain&apos;s campaign page
            </a>
            ). Each a different agent, paid from your campaign wallet.
          </p>
          {p && (p.hired.length || p.elsewhere.length) ? (
            <ul className="bd-qstep__hired">
              {p.hired.map((h) => (
                <li key={h.agentId}>
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                  <span>{h.agentName ?? `#${h.agentId}`}</span>
                  {h.tx ? (
                    <a className="k-mono" href={`https://${h.network === "testnet" ? "testnet." : ""}bscscan.com/tx/${h.tx}`} target="_blank" rel="noreferrer">
                      {short(h.tx)}
                    </a>
                  ) : null}
                </li>
              ))}
              {p.elsewhere.map((h) => (
                <li key={`${h.network}:${h.jobId}`}>
                  <Check size={13} strokeWidth={3} aria-hidden="true" />
                  <span>
                    {h.agentName ?? `the agent at ${h.provider.slice(0, 6)}…${h.provider.slice(-4)}`}, on another marketplace{h.network === "testnet" ? " (testnet)" : ""}
                  </span>
                  <a className="k-mono" href={h.explorer} target="_blank" rel="noreferrer">
                    job {h.jobId}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {p && !p.team && hiredAll >= campaign.hires && p.across.twoMarketplaces === null ? (
            <p className="k-small">These were all on other marketplaces, and the chain does not say whether on one or several. BNB Chain counts that from its own records.</p>
          ) : null}
        </li>
        <li className={built ? "bd-qstep bd-qstep--done" : "bd-qstep"}>
          <span className="bd-qstep__n k-num">{built ? <Check size={14} strokeWidth={3} aria-label="Listed" /> : 3}</span>
          <h2 className="bd-qstep__t">Build one agent of your own</h2>
          <p className="bd-qstep__d">
            Registered on ERC-8004 from your campaign wallet and listed here. BNB Chain checks it after the campaign: a card stating its job, live when called, hired by three wallets
            that are not yours, and five onchain actions on three different days that fit its job. An agent that only answers does not count.
          </p>
          {built && p?.best ? (
            <p className="bd-qstep__ok">
              <Check size={13} strokeWidth={3} aria-hidden="true" /> {p.best.name ?? `#${p.best.agentId}`} is listed here, on the {p.best.rungName} rung.
            </p>
          ) : p?.best ? (
            <p className="k-small">#{p.best.agentId} is registered, but its card does not parse yet, so it has no name here.</p>
          ) : null}
          <span className="k-row">
            <Link className="k-btn k-btn--sm" href={p?.best ? `/check?q=${p.best.agentId}` : address ? `/check?q=${address}` : "/check"}>
              {p?.best ? "Check it against the six" : "Check your agent"}
            </Link>
            <Link className="k-btn k-btn--sm k-btn--ghost" href="/build">
              Build and list one
            </Link>
          </span>
        </li>
      </ol>

      {!ended && ((pack && pack.length >= 2) || (testnetPack && testnetPack.length >= 2)) ? (
        <section className="bd-qpacks" aria-label="Two hires at once">
          {pack && pack.length >= 2 ? <HirePack agents={pack} /> : null}
          {testnetPack && testnetPack.length >= 2 ? <TestnetPack agents={testnetPack} /> : null}
        </section>
      ) : null}

      <section className="bd-qjobs" aria-labelledby="h-qjobs">
        <div className="k-shead">
          <div className="k-shead__copy">
            <h2 id="h-qjobs" className="k-h2">
              {ended ? "Agents for each job" : "Or pick your own, one per job"}
            </h2>
            <p className="k-body">
              {ended ? "Hiring goes on after the campaign; a hire now simply does not count toward it." : "One agent ready for each job, in the marketplace's own order. Each opens its hire right here."}
            </p>
          </div>
        </div>
        <ol className="bd-qjobs__list">
          {cards.map((c, i) => {
            const hired = hiredCategories.has(c.category);
            const hash = `#hire-${c.category}`;
            return (
              <li key={c.category} className={hired ? "bd-qjob bd-qjob--done" : "bd-qjob"} data-job={c.category} style={{ ["--i" as string]: i }}>
                <span className="bd-qjob__art" aria-hidden="true">
                  {c.figure ?? null}
                </span>
                <div className="bd-qjob__body">
                  <h3 className="bd-qjob__job">{c.label}</h3>
                  {c.offer ? (
                    <>
                      <p className="bd-qjob__name">
                        <Link href={`/agents/${c.offer.tokenId}`}>{c.offer.name}</Link>
                        {c.ours ? <span className="k-tag k-tag--ours">Ours</span> : null}
                        {hired ? <span className="k-tag k-tag--ours">Hired</span> : null}
                      </p>
                      {c.price ? <p className="bd-qjob__price k-num">{c.price}</p> : null}
                      {ended ? (
                        <Link className="k-btn k-btn--block" href={`/agents/${c.offer.tokenId}`}>
                          Its page <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
                        </Link>
                      ) : (
                        <a className={hired ? "k-btn k-btn--block" : "k-btn k-btn--primary k-btn--block"} href={hash}>
                          Hire
                        </a>
                      )}
                      {c.others ? (
                        <Link className="bd-qjob__alt" href={`/agents?category=${c.category}&hireable=1`}>
                          or one of {c.others} other{c.others === 1 ? "" : "s"}
                        </Link>
                      ) : null}
                      {!ended ? <HireDrawer offer={c.offer} openOn={hash} onDone={read} /> : null}
                    </>
                  ) : (
                    <p className="bd-qjob__none">Nobody can be hired for this job right now.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="bd-help">
        <NeedHelp />
      </div>
      <details className="bd-more bd-quest__fine">
        <summary>
          <span>What is counted here</span>
        </summary>
        <p className="k-small bd-more__p">
          Hires your own wallet paid on MANDATE once the chain confirms them, and every job your wallet funded through BNB Chain&apos;s ERC-8183 escrow on another marketplace, on
          mainnet or testnet. Each counts once per agent, never for an agent you own, and calls MANDATE pays for do not count. Hires paid per call or through another
          marketplace&apos;s own contract are not visible here; BNB Chain counts those and your agent&apos;s checks from the chain, and its determination is final. The campaign
          {ended ? " ran" : " runs"} to {ends}, 12:00 UTC. The same record answers at <span className="k-mono">/api/v1/quest/{"{address}"}</span>.
        </p>
      </details>
    </div>
  );
}
