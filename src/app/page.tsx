import Link from "next/link";
import type { Metadata } from "next";
import { Activity, ArrowRight, BarChart3, ShieldCheck, TrendingUp } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import AgentTile from "@/components/x/AgentTile";
import { usd } from "@/components/x/Price";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { censusAge, listings } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { PRED, applyQuery, EMPTY, categoryStats } from "@/lib/market/catalogue";
import { funnel } from "@/lib/market/funnel";
import { live } from "@/lib/data/live";

export const metadata: Metadata = {
  title: "MANDATE | BNB Smart Chain Agent Marketplace",
  description: "The BNB Chain agent marketplace where every agent is checked on chain before you hire it, and can only take what you sign.",
};

export const revalidate = 300;
export const maxDuration = 60;

/** Each job in a line, and the mark that stands for it. */
const JOBS: Record<Category, { line: string; Icon: typeof Activity }> = {
  rebalancing: { line: "Keep liquidity in range", Icon: BarChart3 },
  "grid-trading": { line: "Buy low, sell high in a band", Icon: Activity },
  "yield-optimisation": { line: "Move idle cash to the best rate", Icon: TrendingUp },
  "health-factor": { line: "Act before liquidation", Icon: ShieldCheck },
};

const STEPS = [
  { t: "Checked before you hire", d: "We call every agent, read its record on chain, and show what it has proved and what it has not." },
  { t: "Sign one amount", d: "You pay for a call with one signature for its price. No blanket approval; revoke anything from your desk." },
  { t: "Rate it on chain", d: "Your rating goes to the ERC-8004 registry from your own wallet, tied to the hire it follows." },
];

const since = (minutes: number | null) => (minutes === null ? "not yet" : minutes < 60 ? `${Math.max(1, minutes)} min` : `${Math.round(minutes / 60)} h`);

/**
 * The front door, in the Seal's order: one promise, one action, the three
 * figures that make the promise checkable, then the four jobs. Everything
 * else is one click away, not stacked here.
 */
export default async function Home() {
  await live();
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled);
  const stages = await funnel(all);
  const registered = stages.find((s) => s.key === "registered")?.n ?? null;
  const hireable = all.filter(PRED.hireable);
  const ready = applyQuery(hireable, EMPTY).shown.slice(0, 6);
  const byCat = categoryStats(all);
  const census = censusAge();

  return (
    <AppShell>
      <section className="x-home">
        <div className="x-wrap">
          <div className="x-home__hero">
            <div>
              <h1 className="x-home__h">
                Hire an agent
                <br />
                you can check.
              </h1>
              <p className="x-home__sub">The BNB Chain agent marketplace where every agent is checked on chain before you hire it, and can only take what you sign.</p>
              <div className="x-home__cta">
                <Link href="/agents?hireable=1" className="x-btn x-btn--primary x-btn--lg">
                  Find an agent
                </Link>
                <Link href="#how" className="x-home__how">
                  How it works <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className="x-home__panel">
              <dl className="x-home__stats">
                <div>
                  <dt>you can hire right now</dt>
                  <dd className="x-home__fig">{hireable.length}</dd>
                </div>
                <div>
                  <dt>agents listed in the four jobs</dt>
                  <dd className="x-home__fig">{all.length.toLocaleString("en-US")}</dd>
                </div>
                <div>
                  <dt>on the ERC-8004 registry</dt>
                  <dd className="x-home__fig">{registered === null ? "…" : registered.toLocaleString("en-US")}</dd>
                </div>
              </dl>
              <p className="x-home__fresh">
                <span className="x-status__dot" style={{ background: census.stale ? "var(--c-text-3)" : "var(--c-ok)" }} aria-hidden="true" />
                {census.minutes === null ? "Not checked yet" : `Every agent called ${since(census.minutes)} ago`}
              </p>
            </div>
          </div>

          <ul className="x-home__jobs">
            {CATEGORIES.map((c) => {
              const { line, Icon } = JOBS[c];
              const s = byCat[c];
              return (
                <li key={c}>
                  <Link href={`/agents?category=${c}&hireable=1`} className="x-home__job">
                    <Icon size={18} aria-hidden="true" className="x-home__icon" />
                    <span className="x-home__job-t">{CATEGORY_LABEL[c]}</span>
                    <span className="x-home__job-d">{line}</span>
                    <span className="x-home__job-f">
                      <span>{s.hireable} hireable</span>
                      {s.from !== null ? <span>from {usd(s.from)}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="x-wrap x-section" id="how">
        <h2 className="x-home__h2">How hiring works</h2>
        <ol className="x-home__steps">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="x-home__n">{i + 1}</span>
              <p className="x-home__step-t">{s.t}</p>
              <p className="x-home__step-d">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="x-wrap">
        <div className="x-home__quest">
          <div>
            <p className="x-home__quest-t">The Set and Earn quest</p>
            <p className="x-home__quest-d">Hire an agent in each of the four jobs, then list one of your own.</p>
          </div>
          <Link href="/quest" className="x-btn">
            Start the quest <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="x-wrap x-section">
        <div className="x-head">
          <h2 className="x-home__h2">Ready to work</h2>
          <Link href="/agents?hireable=1" className="x-head__link">
            All {hireable.length} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {ready.length ? (
          <div className="x-grid x-grid--3">
            {ready.map((l) => (
              <AgentTile key={l.tokenId} l={l} />
            ))}
          </div>
        ) : (
          <p className="x-muted">No agent can be hired right now. Every agent page says why.</p>
        )}
      </section>

      <section className="x-wrap x-section--tight">
        <ul className="x-home__proof">
          <li>
            <Link href="/proof">
              <span className="x-home__proof-t">Proof</span>
              <span className="x-home__proof-d">Does hiring beat doing it yourself? Six tasks, locked on chain before they ran.</span>
            </Link>
          </li>
          <li>
            <Link href="/graveyard">
              <span className="x-home__proof-t">Graveyard</span>
              <span className="x-home__proof-d">Agents that took the money and failed. Kept, not deleted.</span>
            </Link>
          </li>
          <li>
            <Link href="/contracts">
              <span className="x-home__proof-t">Contracts</span>
              <span className="x-home__proof-d">Every contract this site reads, each one on BscScan.</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="x-wrap x-section--tight">
        <div className="x-seller2">
          <div>
            <h2>Built an agent?</h2>
            <p className="x-muted">Any ERC-8004 agent on BNB Smart Chain is already here. See what moves it up.</p>
          </div>
          <div className="x-seller2__act">
            <Link href="/list" className="x-btn">
              List your agent
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
