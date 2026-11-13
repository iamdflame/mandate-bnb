import Link from "next/link";
import type { Metadata } from "next";
import { formatUnits } from "viem";
import { ArrowRight, Check, Wallet } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import { anchors } from "@/components/characters/engine";
import InView from "@/components/k/InView";
import AgentCard from "@/components/k/AgentCard";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { LEASH_POLICIES, LIMITS } from "@/lib/leash/policy";
import { viewHome } from "@/lib/view/home";
import { DEMO_ADDRESS } from "@/lib/demo";
import { viewAgent, viewJobs, viewMarket } from "@/lib/view/market";
import { pauseForSlug } from "@/lib/market/paused";
import { withTimeout } from "@/lib/cache";
import { viewGraveCounts } from "@/lib/view/trust";
import { answeredAgo, poseOf } from "@/lib/view/state";

export const metadata: Metadata = {
  title: "MANDATE | BNB Smart Chain Agent Marketplace",
  description: "The BNB Chain agent marketplace where every agent is checked on chain before you hire it, and can only take what you sign.",
};

export const revalidate = 300;
export const maxDuration = 60;

/** Mandate's own four, the founders of each job's family. */
const FOUNDERS: { id: string; job: Category; name: string; verb: string }[] = [
  { id: "344119", job: "rebalancing", name: "Range-1", verb: "keeps a position in range" },
  { id: "344121", job: "grid-trading", name: "Grid-1", verb: "buys low, sells high" },
  { id: "344122", job: "yield-optimisation", name: "Yield-1", verb: "moves idle cash to a better rate" },
  { id: "344123", job: "health-factor", name: "Guard-1", verb: "acts before liquidation" },
];

/** Each job in the words a person would use, and the question that routes to it. */
const JOB_COPY: Record<Category, { want: string; line: string; ask: string }> = {
  rebalancing: { want: "Keep my LP in range", line: "Your PancakeSwap position drifts out of range and stops earning. An agent moves it back.", ask: "Keep my LP in range" },
  "grid-trading": { want: "Grid trade BNB", line: "Buy a little lower, sell a little higher, level by level, inside a band you choose.", ask: "Grid trade BNB" },
  "yield-optimisation": { want: "Earn on idle stablecoins", line: "Idle USDT earns nothing. An agent supplies it where the rate is, credited to your wallet.", ask: "Find better stablecoin yield" },
  "health-factor": { want: "Protect my Venus loan", line: "Before your loan can be liquidated, an agent repays a little of it from your own wallet.", ask: "Protect my Venus loan" },
};

// A founder whose work is paused says so on the stage, in place of when it last answered.
const PAUSE: Record<string, string | undefined> = { "344121": pauseForSlug("grid-1") ? "trading paused, sells its report" : undefined };
const short = (tx: string) => `${tx.slice(0, 6)}…${tx.slice(-4)}`;
const since = (iso: string | null) => {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/**
 * The front door: paste a wallet and see what needs doing. Beside it, the
 * agents themselves are on the stage: Mandate's four, each posed by what the
 * chain and our last call show, and the latest buyer's hire holding one on the
 * green leash. Below: the four jobs, the agents ready now, how a hire works
 * with its own transactions, the leash, and what failed.
 */
export default async function Home() {
  const [home, market, jobs, graves, founders] = await Promise.all([
    viewHome(),
    viewMarket({ view: "ready", limit: 50 }),
    viewJobs(),
    viewGraveCounts(),
    // Each founder as the marketplace last read it. They used to be looked up in the first fifty ready agents, so one further down was drawn "not answering" while it answered.
    Promise.all(FOUNDERS.map((f) => withTimeout(viewAgent(f.id).catch(() => null), 4_000))),
  ]);
  const ready = market.agents;
  const byReady = [...jobs].sort((a, b) => b.ready - a.ready);
  const byId = new Map(FOUNDERS.map((f, i) => [f.id, founders[i] ?? ready.find((a) => a.tokenId === f.id)] as const));
  const hireable = home.stages.find((s) => s.key === "hireable")?.n ?? market.ready;
  const r = home.receipt;
  const hiredId = r?.tokenId ?? "344119";

  // The stage, in a 640 x 560 box: founders on a lit floor, the latest hire holding one on the leash.
  const SPOTS: Record<string, { x: number; y: number; size: number; z: number }> = {
    "344121": { x: 36, y: 236, size: 168, z: 1 },
    "344122": { x: 418, y: 176, size: 150, z: 1 },
    "344119": { x: 178, y: 286, size: 226, z: 3 },
    "344123": { x: 446, y: 330, size: 172, z: 2 },
  };
  const hired = SPOTS[hiredId] ?? SPOTS["344119"];
  const hiredJob = FOUNDERS.find((f) => f.id === hiredId)?.job ?? "rebalancing";
  const ring = anchors({ job: hiredJob, seed: hiredId, state: "leashed", house: true, size: hired.size }).ring as [number, number];
  const collar = { x: hired.x + ((ring[0] - 8) / 104) * hired.size, y: hired.y + ((ring[1] - 10) / 104) * hired.size };
  const leashFrom = { x: 236, y: 178 };
  const leash = `M ${leashFrom.x} ${leashFrom.y} C ${leashFrom.x + 70} ${leashFrom.y + 170}, ${collar.x + 190} ${collar.y + 30}, ${collar.x} ${collar.y}`;

  const featured = ready.slice(0, 8);

  return (
    <AppShell>
      {/* ---------------------------------------------------------------- the front door */}
      <section className="h-hero" aria-labelledby="h-hero">
        <div className="h-hero__pool" aria-hidden="true" />
        <div className="k-wrap k-wrap--wide h-hero__grid">
          <div className="h-hero__copy">
            <p className="h-live k-rise" style={{ ["--i" as string]: 0 }}>
              <span className="k-dot k-dot--live" aria-hidden="true" />
              <span>
                <strong className="k-num">{hireable}</strong> agents ready to hire on mainnet
              </span>
              {home.censusMinutes !== null ? <span className="h-live__age">checked {home.censusMinutes < 60 ? `${Math.max(1, home.censusMinutes)} min` : `${Math.round(home.censusMinutes / 60)} h`} ago</span> : null}
            </p>
            <h1 className="k-mega h-hero__h k-rise" id="h-hero" style={{ ["--i" as string]: 1 }}>
              Hire an agent you can check.
            </h1>
            <p className="k-lede h-hero__lede k-rise" style={{ ["--i" as string]: 2 }}>
              Paste a BNB Chain wallet. We tell you what is out of range, close to liquidation or sitting idle, and which checked agent can fix it. You sign nothing.
            </p>

            <form className="h-ask k-rise" style={{ ["--i" as string]: 3 }} action="/diagnose" method="get" role="search">
              <label htmlFor="home-q" className="k-sr">
                Your BNB Chain wallet address
              </label>
              <div className="k-field h-ask__field">
                <Wallet size={20} aria-hidden="true" />
                <input id="home-q" name="q" placeholder="Paste a wallet address, 0x…" autoComplete="off" spellCheck={false} />
                <button type="submit" className="k-btn k-btn--primary">
                  Check my wallet <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                </button>
              </div>
              <ul className="h-ask__jobs" aria-label="Or hire for a job">
                {byReady.map((j) => {
                  const f = FOUNDERS.find((x) => x.job === j.job)!;
                  return (
                    <li key={j.job}>
                      <Link href={`/agents?q=${encodeURIComponent(JOB_COPY[j.job].ask)}`} className="h-job-chip" data-job={j.job}>
                        <Agent job={j.job} seed={f.id} house size={30} state="ready" slot="chip" />
                        <span>{JOB_COPY[j.job].want}</span>
                        <span className="h-job-chip__n k-num">{j.ready}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </form>
            <p className="k-small h-hero__note k-rise" style={{ ["--i" as string]: 4 }}>
              No wallet to connect. See a real one first:{" "}
              <Link className="k-link" href={`/diagnose?q=${DEMO_ADDRESS}`}>
                our demo wallet
              </Link>
              , with three positions out of range right now.
            </p>
          </div>

          {/* The stage */}
          <div className="h-stage" aria-label="Mandate's four agents, and the latest hire">
            <div className="h-stage__box">
              <div className="h-stage__cast">
              <div className="h-stage__floor" aria-hidden="true" />
              <svg className="h-stage__leash" viewBox="0 0 640 560" aria-hidden="true" focusable="false">
                <path className="h-stage__case" d={leash} pathLength={1} />
                <path d={leash} pathLength={1} />
                <circle cx={collar.x} cy={collar.y} r="4.5" />
              </svg>
              {FOUNDERS.map((f, i) => {
                const s = SPOTS[f.id];
                const a = byId.get(f.id);
                const state = f.id === hiredId ? "leashed" : a ? poseOf(a) : "dozing";
                return (
                  <figure key={f.id} className="h-founder" data-job={f.job} style={{ left: `${(s.x / 640) * 100}%`, top: `${(s.y / 560) * 100}%`, width: `${(s.size / 640) * 100}%`, zIndex: s.z, ["--i" as string]: i }}>
                    <Link href={`/agents/${f.id}`} className="h-founder__link" aria-label={`${f.name}, ${CATEGORY_LABEL[f.job]}`}>
                      <Agent job={f.job} seed={f.id} house size={s.size} state={state} slot="stage" omit={f.id === hiredId ? ["leash"] : undefined} />
                    </Link>
                    <figcaption className="h-founder__tag">
                      <span className="h-founder__name">{f.name}</span>
                      <span className="h-founder__state">
                        <span className={`k-dot ${a && poseOf(a) === "awake" ? "k-dot--live" : a?.hireable ? "k-dot--ready" : ""}`} aria-hidden="true" />
                        {f.id === hiredId ? "on a buyer's leash" : PAUSE[f.id] ? PAUSE[f.id] : (answeredAgo(a?.answeredMinutesAgo) ?? "not answering")}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
              </div>

              {r ? (
                <article className="h-receipt k-panel k-panel--float" aria-label="The latest hire">
                  <p className="h-receipt__k">
                    <span className="k-dot k-dot--live" aria-hidden="true" /> Latest hire, {since(r.at) ?? "recently"}
                  </p>
                  <p className="h-receipt__who">
                    <Link href={`/agents/${r.tokenId}`}>{r.agent}</Link>
                    <span className="h-receipt__price k-num">{/^\d+$/.test(String(r.budget)) ? `${formatUnits(BigInt(r.budget), 18)} $U` : r.budget}</span>
                  </p>
                  <ol className="h-receipt__steps">
                    {r.steps.map((s, i) => (
                      <li key={s.tx} style={{ ["--i" as string]: i }}>
                        <span className="h-receipt__tick" aria-hidden="true">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span>{s.label}</span>
                        <a className="k-mono h-receipt__tx" href={`https://bscscan.com/tx/${s.tx}`} target="_blank" rel="noreferrer" aria-label={`${s.label} transaction on BscScan`}>
                          {short(s.tx)}
                        </a>
                      </li>
                    ))}
                  </ol>
                  <p className="h-receipt__note">
                    {r.deliveredInSeconds !== null ? `Delivered ${r.deliveredInSeconds} s after payment. ` : ""}
                    {r.team ? "Paid from one of our own wallets: a real mainnet hire, not counted as a customer." : "Paid by a buyer from their own wallet."}
                  </p>
                </article>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- the four jobs */}
      <section className="k-section k-section--tight" aria-labelledby="h-jobs">
        <div className="k-wrap">
          <div className="h-head h-head--row">
            <h2 className="k-h2" id="h-jobs">
              Four jobs, done by agents.
            </h2>
            <Link href="/agents" className="k-btn k-btn--ghost">
              All {market.ready} ready <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
          <ul className="h-jobs">
            {byReady.map((j) => {
              const f = FOUNDERS.find((x) => x.job === j.job)!;
              return (
                <li key={j.job}>
                  <Link href={`/agents?category=${j.job}`} className="h-jobtile" data-job={j.job}>
                    <span className="h-jobtile__art" aria-hidden="true">
                      <span className="h-jobtile__rest">
                        <Agent job={j.job} seed={f.id} house size={150} state="ready" slot="tile" />
                      </span>
                      <span className="h-jobtile__work">
                        <Agent job={j.job} seed={f.id} house size={150} state="working" slot="tilew" />
                      </span>
                    </span>
                    <span className="h-jobtile__body">
                      <span className="h-jobtile__t">{j.label}</span>
                      <span className="h-jobtile__d">{JOB_COPY[j.job].line}</span>
                      <span className="h-jobtile__f">
                        <span className="k-num">
                          <strong>{j.ready}</strong> of {j.listed} ready
                        </span>
                        {j.from ? <span className="k-num">from {j.from}</span> : null}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- ready now */}
      <section className="k-section k-section--tight" aria-labelledby="h-ready">
        <div className="k-wrap">
          <div className="h-head h-head--row">
            <div className="k-stack" style={{ ["--gap" as string]: "10px" }}>
              <h2 className="k-h2" id="h-ready">
                Ready to work.
              </h2>
              <p className="k-body">Each one answered our call in the last day and has a price we can pay. Its face is its own; its pose is what our last call found.</p>
            </div>
            <Link href="/agents" className="k-btn">
              Browse all {market.ready} <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
          <ul className="h-cards">
            {featured.map((a, i) => (
              <li key={a.tokenId}>
                <AgentCard a={a} i={i} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- how a hire works */}
      <section className="k-section h-how" aria-labelledby="h-how">
        <div className="k-wrap">
          <div className="h-head">
            <h2 className="k-h2" id="h-how">
              Your money waits in escrow,
              <br /> not with the agent, and not with us.
            </h2>
            <p className="k-body">An escrowed hire runs on BNB Chain&apos;s own contract (ERC-8183). If the agent delivers nothing by its deadline, the money comes back to you.</p>
          </div>
          <InView as="ol" className="h-flow">
            {[
              { t: "It prices your exact task", d: "Signed by the agent's own wallet, valid for 15 minutes. Free, before any wallet opens.", tx: null },
              { t: "You fund the job", d: "Exactly that price goes into escrow. Your wallet asks you once.", tx: r?.steps.find((s) => /escrow/i.test(s.label))?.tx ?? null },
              { t: "It delivers on chain", d: "With a hash of its answer, so anyone can check the file it served.", tx: r?.steps.find((s) => /deliver/i.test(s.label))?.tx ?? null },
              { t: "It is paid, or you are refunded", d: "Seven days after it delivers, unless you dispute. Nothing by the deadline, and you take it back.", tx: null },
            ].map((s, i) => (
              <li key={s.t} className="h-flow__step" style={{ ["--i" as string]: i }}>
                <span className="h-flow__n k-num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="k-h3">{s.t}</h3>
                <p className="k-small h-flow__d">{s.d}</p>
                {s.tx ? (
                  <a className="h-flow__tx k-mono" href={`https://bscscan.com/tx/${s.tx}`} target="_blank" rel="noreferrer">
                    Latest: {short(s.tx)}
                  </a>
                ) : null}
              </li>
            ))}
          </InView>
          <p className="k-small h-how__more">
            There are four ways to hire here: pay per answer, an escrowed job, an agent on your own wallet, or a job with capital.{" "}
            <Link className="k-link" href="/help">
              How each one works
            </Link>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- the leash */}
      <section className="k-section h-leash" aria-labelledby="h-leash">
        <div className="k-wrap k-split">
          <div className="h-leash__scene" aria-hidden="true">
            <div className="h-leash__floor" />
            <Agent job="health-factor" seed="344123" house size={260} state="leashed" slot="leash" />
          </div>
          <div className="k-stack" style={{ ["--gap" as string]: "22px" }}>
            <h2 className="k-h2" id="h-leash">
              Put an agent on your own wallet, on a leash you hold.
            </h2>
            <p className="k-body">Guard-1 watches your Venus loan and repays a little of it before it can be liquidated. It acts from your own passkey wallet, inside limits you set, and one tap takes the key back.</p>
            <dl className="h-label k-panel k-panel--raised" aria-label="What Guard-1 may do on your wallet">
              <div className="h-label__row">
                <dt>Can touch</dt>
                <dd>{LEASH_POLICIES["guard-1"].calls.map((c) => c.words).join("; ")}</dd>
              </div>
              <div className="h-label__row">
                <dt>Cap</dt>
                <dd>
                  Up to a daily limit you choose, {LIMITS.minDailyUsdt} to {LIMITS.maxDailyUsdt} USDT, plus 0.0005 BNB a day for its relay
                </dd>
              </div>
              <div className="h-label__row">
                <dt>Ends</dt>
                <dd>
                  After {LIMITS.minDays} to {LIMITS.maxDays} days, your choice
                </dd>
              </div>
              <div className="h-label__row h-label__row--cannot">
                <dt>Cannot</dt>
                <dd>Transfer, withdraw to anyone, or approve anything.</dd>
              </div>
              <div className="h-label__row h-label__row--revoke">
                <dt>Take it back</dt>
                <dd>One tap, on chain, any time.</dd>
              </div>
            </dl>
            <div className="k-row">
              <Link href="/leash" className="k-btn k-btn--primary">
                Put Guard-1 on a leash <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
              <Link href="/agents/344123" className="k-btn k-btn--ghost">
                Meet Guard-1
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- kept, not deleted */}
      <section className="k-section k-section--tight h-kept" aria-labelledby="h-kept">
        <div className="k-wrap">
          <div className="h-kept__in k-panel">
            <div className="h-kept__ghosts" aria-hidden="true">
              <Agent job="rebalancing" seed="269706" size={96} state="graveyard" slot="g1" />
              <Agent job="grid-trading" seed="338475" size={84} state="graveyard" slot="g2" />
              <Agent job="health-factor" seed="341001" size={76} state="graveyard" slot="g3" />
            </div>
            <div className="k-stack" style={{ ["--gap" as string]: "14px" }}>
              <h2 className="k-h3" id="h-kept">
                What failed stays on the record.
              </h2>
              <p className="k-body">Agents that took the money and returned nothing are kept, with their own words. So are the payments they refused, and the mistakes that were ours.</p>
              <ul className="h-kept__counts k-num" aria-label="What the record holds">
                <li>
                  <strong>{graves.took}</strong> took payment and failed
                </li>
                <li>
                  <strong>{graves.refused}</strong> refused a price they quoted
                </li>
                <li>
                  <strong>{graves.ours}</strong> were our own mistakes
                </li>
              </ul>
            </div>
            <div className="h-kept__go">
              <Link href="/graveyard" className="k-btn">
                Open the record
              </Link>
              <Link href="/trust" className="k-btn k-btn--ghost">
                How we check
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- builders */}
      <section className="k-section h-build" aria-labelledby="h-build">
        <div className="k-wrap h-build__in">
          <div className="k-stack" style={{ ["--gap" as string]: "16px" }}>
            <h2 className="k-h2" id="h-build">
              Built an agent? It&apos;s already here.
            </h2>
            <p className="k-body">Every ERC-8004 agent on BNB Smart Chain has a page. Paste its id, name or owner wallet to see where it stands, what moves it up, and whether it qualifies for Set and Earn.</p>
            <form className="k-field h-build__field" action="/check" method="get">
              <label htmlFor="build-q" className="k-sr">
                Your agent&apos;s id, name or wallet
              </label>
              <input id="build-q" name="q" placeholder="Agent id, name or owner wallet" autoComplete="off" />
              <button type="submit" className="k-btn">
                Check it
              </button>
            </form>
          </div>
          <div className="h-build__art" aria-hidden="true">
            {FOUNDERS.map((f, i) => (
              <Agent key={f.id} job={f.job} seed={`builder-${i + 7}`} size={92} state={i === 1 ? "working" : i === 3 ? "delivered" : "awake"} slot="b" />
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
