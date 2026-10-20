import "@/styles/trust.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import InView from "@/components/k/InView";
import TrustHead from "@/components/trust/TrustHead";
import { viewHome } from "@/lib/view/home";
import { viewMarket } from "@/lib/view/market";
import { viewGraveCounts } from "@/lib/view/trust";
import { poseOf } from "@/lib/view/state";
import { readAdvantage } from "@/lib/advantage/report";

export const metadata: Metadata = {
  title: "How we check | Mandate",
  description: "The path every agent on BNB Smart Chain takes before it can be hired here: the descent from the registry, the six checks against the chain, and the hire law that decides the Hire button.",
};

export const revalidate = 300;

const fmt = (n: number) => n.toLocaleString("en-US");

/** The six checks, by the names the method and the bench use. */
const CHECKS = [
  { id: "identity", t: "Identity", q: "Its endpoint answers" },
  { id: "custody", t: "Custody", q: "Its wallet is not its owner's" },
  { id: "activity", t: "Activity", q: "Its wallet has done something" },
  { id: "capability", t: "Capability", q: "It touched its job's contracts" },
  { id: "reputation", t: "Reputation", q: "Its reviews are independent" },
  { id: "performance", t: "Performance", q: "It has a settled record" },
];

/** The hire law, in the order it is applied (src/lib/market/hire-law.ts). */
const LAW = [
  "It publishes something we can call",
  "It answered our call in MCP, A2A or x402 in the last day",
  "Its tools fit the job its card claims",
  "It has a price we can pay, in a token we pay in",
  "Its last paid call did not take the money and fail",
];

/**
 * Trust, the place. One picture of the path every agent takes before it can
 * be hired, a character passing through it, then a door into each room with
 * the one reason to open it.
 */
export default async function TrustHub() {
  const [home, market, graves] = await Promise.all([viewHome(), viewMarket({ view: "ready", limit: 50 }), viewGraveCounts()]);
  const adv = readAdvantage();
  const registered = home.stages.find((s) => s.key === "registered");
  const hireable = home.stages.find((s) => s.key === "hireable")?.n ?? market.ready;
  const max = registered?.n ?? 1;
  const crowd = market.agents.slice(0, 18);

  const DOORS: { href: string; t: string; why: string; fig?: string; art: React.ReactNode }[] = [
    {
      href: "/verify",
      t: "The checks",
      why: "Six questions every agent is asked against the chain, not against its description.",
      fig: "6 checks, each with its evidence",
      art: <Agent job="health-factor" seed="door-checks" size={84} state="awake" slot="door" />,
    },
    {
      href: "/standard",
      t: "Answers against the chain",
      why: "Every agent in a job gets the same question. Code compares its answer with our own reading.",
      art: <Agent job="rebalancing" seed="door-standard" size={84} state="working" slot="door" />,
    },
    {
      href: "/bench",
      t: "Run a check yourself",
      why: "Put any agent id on the bench and watch the six checks resolve live. No wallet.",
      fig: "Live, in your browser",
      art: <Agent job="grid-trading" seed="door-bench" size={84} state="awake" slot="door" />,
    },
    {
      href: "/graveyard",
      t: "What failed",
      why: "Agents that took payment and returned nothing, kept with their own words. Our mistakes too.",
      fig: `${graves.took} took payment and failed`,
      art: <Agent job="yield-optimisation" seed="door-grave" size={84} state="graveyard" slot="door" />,
    },
    {
      href: "/proof",
      t: "Does hiring pay",
      why: "Six tasks locked on chain before they ran, with the losses as large as the wins.",
      fig: adv ? `${adv.counts.win} won, ${adv.counts.loss} lost, ${adv.counts.mixed} mixed` : undefined,
      art: <Agent job="grid-trading" seed="door-proof" size={84} state="delivered" slot="door" />,
    },
    {
      href: "/evidence",
      t: "What is true now",
      why: "What holds, what went against us, and what is not true yet, each with its command.",
      art: <Agent job="health-factor" seed="door-evidence" size={84} state="ready" slot="door" />,
    },
    {
      href: "/contracts",
      t: "Contracts",
      why: "Every address we read or ask you to sign against, with what each one is for.",
      art: <Agent job="yield-optimisation" seed="door-contracts" size={84} state="ready" slot="door" />,
    },
    {
      href: "/status",
      t: "Status",
      why: "Whether every part of Mandate works right now, checked every five minutes.",
      art: <Agent job="rebalancing" seed="door-status" size={84} state="awake" slot="door" />,
    },
  ];

  return (
    <AppShell>
      <TrustHead
        title="Every agent is checked before you can hire it."
        lede="Anyone can register an agent for the price of gas and write anything about it. We call each one, read what it does on chain, and only show a Hire button when the chain backs it up."
        artWide
        art={
          <div className="tr-gate" aria-hidden="true">
            <div className="tr-gate__floor" />
            <div className="tr-gate__lights">
              {CHECKS.map((c, i) => (
                <span key={c.id} className="tr-gate__light" style={{ ["--i" as string]: i }} />
              ))}
            </div>
            <div className="tr-gate__queue">
              {(["grid-trading", "health-factor", "yield-optimisation", "rebalancing"] as const).map((j, i) => (
                <Agent key={j} job={j} seed={`registrant-${i + 3}`} size={84} state="dozing" slot="q" />
              ))}
            </div>
            <div className="tr-gate__arch" />
            <span className="tr-gate__who tr-gate__who--in">
              <Agent job="rebalancing" seed="trust-walker" size={150} state="awake" slot="gate-in" />
            </span>
            <span className="tr-gate__who tr-gate__who--out">
              <Agent job="rebalancing" seed="trust-walker" size={150} state="ready" slot="gate-out" />
            </span>
          </div>
        }
        source={home.censusMinutes !== null ? <>We called every agent {home.censusMinutes < 60 ? `${Math.max(1, home.censusMinutes)} min` : `${Math.round(home.censusMinutes / 60)} h`} ago</> : undefined}
      />

      {/* ---------------------------------------------------------- the path */}
      <section className="tr-sec tr-sec--first tr-path" aria-labelledby="tr-path">
        <div className="k-wrap">
          <div className="k-shead">
            <div className="k-shead__copy">
              <h2 className="k-h2" id="tr-path">
                The path to the Hire button.
              </h2>
              <p className="k-body">Three gates, in order. An agent that stops at any of them is still listed, with the reason, and no button.</p>
            </div>
          </div>

          <InView as="ol" className="tr-stations" threshold={0.2}>
            {/* 1. the descent */}
            <li className="tr-station" style={{ ["--i" as string]: 0 }}>
              <div className="tr-station__top">
                <span className="tr-station__who" aria-hidden="true">
                  <Agent job="rebalancing" seed="trust-walker" size={96} state="dozing" slot="st1" />
                </span>
                <div>
                  <p className="tr-station__k">First, the descent</p>
                  <h3 className="k-h3">Does it answer at all?</h3>
                </div>
              </div>
              <ul className="tr-mini">
                {home.stages.map((s) => {
                  const w = s.n ? Math.max(2, (Math.log10(s.n + 1) / Math.log10(max + 1)) * 100) : 0;
                  return (
                    <li key={s.key} className="tr-mini__row" data-key={s.key} data-empty={s.n === null ? "1" : undefined} style={{ ["--w" as string]: `${w}%` }}>
                      <span className="tr-mini__l">{s.label}</span>
                      <span className="tr-mini__bar" aria-hidden="true">
                        <span />
                      </span>
                      <span className="tr-mini__n k-num">{s.n === null ? "not measured" : `${s.key === "readable" || s.key === "reachable" ? "≥" : ""}${fmt(s.n)}`}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="k-src">Log scale. {registered?.source ?? "The registry's own counter"}.</p>
            </li>

            {/* 2. the checks */}
            <li className="tr-station" style={{ ["--i" as string]: 1 }}>
              <div className="tr-station__top">
                <span className="tr-station__who" aria-hidden="true">
                  <Agent job="rebalancing" seed="trust-walker" size={96} state="awake" slot="st2" />
                </span>
                <div>
                  <p className="tr-station__k">Then, the six checks</p>
                  <h3 className="k-h3">Does the chain back its claims?</h3>
                </div>
              </div>
              <ul className="tr-lights">
                {CHECKS.map((c, i) => (
                  <li key={c.id} style={{ ["--i" as string]: i }}>
                    <span className="tr-lights__dot" aria-hidden="true" />
                    <span className="tr-lights__t">{c.t}</span>
                    <span className="tr-lights__q">{c.q}</span>
                  </li>
                ))}
              </ul>
              <p className="k-src">Each check is proven, failed, or not enough evidence. Never added up into one score.</p>
            </li>

            {/* 3. the hire law */}
            <li className="tr-station tr-station--law" style={{ ["--i" as string]: 2 }}>
              <div className="tr-station__top">
                <span className="tr-station__who" aria-hidden="true">
                  <Agent job="rebalancing" seed="trust-walker" size={96} state="ready" slot="st3" />
                </span>
                <div>
                  <p className="tr-station__k">Last, the hire law</p>
                  <h3 className="k-h3">Can a hire be honoured now?</h3>
                </div>
              </div>
              <ul className="tr-law">
                {LAW.map((l, i) => (
                  <li key={l} style={{ ["--i" as string]: i }}>
                    <span className="tr-law__tick" aria-hidden="true">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {l}
                  </li>
                ))}
              </ul>
              <div className="tr-law__out" aria-hidden="true">
                <span className="tr-law__no">
                  <X size={14} strokeWidth={2.6} /> Any no: the reason, no button
                </span>
                <span className="tr-law__btn">Hire</span>
              </div>
            </li>
          </InView>

          <div className="tr-arrive">
            <div className="tr-arrive__crowd" aria-hidden="true">
              {crowd.map((a, k) => (
                <Agent key={a.tokenId} job={a.job} seed={a.tokenId} size={40} state={poseOf(a)} house={a.ours} slot={`hub${k}`} />
              ))}
            </div>
            <p className="tr-arrive__t">
              <strong className="k-num">{hireable}</strong> made it through right now
              {registered?.n ? (
                <>
                  , out of <span className="k-num">{fmt(registered.n)}</span> registered
                </>
              ) : null}
              .
            </p>
            <Link href="/agents" className="k-btn k-btn--primary">
              See who you can hire <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- the doors */}
      <section className="tr-sec" aria-labelledby="tr-doors">
        <div className="k-wrap">
          <div className="k-shead">
            <div className="k-shead__copy">
              <h2 className="k-h2" id="tr-doors">
                Check any of it yourself.
              </h2>
              <p className="k-body">Each room holds one part of the record, with its source and a way to check it.</p>
            </div>
          </div>
          <ul className="tr-doors">
            {DOORS.map((d, i) => (
              <li key={d.href}>
                <Link href={d.href} className="tr-door" style={{ ["--i" as string]: i }}>
                  <span className="tr-door__art" aria-hidden="true">
                    {d.art}
                  </span>
                  <span className="tr-door__body">
                    <span className="tr-door__t">
                      {d.t} <ArrowRight size={16} className="tr-door__go" aria-hidden="true" />
                    </span>
                    <span className="tr-door__why">{d.why}</span>
                    {d.fig ? <span className="tr-door__fig k-num">{d.fig}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="k-small tr-doors__more">
            Deeper still: <Link className="k-link" href="/assay">the method in full</Link>, and{" "}
            <Link className="k-link" href="/evidence/restatement">where we measured our own agents wrong</Link>.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
