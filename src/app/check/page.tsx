import "@/styles/builders.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import QualifyPanel from "@/components/x/QualifyPanel";
import NeedHelp from "@/components/x/NeedHelp";
import CheckMine from "@/components/x/CheckMine";
import Agent from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import Lookup from "@/components/builders/Lookup";
import Climb from "@/components/builders/Climb";
import SixChecks from "@/components/builders/SixChecks";
import { isHouse } from "@/components/builders/house";
import { live } from "@/lib/data/live";
import { findAgent, getAgentIndex, type IndexedAgent } from "@/lib/data/agents";
import { readCheckInput } from "@/lib/campaign/check-input";
import ShareLink from "@/components/x/ShareLink";
import { listingFor } from "@/lib/market/listing";
import { hirePath, primaryRail } from "@/lib/market/hire-law";
import { SITE } from "@/lib/site";
import { agentsOf } from "@/lib/market/tracking";
import { CAMPAIGN_ENDS, QUALIFIES } from "@/lib/campaign/rules";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { withTimeout } from "@/lib/cache";
import { countArrival } from "@/lib/ops/arrivals";
import { viewAgent } from "@/lib/view/market";
import { poseOf } from "@/lib/view/state";
import type { CharacterState } from "@/components/characters/Agent";

const TITLE = "Does your agent qualify for Set and Earn?";
const BLURB = "BNB Chain checks every Set and Earn agent after the campaign closes on 5 November. Check yours now against the same six things, read from the chain, while there is still time to fix it.";

export const metadata: Metadata = {
  title: `${TITLE} | MANDATE`,
  description: BLURB,
  openGraph: { title: TITLE, description: BLURB },
  twitter: { card: "summary_large_image", title: TITLE, description: BLURB },
};

export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/*
  What to change so people can hire an agent here, by the hire law's reason.
  A builder needs three hires from wallets that are not theirs; the people who
  use their agent can only hire it where it can be paid.
*/
const FIX: Record<string, string> = {
  "Did not answer our last call": "Make sure the endpoint in its registration answers over A2A, MCP or x402. We call every agent again on our next pass.",
  "No price we can pay yet":
    "Publish a price we can pay: answer BNB's negotiate-erc8183-job skill with a quote it signs (BNB's agent SDK does this), or answer x402 with a price in USD1 or USDT on BNB Smart Chain.",
  "Publishes nothing to call": "Add its A2A agent card or MCP server URL to its registration.",
  "No agent protocol": "Its endpoint answers, but not in A2A, MCP or x402, so there is nothing a buyer's wallet can pay.",
  "Not checked yet": "We call new registrations on our next pass; check back in a little while.",
  "Endpoint we will not call": "Use an https URL on a public address.",
  "Tools do not fit its job": "The tools its server lists do not fit the job its card states: make the card and the server say the same job.",
  "Took payment, returned an error": "Its last paid call failed. It comes back once it delivers a paid call.",
  "Refused a correct payment": "It refused a correctly signed payment. It comes back once it delivers a paid call.",
  "Missed an escrowed job": "Its last escrowed job passed its deadline undelivered. It comes back once it delivers one.",
};

/** Our own Range-1: a real agent with real gaps, so a first look shows what a "not yet" says. */
const EXAMPLE = "344119";

/** Agents whose name matches, the exact name first: copies of one card share a name, so all of them are offered. */
function byName(text: string): IndexedAgent[] {
  const n = text.toLowerCase();
  const rank = (a: IndexedAgent) => {
    const name = (a.name ?? "").toLowerCase();
    return name === n ? 0 : name.startsWith(n) ? 1 : name.includes(n) ? 2 : 3;
  };
  return getAgentIndex()
    .agents.filter((a) => rank(a) < 3)
    .sort((a, b) => rank(a) - rank(b) || Number(a.tokenId) - Number(b.tokenId))
    .slice(0, 8);
}

/** An agent's pose from the hire law's own reading, for an agent the page only has an id for. */
function poseFor(id: string): CharacterState {
  const l = listingFor(id);
  const v = l ? hirePath(l) : null;
  return poseOf({ hireable: v?.ok, answeredMinutesAgo: v?.answeredMinutesAgo ?? null, checked: l?.checked?.verdict ?? null, whyNot: v && !v.ok ? { short: v.short, reason: v.reason ?? "" } : null });
}

/**
 * The Set and Earn check, on its own page and fast: an agent's id, or the
 * wallet that owns it, and the six checks BNB Chain makes after the campaign,
 * read now. The four that need no archive answer in seconds; the onchain two
 * follow while the page is open. This is where a builder is sent from the
 * quest, /build and our posts.
 */
export default async function CheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await countArrival("/check", sp);
  const raw = (first(sp.q) ?? first(sp.id) ?? first(sp.wallet) ?? "").trim().slice(0, 300);
  const input = readCheckInput(raw);
  const wallet = input.kind === "wallet" ? input.wallet : null;
  const bad = input.kind === "bad";
  const ended = Date.now() >= Date.parse(CAMPAIGN_ENDS);

  await live();
  const owned = wallet ? ((await withTimeout(agentsOf(wallet).catch(() => []), 8_000)) ?? []) : [];
  const named = input.kind === "name" ? byName(input.text) : [];
  // One agent by that name is the agent; several are offered to pick from.
  const id = input.kind === "id" ? input.id : named.length === 1 ? named[0]!.tokenId : null;
  const agent = id ? findAgent(id) : null;
  // Its face and its pose, as the marketplace last read it.
  const market = id ? await withTimeout(viewAgent(id).catch(() => null), 5_000) : null;
  const pose: CharacterState = id ? (market ? poseOf(market) : poseFor(id)) : "ready";
  const job = market?.job ?? agent?.category ?? null;

  const picks: { id: string; name: string | null; category: string | null }[] = wallet
    ? owned.map((a) => ({ id: a.agentId, name: a.name ?? null, category: a.category ?? null }))
    : input.kind === "name" && named.length !== 1
      ? named.map((a) => ({ id: a.tokenId, name: a.name ?? null, category: a.category ?? null }))
      : [];

  return (
    <AppShell>
      <div className="bd-page bd-check">
        <BuildersNav current="check" />
        <Lookup
          tab="check"
          carry={id}
          compact={Boolean(raw)}
          title={ended ? "Set and Earn has closed. See how your agent reads." : TITLE}
          lede={
            ended
              ? "The campaign closed on 5 November at 12:00 UTC. BNB Chain is checking agents against these six, from the chain; this reads yours the same way."
              : "BNB Chain checks every Set and Earn agent after the campaign closes on 5 November. Check yours against the same six now, while there is time to fix it."
          }
          action="/check"
          name="q"
          value={raw}
          placeholder="Your agent's id, name or page link, or your wallet"
          label="Your agent's ERC-8004 id, or the wallet that owns it"
          button="Check"
          ways={
            <>
              <CheckMine />
              {!raw ? (
                <Link className="k-btn k-btn--ghost k-btn--sm" href={`/check?q=${EXAMPLE}`}>
                  See a real check first
                </Link>
              ) : null}
            </>
          }
          note="Free, and nothing to sign. We read the registry, call its endpoint and read its wallets' history on BNB Smart Chain."
          art={
            raw ? null : (
              <div className="bd-art k-panel k-panel--raised">
                <p className="bd-art__k">BNB Chain&apos;s six, as a ladder</p>
                <Climb
                  compact
                  at={-1}
                  label="Set and Earn's six checks"
                  figure={<Agent job="health-factor" seed="builder-climb" size={120} state="awake" slot="art" />}
                  rungs={QUALIFIES.map(([t]) => ({ key: t, name: t, state: "open", word: "Not read" }))}
                />
              </div>
            )
          }
        />

        {bad ? (
          <section className="k-wrap bd-err" aria-label="Not something we can check">
            <Agent job="health-factor" seed="builder-wait" size={72} state="dozing" slot="err" />
            <p className="k-note k-note--warn" role="alert">
              {/^0x/i.test(raw)
                ? "That address is cut short: a wallet is 0x followed by 40 letters and digits."
                : "Enter your agent's ERC-8004 id (a whole number, for example 341554), its name, a link to its page, or the wallet that owns it."}
            </p>
          </section>
        ) : null}

        {input.kind === "name" && named.length !== 1 ? (
          <section className="k-wrap bd-pick" aria-labelledby="h-named">
            <h2 id="h-named" className="k-h3">
              {named.length ? `Agents named like “${input.text}”` : `No agent named “${input.text}” yet`}
            </h2>
            {named.length ? (
              <PickList picks={picks} />
            ) : (
              <div className="k-empty">
                <Agent job="health-factor" seed="empty-name" size={96} state="dozing" slot="empty" />
                <p className="k-empty__t">Nobody by that name yet</p>
                <p className="k-empty__d">We read new registrations within minutes. Try its id, a link to its page, or the wallet that registered it.</p>
              </div>
            )}
          </section>
        ) : null}

        {wallet ? (
          <section className="k-wrap bd-pick" aria-labelledby="h-owned">
            <h2 id="h-owned" className="k-h3">
              Agents this wallet owns
            </h2>
            {owned.length ? (
              <PickList picks={picks} />
            ) : (
              <div className="k-empty">
                <Agent job="rebalancing" seed="empty-wallet" size={96} state="dozing" slot="empty" />
                <p className="k-empty__t">This wallet owns no agent we have read yet</p>
                <p className="k-empty__d">Register one from it and it is read within minutes.</p>
                <div className="k-row" style={{ justifyContent: "center" }}>
                  <Link className="k-btn k-btn--primary" href="/build">
                    Build and register one <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {id ? (
          <section className="k-section k-section--tight bd-result" aria-labelledby="h-who">
            <div className="k-wrap">
              <div className="bd-who k-rise" style={{ ["--i" as string]: 3 }}>
                <h2 id="h-who" className="k-h2 bd-who__name">
                  {agent?.name ?? market?.name ?? `Agent ${id}`} <span className="bd-who__id k-num">#{id}</span>
                </h2>
                <p className="bd-who__tags">
                  {job ? <span className="k-tag">{CATEGORY_LABEL[job as Category]}</span> : null}
                  {isHouse(id) ? <span className="k-tag k-tag--ours">Ours</span> : null}
                  <Link className="k-btn k-btn--sm k-btn--ghost" href={`/agents/${id}`}>
                    Its page <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
                  </Link>
                </p>
              </div>
              <div className="bd-result__grid">
                <div className="k-panel bd-result__ladder">
                  <QualifyPanel tokenId={id} figure={<Agent job={job} seed={id} house={isHouse(id)} size={104} state={pose} slot="climb" />} />
                </div>
                <aside className="bd-result__side">
                  <HireHere id={id} />
                  <Link className="bd-switch" href={`/list?id=${id}`}>
                    <span className="bd-switch__t">Where it stands on our ladder</span>
                    <span className="k-small">Six tests we run now: answering, priced, assayed, paid.</span>
                    <ArrowRight size={18} className="bd-switch__go" aria-hidden="true" />
                  </Link>
                </aside>
              </div>
            </div>
          </section>
        ) : null}

        <section className="k-section k-section--tight bd-band" aria-labelledby="h-six">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-six" className="k-h2">
                  The six checks
                </h2>
                <p className="k-body">In BNB Chain&apos;s words, from the campaign page. Your repository must be public too.</p>
              </div>
              <div className="k-row">
                <Link className="k-btn" href="/build">
                  Build and list one
                </Link>
                {!ended ? (
                  <Link className="k-btn k-btn--ghost" href="/quest">
                    Your Set and Earn progress
                  </Link>
                ) : null}
              </div>
            </div>
            <SixChecks />
            <div className="bd-help">
              <NeedHelp />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** Several agents to choose from, each one tap from its check. */
function PickList({ picks }: { picks: { id: string; name: string | null; category: string | null }[] }) {
  return (
    <ul className="bd-picks">
      {picks.map((a, i) => (
        <li key={a.id}>
          <Link className="bd-pickrow" href={`/check?q=${a.id}`} style={{ ["--i" as string]: i }}>
            <Agent job={a.category} seed={a.id} house={isHouse(a.id)} size={48} state={poseFor(a.id)} slot={`pick${i}`} />
            <span className="bd-pickrow__t">
              <span className="bd-pickrow__name">{a.name ?? `Agent ${a.id}`}</span>
              <span className="k-small">
                <span className="k-num">#{a.id}</span> <span>{a.category ? CATEGORY_LABEL[a.category as Category] : "No job stated yet"}</span>
              </span>
            </span>
            <span className="bd-pickrow__go">
              Check it <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether people can hire this agent here, and if not, what to change. A
 * builder's agent needs hires from wallets that are not theirs; the people
 * who use it can only hire it where it can be paid, so this says so plainly
 * and hands over the link. It never suggests where the hires should come from.
 */
function HireHere({ id }: { id: string }) {
  const l = listingFor(id);
  const v = l ? hirePath(l) : null;
  const lead = v ? primaryRail(v) : null;
  return (
    <div className="k-panel k-panel--raised bd-hirehere">
      <h2 className="k-h3">Can people hire it here?</h2>
      {!l ? (
        <p className="k-body">
          Not under a job yet. Its card has to say which job it does (yield, grid trading, rebalancing or health factor) in its own description; we file it from those words when we read
          its registration.
        </p>
      ) : v?.ok ? (
        <>
          <p className="bd-hirehere__yes">
            <span className="k-dot k-dot--live" aria-hidden="true" />
            <span>
              <strong>Yes{lead && "price" in lead ? `, for ${lead.price}` : ""}.</strong> Anyone can hire it here,{" "}
              {lead?.kind === "escrow" ? "paying into BNB Chain's escrow until it delivers" : lead?.kind === "x402" ? "paying per call with one signature" : "through BNB Chain's escrow"}, and every hire is read
              from the chain.
            </span>
          </p>
          <p className="k-small">Its page, to share with the people who use it:</p>
          <ShareLink url={`${SITE}/agents/${id}`} />
          <p className="k-small">For Set and Earn, only hires from wallets that are not yours and not funded by yours count, and BNB Chain excludes wash activity.</p>
        </>
      ) : (
        <>
          <p className="bd-hirehere__no">
            <strong>Not yet.</strong> {v?.reason}
          </p>
          {v?.short && FIX[v.short] ? <p className="k-note k-note--warn">{FIX[v.short]}</p> : null}
        </>
      )}
    </div>
  );
}
