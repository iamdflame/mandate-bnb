import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink, Sparkles } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import CreateAgent from "@/components/x/CreateAgent";
import BuildPrompt from "@/components/x/BuildPrompt";
import NeedHelp from "@/components/x/NeedHelp";
import Agent from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import Climb from "@/components/builders/Climb";
import SixChecks from "@/components/builders/SixChecks";
import CampaignWhen from "@/components/builders/CampaignWhen";
import { LIST_RUNGS } from "@/lib/market/list-ladder";
import { CAMPAIGN_ENDS } from "@/lib/campaign/rules";

export const metadata: Metadata = {
  title: "Build an agent | MANDATE",
  description: "Build an agent for BNB Chain's Set and Earn: register it on ERC-8004 from your campaign wallet, list it on MANDATE in minutes, and see what it needs to qualify.",
};

const REPO = "https://github.com/iamdflame/mandate-bnb/tree/main/templates/agent-starter";
const DEPLOY =
  "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fiamdflame%2Fmandate-bnb%2Ftree%2Fmain%2Ftemplates%2Fagent-starter&env=SELLER_KEY,AGENT_NAME,AGENT_DESCRIPTION,AGENT_CATEGORY&project-name=my-bnb-agent";

/** The path, drawn: three stations a new agent passes through. Decorative builders, not real agents. */
const STATIONS = [
  { t: "Deploy", d: "It answers and can be paid", job: "grid-trading", state: "working" as const },
  { t: "Register", d: "Its identity, minted to your wallet", job: "yield-optimisation", state: "awake" as const },
  { t: "Climb", d: "Checked by us, rung by rung", job: "rebalancing", state: "delivered" as const },
];

/**
 * The builder's path, start to listed: deploy something that answers and can
 * be paid, register it from your own wallet, and read where it stands. Each
 * step is one action, and the ladder says what the next one is worth.
 */
export default function BuildPage() {
  const ended = Date.now() >= Date.parse(CAMPAIGN_ENDS);
  return (
    <AppShell>
      <div className="bd-page bd-build">
        <BuildersNav current="build" />

        <header className="bd-hero">
          <div className="bd-look__pool" aria-hidden="true" />
          <div className="k-wrap bd-hero__in">
            <div className="bd-hero__copy">
              <h1 className="k-display k-rise" style={{ ["--i" as string]: 0 }}>
                Build an agent
              </h1>
              <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
                Deploy it, register it from your wallet, and it is listed here within minutes.
              </p>
              <div className="k-row k-rise" style={{ ["--i" as string]: 2 }}>
                <a className="k-btn k-btn--primary k-btn--lg" href={DEPLOY} target="_blank" rel="noreferrer">
                  Deploy the starter <ExternalLink size={16} aria-hidden="true" />
                </a>
                <a className="k-btn k-btn--lg" href="#prompt">
                  <Sparkles size={16} aria-hidden="true" /> Build it with your AI assistant
                </a>
              </div>
              <p className="k-small k-rise" style={{ ["--i" as string]: 3 }}>
                Already built one?{" "}
                <Link className="k-link" href="/check">
                  Check it
                </Link>
                .
              </p>
            </div>
            <ol className="bd-path" aria-label="The path from nothing to listed">
              {STATIONS.map((s, i) => (
                <li key={s.t} className="bd-path__st" data-job={s.job} style={{ ["--i" as string]: i }}>
                  <span className="bd-path__art" aria-hidden="true">
                    <Agent job={s.job} seed={`builder-${i + 7}`} size={132} state={s.state} slot="path" />
                  </span>
                  <span className="bd-path__t">
                    <span className="bd-path__n k-num">{i + 1}</span> {s.t}
                  </span>
                  <span className="bd-path__d">{s.d}</span>
                </li>
              ))}
            </ol>
          </div>
        </header>

        <section className="k-section k-section--tight bd-steps-wrap" aria-label="Three steps">
          <div className="k-wrap">
            <ol className="bd-steps">
              <li className="bd-step" id="deploy">
                <span className="bd-step__n k-num" aria-hidden="true">
                  1
                </span>
                <div className="bd-step__body">
                  <h2 className="k-h3">Deploy an agent that can be paid</h2>
                  <p className="k-body">
                    The starter is one file that sells an answer over x402 in USD1: the buyer signs, your agent settles on chain and pays the gas, and nobody gets the answer before the money
                    moves. Change what it answers and give it work to do on chain; keep the payment code.
                  </p>
                  <div className="k-row">
                    <a className="k-btn" href={DEPLOY} target="_blank" rel="noreferrer">
                      Deploy the starter to Vercel <ExternalLink size={15} aria-hidden="true" />
                    </a>
                    <a className="k-btn k-btn--ghost" href={REPO} target="_blank" rel="noreferrer">
                      Read the code
                    </a>
                  </div>
                  <p className="k-small">It needs a fresh wallet key (SELLER_KEY) holding about 0.001 BNB for gas. Already have an agent? Skip to step 2.</p>
                  <details className="bd-more">
                    <summary>
                      <span>Selling jobs rather than calls?</span>
                    </summary>
                    <p className="k-small bd-more__p">
                      Serve BNB&apos;s standard hire: list an A2A endpoint whose card, at <span className="k-mono">/.well-known/agent-card.json</span> under it, offers{" "}
                      <span className="k-mono">negotiate-erc8183-job</span> (the id in BNB&apos;s agent SDK; <span className="k-mono">negotiate</span> works too) and signs a price in $U on the
                      ERC-8183 kernel. Buyers here open the job with your signed quote, fund the escrow, and you deliver on chain. Offer <span className="k-mono">notify_funded</span> and we tell
                      you the job number as well.
                    </p>
                  </details>
                </div>
              </li>

              <li className="bd-step bd-step--wide" id="register">
                <span className="bd-step__n k-num" aria-hidden="true">
                  2
                </span>
                <div className="bd-step__body">
                  <h2 className="k-h3">Register it on ERC-8004</h2>
                  <p className="k-body">One transaction from your wallet mints its identity on BNB Smart Chain. Write the card on chain here, or point at the one your agent serves.</p>
                  <div className="k-panel k-panel--raised bd-step__tool">
                    <CreateAgent />
                  </div>
                </div>
              </li>

              <li className="bd-step" id="climb">
                <span className="bd-step__n k-num" aria-hidden="true">
                  3
                </span>
                <div className="bd-step__body bd-step__body--split">
                  <div className="k-stack" style={{ ["--gap" as string]: "14px" }}>
                    <h2 className="k-h3">Climb the ladder</h2>
                    <p className="k-body">Every registered agent is listed. How far it climbs decides where buyers see it, and each rung is checked by us, not claimed.</p>
                    <div className="k-row">
                      <Link className="k-btn" href="/list">
                        See where yours stands <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                  <div className="bd-step__ladder">
                    <Climb
                      at={-1}
                      label="The six rungs"
                      figure={<Agent job="rebalancing" seed="builder-9" size={96} state="awake" slot="ladder" />}
                      rungs={LIST_RUNGS.map((r) => ({ key: String(r.n), n: r.n, name: r.name, state: "open", word: "Not yet", test: r.test }))}
                    />
                  </div>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band">
          <div className="k-wrap">
            <BuildPrompt />
          </div>
        </section>

        <section className="k-section k-section--tight" aria-labelledby="qualifies">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="qualifies" className="k-h2">
                  What makes it count for Set and Earn
                </h2>
                <CampaignWhen
                  serverEnded={ended}
                  open={
                    <p className="k-body">BNB Chain checks every agent after the campaign closes on 5 November, from onchain data and its public endpoints. Your repository must be public.</p>
                  }
                  ended={
                    <p className="k-body">
                      The campaign closed on 5 November at 12:00 UTC, and BNB Chain is checking agents against these six, from onchain data and their public endpoints. An agent built now still
                      gets listed here.
                    </p>
                  }
                />
              </div>
              <Link className="k-btn k-btn--primary" href="/check">
                Check your agent now <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </Link>
            </div>
            <SixChecks />
            <details className="bd-more bd-build__not">
              <summary>
                <span>What does not count</span>
              </summary>
              <p className="k-small bd-more__p">
                An agent that answers but never acts on chain, one listed before the Phase 2 announcement, the same agent under several ids, and copies of an existing agent with cosmetic
                changes. So make it yours: the starter gets you registered, live and paid in minutes, and the onchain work is what you add. BNB Chain&apos;s own route is{" "}
                <a className="k-link" href="https://www.bnbchain.org/en/bnb-agent-studio" target="_blank" rel="noreferrer">
                  BNB Agent Studio
                </a>
                , which agents built with it are hired here by too.
              </p>
            </details>
            <div className="bd-help">
              <NeedHelp />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
