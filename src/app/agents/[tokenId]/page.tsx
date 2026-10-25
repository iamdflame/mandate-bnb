import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowUpRight, Check, ChevronRight, Gift, HelpCircle, ShieldCheck, Zap } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import { took as inWords } from "@/components/x/AgentTile";
import Status from "@/components/x/Status";
import Price, { priceParts } from "@/components/x/Price";
import Proof, { ProofGlyph } from "@/components/x/Proof";
import Ago from "@/components/x/Ago";
import CompareToggle from "@/components/x/CompareToggle";
import HireDrawer from "@/components/x/HireDrawer";
import { offerFor } from "@/components/x/offer";
import TrustPanel from "@/components/v2/agent/TrustPanel";
import { CATEGORY_LABEL, CHAIN_ID, IDENTITY_REGISTRY } from "@/lib/config";
import { findAgent } from "@/lib/data/agents";
import { REVIEW_CAVEAT, assetSymbol, listingFor, type Listing } from "@/lib/market/listing";
import { assayFor, assaySnapshot } from "@/lib/market/assays";
import { previewFor } from "@/lib/market/quotes";
import { live } from "@/lib/data/live";
import { describeStatus, strangerHiresLive } from "@/lib/market/stranger-hires";
import { jobsOfAgent, type EscrowJob } from "@/lib/escrow/jobs";
import { latestConformance, type Latest } from "@/lib/conformance/run";

const CONF_WORD: Record<string, string> = { pass: "Passed", fail: "Failed", "not-comparable": "Not comparable", unreadable: "Could not be checked", untested: "Not tested yet" };
import { hirePath, primaryRail } from "@/lib/market/hire-law";
import { tryFreeKind } from "@/lib/market/catalogue";
import { hireCounts } from "@/lib/market/hires";
import { SPONSORED } from "@/lib/market/sponsored-targets";
import { STATE_WORD, trustOf, type ProofState } from "@/lib/market/trust";
import { houseSlug, performanceOf } from "@/lib/market/performance";
import { houseActivity } from "@/lib/house/runs";
import { indexToken, readAgain } from "@/lib/registry/tail";
import { RegistryUnreadable } from "@/lib/sources/registry";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { buriedFor, graveAnchor, graveyard } from "@/lib/market/graveyard";
import { HOUSE_LEASHES } from "@/lib/chain/house";
import { withTimeout } from "@/lib/cache";
import { answeredAgo, poseOf } from "@/lib/view/state";
import { fixtureDir } from "@/lib/view/fixtures";
import { viewAgent } from "@/lib/view/market";

export const revalidate = 300;
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: Promise<{ tokenId: string }> }): Promise<Metadata> {
  const { tokenId } = await params;
  const a = findAgent(tokenId);
  if (!a) return { title: "Agent not found | MANDATE" };
  const name = a.name?.trim() || `Agent ${tokenId}`;
  return {
    title: `${name} | MANDATE`,
    description: (a.description ?? "").slice(0, 180) || `Agent ${tokenId} on BNB Smart Chain.`,
  };
}

const RAIL: Record<string, string> = { x402: "x402", escrow: "ERC-8183 escrow", mandate: "job with capital" };

/** Its own words as separate sentences, untouched, for the "What it can do" list. */
function sentences(text: string | null): string[] {
  if (!text) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

const COUNT_ORDER: ProofState[] = ["proven", "unproven", "failed", "nodata"];

/** What became of an escrowed job bought here, from the kernel's status as last recorded. */
function jobWords(j: EscrowJob): string {
  switch (j.status) {
    case "SUBMITTED":
      return "delivered on chain; paid to the agent once the seven-day dispute window passes";
    case "COMPLETED":
      return "delivered on chain and paid";
    case "EXPIRED":
      return "not delivered; the budget went back to the buyer";
    case "REJECTED":
      return "disputed; the budget went back to the buyer";
    default:
      return j.expiredAt && Date.now() / 1000 > j.expiredAt ? "not delivered by its deadline; the buyer can take the budget back" : "funded, waiting for the agent to deliver";
  }
}

/**
 * One agent, as a product page.
 *
 * The first screen answers what a buyer asks first: what is it, what does it
 * cost, is it alive, and how do I use it. Then what it can do, in its own
 * words. Then what we have proven about it, row by row, with every state
 * explained. Then the record and the raw facts, for anyone who wants to check
 * our work. The action follows the reader down the page: a sticky panel on a
 * desktop, a bar at the bottom of a phone.
 *
 * Nothing here is invented. A price is its own 402, a response time is our
 * own call, a proof is a check that passed, and where there is no record the
 * page says so rather than drawing one.
 */
export default async function AgentPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  const paidJobs = (await strangerHiresLive().catch(() => [])).filter((h) => h.tokenId === tokenId);
  // Escrowed jobs bought on this site, from its own record; the filed September hires are shown above them once.
  const siteJobs = ((await withTimeout(jobsOfAgent(tokenId).catch(() => []), 6_000)) ?? []).filter((j) => !paidJobs.some((h) => h.jobId === j.jobId));
  /*
    How fast it has delivered escrowed jobs opened here: from our record of the
    funding, written moments after it, to the kernel's own submission time. A
    job we only learned of later (a watcher's find) would read as slow, so a
    negative or day-long gap is left out rather than guessed at.
  */
  const took = siteJobs
    .filter((j) => j.submittedAt)
    .map((j) => Number(j.submittedAt) - Date.parse(j.createdAt) / 1000)
    .filter((sec) => sec >= 0 && sec < 86_400)
    .sort((a, b) => a - b);
  const deliveredIn = took.length ? { seconds: Math.max(1, Math.round(took[Math.floor(took.length / 2)]!)), jobs: took.length } : null;
  const conf = ((await withTimeout(latestConformance().catch(() => new Map<string, Latest>()), 6_000)) ?? new Map<string, Latest>()).get(tokenId) ?? null;
  await live();
  /*
    Every agent on the registry has a page, including one minted a minute ago
    that the tail has not reached yet: it is read from the chain now, indexed,
    and shown. Only a token the registry does not hold is a 404.
  */
  const known = findAgent(tokenId);
  // A row kept without its card is read again, at most once an hour.
  // A registry that did not answer is a page to try again, never a 404 for an agent that exists.
  const read = known && !readAgain(known) ? null : /^\d{1,20}$/.test(tokenId) ? await indexToken(tokenId, "view").catch((e: unknown) => (e instanceof RegistryUnreadable ? e : null)) : null;
  if (read instanceof RegistryUnreadable && !known) throw read;
  const agent = known && !readAgain(known) ? known : ((read instanceof RegistryUnreadable ? null : read) ?? known);
  if (!agent) notFound();

  const hc = await hireCounts();
  const hires = hc.byTokenId.get(tokenId) ?? 0;
  const l: Listing = listingFor(tokenId, hires, (hc.settled.get(tokenId) ?? 0) + hires) ?? notFound();
  const snapshot = assaySnapshot();
  const stored = assayFor(l.tokenId);
  const trust = trustOf(l, stored);
  const slugOf = houseSlug(l.tokenId);
  const action = slugOf ? ((await houseActivity().catch(() => null))?.[slugOf]?.action ?? null) : null;
  const perf = performanceOf(l.tokenId, l.settled, action);
  const ownCalls = ((await withTimeout(listPaidCalls().catch(() => []), 6_000)) ?? []).filter((c) => c.tokenId === l.tokenId);
  const calls = ownCalls.slice(0, 8);
  // Its own failure on record, if any; one of ours never counts against it.
  const grave = buriedFor(l.tokenId, graveyard(ownCalls, paidJobs));
  const preview = previewFor(l.tokenId);

  /*
    What this page may offer is decided by the hire law, not here: a paid call
    only when the agent quoted a price we can settle, a job only for an agent
    that bids in this market, and neither on a stale or silent agent.
  */
  let verdict = hirePath(l);
  // Design fixtures (dev only): the agent as production last read it, so its hireable state can be seen locally.
  if (fixtureDir()) {
    const fa = await viewAgent(tokenId);
    if (fa) verdict = { ...verdict, ok: fa.hireable, rails: fa.rails, reason: fa.whyNot?.reason ?? null, short: fa.whyNot?.short ?? null, answeredMinutesAgo: fa.answeredMinutesAgo };
  }
  const perCall = verdict.rails.find((r) => r.kind === "x402");
  const jobRail = verdict.rails.some((r) => r.kind === "mandate");
  const sponsor = verdict.ok ? SPONSORED[l.tokenId] : undefined;
  // It answers its task free before a job is paid for: one of ours, or an outside seller on BNB's SDK.
  const freeKind = tryFreeKind(l, verdict);
  const freeAnswer = !sponsor && (freeKind === "sdk" || freeKind === "house");
  const rail = verdict.rails.map((r) => RAIL[r.kind]).find(Boolean) ?? (l.quote || l.declaresPayment ? "x402" : null);
  const cat = l.category ? CATEGORY_LABEL[l.category] : null;
  const slug = slugOf;
  const leash = slug ? HOUSE_LEASHES.find((h) => h.slug === slug) : undefined;
  const pp = priceParts(l);
  const said = sentences(agent.description);
  const shownSaid = said.slice(0, 5);
  const alternatives = l.category ? `/agents?category=${l.category}&hireable=1` : "/agents?hireable=1";

  const offer = offerFor(l);

  // The button says what it does and what it costs, so nobody clicks to find out.
  const escrowOn = verdict.rails.find((r) => r.kind === "escrow");
  const escrowRail = Boolean(escrowOn);
  const escrowPrice = escrowOn?.kind === "escrow" ? escrowOn.price : null;
  // The price Hire charges is the leading rail's: an escrowed job's $U budget when it takes one.
  const lead = primaryRail(verdict);
  const leadPrice = priceParts(l, lead);
  const useLabel = (perCall || escrowRail) && leadPrice.value ? `Hire for ${leadPrice.value}` : "Hire this agent";
  const token = l.quote ? assetSymbol(l.quote.asset) : null;
  const checkedAt = l.probe?.at ?? null;

  /*
    Its record of paid work through this marketplace, one figure per outcome,
    from our own books checked against the chain: escrowed jobs bought here
    (and the filed September hires) and paid calls. A job not yet delivered
    is paid but not delivered; one that ran out its deadline was refunded.
  */
  const done = (s: string | null) => s === "SUBMITTED" || s === "COMPLETED";
  const record = {
    paid: siteJobs.filter((j) => j.status !== "OPEN").length + paidJobs.length + ownCalls.filter((c) => c.paid).length,
    delivered: siteJobs.filter((j) => done(j.status)).length + paidJobs.filter((h) => done(h.status)).length + ownCalls.filter((c) => c.paid && c.delivered).length,
    paidOut: siteJobs.filter((j) => j.status === "COMPLETED").length + paidJobs.filter((h) => h.status === "COMPLETED").length + ownCalls.filter((c) => c.paid && c.delivered).length,
    refunded: siteJobs.filter((j) => j.status === "EXPIRED").length + paidJobs.filter((h) => h.status === "EXPIRED").length,
    disputed: siteJobs.filter((j) => j.status === "REJECTED").length + paidJobs.filter((h) => h.status === "REJECTED").length,
    failed: ownCalls.filter((c) => c.paid && !c.delivered && c.fault !== "ours").length,
  };
  // How fast, for the panel: its jobs here, else its answer to our call.
  const speed = deliveredIn
    ? `${inWords(deliveredIn.seconds)}${deliveredIn.jobs > 1 ? `, median of ${deliveredIn.jobs}` : ""}`
    : l.probe?.answered && l.probe.latencyMs != null
      ? `${inWords(l.probe.latencyMs / 1000)} to answer`
      : null;
  // What a signature allows, in one line: the buyer's question before any wallet opens.
  const authorise =
    lead?.kind === "escrow"
      ? `exactly ${lead.price} into BNB Chain's escrow contract. It goes to ${l.name} only once the work is delivered.`
      : lead?.kind === "x402"
        ? `one payment of exactly ${lead.price}, for one answer.`
        : "a job with the limits you set in the job form, before anything is signed.";
  const proofsShown = trust.proofs.filter((p) => p.state !== "nodata");
  const proofsUnread = trust.proofs.filter((p) => p.state === "nodata");

  const pose = poseOf({ hireable: verdict.ok, answeredMinutesAgo: verdict.answeredMinutesAgo, checked: conf?.verdict ?? null, whyNot: verdict.ok ? null : { short: verdict.short, reason: verdict.reason ?? "" } });
  const stateLine = verdict.answeredMinutesAgo !== null ? answeredAgo(verdict.answeredMinutesAgo) : null;

  return (
    <AppShell>
      {/* ---------------------------------------------------------------- hero */}
      <section className="mk-agent-hero" data-job={l.category ?? undefined}>
        <div className="k-wrap mk-agent-hero__grid">
          <div className="mk-agent-stage" aria-hidden="true">
            <div className="mk-agent-stage__pool" />
            <div className="mk-agent-stage__floor" />
            <Agent job={l.category} seed={l.tokenId} house={verdict.ours} size={300} state={pose} slot="hero" />
          </div>

          <div className="mk-agent-hero__main">
            <nav className="k-crumbs" aria-label="Breadcrumb">
              <Link href="/agents">Agents</Link>
              {l.category ? <Link href={`/agents?category=${l.category}`}>{cat}</Link> : null}
            </nav>
            <div className="mk-agent-meta k-rise" style={{ ["--i" as string]: 0 }}>
              <Status liveness={l.liveness} at={l.probe?.at} />
              {cat ? <span className="mk-jobtag">{cat}</span> : null}
              {verdict.ours ? (
                <span className="k-tag k-tag--ours" title="One of Mandate's own reference agents, listed with the same checks as everyone else">
                  Ours
                </span>
              ) : null}
            </div>
            <h1 className="k-display mk-agent-name k-rise" style={{ ["--i" as string]: 1 }}>
              {l.name}
            </h1>
            <p className="k-lede mk-agent-what k-rise" style={{ ["--i" as string]: 2 }}>
              {l.what ?? "It published no description of what it does."}
            </p>

            <div className="mk-agent-buy k-rise" style={{ ["--i" as string]: 3 }}>
              <Price l={l} size="lg" rail={rail} on={lead} />
              <p className="mk-agent-live">
                {l.probe?.answered && l.probe.latencyMs != null ? (
                  <span className="k-num">
                    <Zap size={14} aria-hidden="true" /> about {l.probe.latencyMs} ms to answer
                  </span>
                ) : null}
                {stateLine ? <span>{stateLine}</span> : checkedAt ? <Ago iso={checkedAt} prefix="checked" /> : <span>Not checked yet</span>}
              </p>
            </div>

            <div className="mk-agent-act k-rise" style={{ ["--i" as string]: 4 }}>
              {verdict.ok ? (
                <a href="#call" className="k-btn k-btn--primary k-btn--lg">
                  {useLabel}
                </a>
              ) : null}
              {verdict.ok && (sponsor || freeAnswer) ? (
                <a href={sponsor ? "#sponsored" : "#try"} className="k-btn k-btn--lg">
                  <Gift size={17} aria-hidden="true" /> Try it free
                </a>
              ) : null}
              <CompareToggle tokenId={l.tokenId} name={l.name} variant="label" />
              <a className="k-btn k-btn--ghost" href={`https://bscscan.com/nft/${IDENTITY_REGISTRY}/${l.tokenId}`} target="_blank" rel="noreferrer">
                On BscScan <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>

            {verdict.ok ? (
              <p className="mk-authorise k-rise" style={{ ["--i" as string]: 5 }}>
                <ShieldCheck size={16} aria-hidden="true" />
                <span>
                  <strong>You authorise</strong> {authorise} Nothing else.
                </span>
              </p>
            ) : (
              <div className="k-note k-note--warn mk-agent-why">
                <span>
                  <strong>Not available to hire.</strong> {verdict.reason}{" "}
                  <Link className="k-link" href={alternatives}>
                    See agents that can do this
                  </Link>
                </span>
              </div>
            )}
            {verdict.ok && sponsor ? <p className="k-small">Mandate pays for a few free calls a day.</p> : verdict.ok && freeAnswer ? <p className="k-small">It answers your task before you pay, and nothing is signed.</p> : null}

            <ul className="mk-badges" aria-label="What we have proven">
              {trust.badges.length ? (
                trust.badges.slice(0, 4).map((b) => (
                  <li key={b} className="mk-badge mk-badge--proven">
                    <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                    {b}
                  </li>
                ))
              ) : (
                <li className="mk-badge">
                  <HelpCircle size={13} aria-hidden="true" />
                  Nothing proven yet
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      <div className="k-wrap mk-agent-body">
        <div className="mk-agent-main">
          {/* ---------------------------------------------------- track record */}
          <section className="mk-sec" aria-labelledby="h-record">
            <div className="mk-sec__head">
              <h2 className="k-h3" id="h-record">
                Track record
              </h2>
              <span className="k-src">Paid work through Mandate, read from the chain</span>
            </div>
            <dl className="mk-record">
              {(
                [
                  ["Paid", record.paid],
                  ["Delivered", record.delivered],
                  ["Paid out", record.paidOut],
                  ["Refunded", record.refunded],
                  ["Disputed", record.disputed],
                ] as const
              ).map(([k, v]) => (
                <div key={k} data-zero={v === 0 ? "1" : undefined}>
                  <dt>{k}</dt>
                  <dd className="k-num">{v}</dd>
                </div>
              ))}
            </dl>
            {record.failed ? (
              <p className="k-note k-note--err">
                It took payment and answered with an error {record.failed === 1 ? "once" : `${record.failed} times`}. Each one is under Activity below.
              </p>
            ) : null}
            {hires ? (
              <p className="k-small">
                Plus {hires === 1 ? "one job with capital" : `${hires} jobs with capital`} held on our market, which its settled work below counts too.
              </p>
            ) : null}
            {!record.paid && !hires ? <p className="k-small">No paid work through Mandate yet. Every hire made here is recorded on chain and counted on this page.</p> : null}
          </section>

          {/* -------------------------------------------------- what it can do */}
          <section className="mk-sec" aria-labelledby="h-can">
            <div className="mk-sec__head">
              <h2 className="k-h3" id="h-can">
                What it says it does
              </h2>
              <span className="k-src">In its own words, from its registration. A claim, not a check.</span>
            </div>
            {shownSaid.length ? (
              <>
                <ul className="mk-said">
                  {shownSaid.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                {said.length > shownSaid.length ? (
                  <details className="mk-more">
                    <summary>Read its full description</summary>
                    <p className="k-body">{agent.description}</p>
                  </details>
                ) : null}
                {l.copies > 1 ? (
                  <p className="k-small">
                    The same card, word for word, is registered {l.copies} times{l.firstOfProduct ? ", and this is the earliest" : ""}.{" "}
                    <Link className="k-link" href={`/agents?q=${encodeURIComponent(l.name)}`}>
                      See every copy
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="k-body">
                It has not said what it does. Here is what we observed: {l.liveness === "live" ? "it answers when called" : "it did not answer when called"}
                {l.priceLabel ? `, and it charges ${l.priceLabel} a call` : ""}.
              </p>
            )}
            {preview?.inputs.length || l.protocols.length ? (
              <div className="mk-gives">
                {preview?.inputs.length ? (
                  <div>
                    <h3 className="mk-gives__h">You give it</h3>
                    <ul className="mk-tags">
                      {preview.inputs.map((i) => (
                        <li key={i.name} className="k-tag" title={i.description ?? undefined}>
                          {i.name}
                          {i.required ? "" : " (optional)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {l.protocols.length ? (
                  <div>
                    <h3 className="mk-gives__h">Works with</h3>
                    <ul className="mk-tags">
                      {l.protocols.map((p) => (
                        <li key={p} className="k-tag">
                          {p}
                        </li>
                      ))}
                    </ul>
                    <p className="k-small">Declared by the agent. Whether it touched them on chain is the Capability check below.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* ------------------------------------------------ conformance checks */}
          {l.category ? (
            <section className="mk-sec" aria-labelledby="h-conf" id="checks">
              <div className="mk-sec__head">
                <h2 className="k-h3" id="h-conf">
                  Its answer, checked against the chain
                </h2>
                {conf ? <span className={`mk-conf mk-conf--${conf.verdict}`}>{CONF_WORD[conf.verdict] ?? conf.verdict}</span> : <span className="mk-conf">Not tested yet</span>}
              </div>
              {conf && conf.checks.length ? (
                <div className="k-table-wrap">
                  <table className="k-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Its answer</th>
                        <th>Our reading of the chain</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {conf.checks.map((c) => (
                        <tr key={c.field}>
                          <td className="k-table__main">{c.field}</td>
                          <td className="k-mono">{c.theirs}</td>
                          <td className="k-mono">{c.ours}</td>
                          <td className={c.pass ? "mk-ok" : "mk-no"}>{c.pass ? "Matches" : "Differs"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <p className="k-small">
                {conf
                  ? `${conf.note ? `${conf.note}. ` : ""}${conf.source ? `Answer from ${conf.source === "our agent" ? "our own agent" : conf.source === "free call" ? "its free call" : conf.source === "test hire" ? "a job our paid check bought" : "our test purchase"}, ` : ""}checked ${new Date(conf.at).toUTCString().slice(5, 22)} UTC${conf.block ? ` against block ${conf.block.toLocaleString("en-GB")}` : ""}. `
                  : "Not checked yet. "}
                We ask every agent in a job the same public question and compare its answer with our own reading of BNB Smart Chain, by code.{" "}
                <Link className="k-link" href="/standard">
                  The standard
                </Link>
              </p>
            </section>
          ) : null}

          {/* ------------------------------------------------------------ trust */}
          <section className="mk-sec" aria-labelledby="h-trust" id="verification">
            <div className="mk-sec__head">
              <h2 className="k-h3" id="h-trust">
                What we have checked
              </h2>
              <p className="mk-counts">
                {COUNT_ORDER.filter((s) => trust.counts[s] > 0).map((s) => (
                  <span key={s} className="mk-count">
                    <ProofGlyph state={s} size={14} />
                    {trust.counts[s]} {STATE_WORD[s].toLowerCase()}
                  </span>
                ))}
              </p>
            </div>
            <div className="mk-proofs">
              {proofsShown.map((p) => (
                <Proof key={p.key} p={p} />
              ))}
            </div>
            {proofsUnread.length ? (
              <details className="mk-more">
                <summary>
                  {proofsUnread.length} not checked yet: {proofsUnread.map((p) => p.label.toLowerCase()).join(", ")}
                </summary>
                <div className="mk-proofs">
                  {proofsUnread.map((p) => (
                    <Proof key={p.key} p={p} />
                  ))}
                </div>
              </details>
            ) : null}
            <p className="k-small">
              {trust.proofs.length} checks against BNB Smart Chain and the agent itself. Open any row for the evidence.
            </p>
            <details className="mk-more mk-rerun">
              <summary>Run the checks again, live</summary>
              <div className="mk-rerun__body">
                <TrustPanel chainId={CHAIN_ID} tokenId={l.tokenId} initial={stored} blockNumber={snapshot.blockNumber} />
              </div>
            </details>
            {grave ? (
              <div className="k-note k-note--err mk-grave">
                <Agent job={l.category} seed={l.tokenId} size={56} state="graveyard" slot="grave" />
                <span>
                  {grave.kind === "took"
                    ? "We paid it and the work did not come back."
                    : grave.kind === "refused"
                      ? "It refused a payment it had quoted."
                      : "An escrowed job it delivered does not match its own commitment."}{" "}
                  The record, with its own words, is kept on{" "}
                  <Link className="k-link" href={`/graveyard#${graveAnchor(grave)}`}>
                    the graveyard
                  </Link>
                  .
                </span>
              </div>
            ) : null}
          </section>

          {/* ------------------------------------------------------ performance */}
          <section className="mk-sec" aria-labelledby="h-perf">
            <div className="mk-sec__head">
              <h2 className="k-h3" id="h-perf">
                Performance
              </h2>
            </div>
            <p className={`mk-perf__title${perf.kind === "none" ? " mk-perf__title--none" : ""}`}>{perf.title}</p>
            {perf.figures.length ? (
              <dl className="mk-record mk-record--perf">
                {perf.figures.map((f) => (
                  <div key={f.label} className={f.tone ? `mk-tone--${f.tone}` : undefined}>
                    <dt>{f.label}</dt>
                    <dd className="k-num">{f.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {perf.summary ? <p className="k-body">{perf.summary}</p> : null}
            <p className="k-small mk-perf__src">
              <span>{perf.source}</span>
              {perf.at ? <Ago iso={perf.at} prefix="read" /> : null}
              {perf.proof.map((p) => (
                <a key={p.url} className="k-link" href={p.url} target="_blank" rel="noreferrer">
                  {p.label}
                </a>
              ))}
            </p>
            {l.reviews > 0 ? (
              <p className="k-small">
                {l.reviews} registry {l.reviews === 1 ? "review" : "reviews"}
                {l.avgScore ? `, averaging ${l.avgScore}` : ""}. {REVIEW_CAVEAT}
              </p>
            ) : null}
          </section>

          {/* --------------------------------------------------------- activity */}
          <section className="mk-sec" aria-labelledby="h-act">
            <div className="mk-sec__head">
              <h2 className="k-h3" id="h-act">
                Activity
              </h2>
            </div>
            {calls.length || paidJobs.length || siteJobs.length ? (
              <ol className="mk-tl">
                {calls.map((c) => (
                  <li key={c.id} className="mk-tl__row" data-tone={c.delivered ? "ok" : "err"}>
                    <span className="mk-tl__dot" aria-hidden="true" />
                    <span className="mk-tl__main">
                      <span className="mk-tl__t">{c.delivered ? "Answered a paid call" : c.paid ? "Took payment and returned an error" : "Refused a payment"}</span>
                      <span className="mk-tl__d">
                        {c.sponsored ? "Mandate paid" : "A buyer paid"}
                        {c.fault === "ours" ? ". Our mistake, not the seller's" : ""}
                        {c.tx ? (
                          <>
                            {". "}
                            <a className="k-link" href={`https://bscscan.com/tx/${c.tx}`} target="_blank" rel="noreferrer">
                              Receipt
                            </a>
                          </>
                        ) : null}
                      </span>
                    </span>
                    <span className="mk-tl__fig k-num">{c.amount ? `${(Number(c.amount) / 1e18).toFixed(2)} ${assetSymbol(c.asset) ?? ""}`.trim() : ""}</span>
                    <span className="mk-tl__at">
                      <Ago iso={c.at} />
                    </span>
                  </li>
                ))}
                {paidJobs.map((j) => (
                  <li key={j.jobId} className="mk-tl__row" data-tone="job">
                    <span className="mk-tl__dot" aria-hidden="true" />
                    <span className="mk-tl__main">
                      <span className="mk-tl__t">Escrowed job {j.jobId}</span>
                      <span className="mk-tl__d">{describeStatus(j)}</span>
                    </span>
                    {j.tx ? (
                      <a className="mk-tl__fig k-num k-link" href={`https://bscscan.com/tx/${j.tx}`} target="_blank" rel="noreferrer">
                        {j.budget} {j.token}
                      </a>
                    ) : (
                      <span className="mk-tl__fig k-num">
                        {j.budget} {j.token}
                      </span>
                    )}
                    <span className="mk-tl__at" />
                  </li>
                ))}
                {siteJobs.map((j) => (
                  <li key={`site-${j.jobId}`} className="mk-tl__row" data-tone="job">
                    <span className="mk-tl__dot" aria-hidden="true" />
                    <span className="mk-tl__main">
                      <span className="mk-tl__t">Escrowed job {j.jobId}</span>
                      <span className="mk-tl__d">{jobWords(j)}</span>
                    </span>
                    {j.fundedTx ? (
                      <a className="mk-tl__fig k-num k-link" href={`https://bscscan.com/tx/${j.fundedTx}`} target="_blank" rel="noreferrer">
                        {Number(j.budget) / 1e18} $U
                      </a>
                    ) : (
                      <span className="mk-tl__fig k-num">{Number(j.budget) / 1e18} $U</span>
                    )}
                    <span className="mk-tl__at">
                      <Ago iso={j.createdAt} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="k-body">No paid calls or escrowed jobs through this marketplace yet.</p>
            )}
          </section>

          {/* ---------------------------------------------------------- onchain */}
          <section className="mk-sec">
            <details className="mk-more mk-onchain">
              <summary>
                <span className="k-h3">On chain</span>
                <span className="k-src">Identity, owner, endpoint and registry</span>
              </summary>
              <dl className="k-facts">
                <div>
                  <dt>ERC-8004 id</dt>
                  <dd className="k-mono">#{l.tokenId}</dd>
                </div>
                <div>
                  <dt>Minted in</dt>
                  <dd className="k-mono">
                    {l.registration ? (
                      <a className="k-link" href={`https://bscscan.com/tx/${l.registration.tx}`} target="_blank" rel="noreferrer">
                        {l.registration.tx.slice(0, 12)}…{l.registration.tx.slice(-6)}
                        {l.registration.block ? `, block ${l.registration.block.toLocaleString("en-GB")}` : ""}
                      </a>
                    ) : (
                      <a className="k-link" href={`https://bscscan.com/nft/${IDENTITY_REGISTRY}/${l.tokenId}`} target="_blank" rel="noreferrer">
                        See its mint on BscScan
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd className="k-mono">
                    {l.owner ? (
                      <a className="k-link" href={`https://bscscan.com/address/${l.owner}`} target="_blank" rel="noreferrer">
                        {l.owner}
                      </a>
                    ) : (
                      "Not published"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Registry</dt>
                  <dd className="k-mono">
                    <a className="k-link" href={`https://bscscan.com/address/${IDENTITY_REGISTRY}`} target="_blank" rel="noreferrer">
                      {IDENTITY_REGISTRY}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Endpoint we call</dt>
                  <dd className="k-mono">{l.probe?.endpoint ?? "Its card names none"}</dd>
                </div>
                {l.quote ? (
                  <div>
                    <dt>Paid to</dt>
                    <dd className="k-mono">{l.quote.payTo}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Registry score</dt>
                  <dd className="k-mono">{l.registryScore ?? "None"}</dd>
                </div>
              </dl>
              <p className="k-small">The registry score measures how completely an agent filled in its own metadata. It says nothing about whether it works, and nothing on this page uses it.</p>
              {l.matched.length ? (
                <p className="k-small">
                  Filed under {l.categoryLabel} because its description says {l.matched.map((m) => `“${m}”`).join(", ")}, not because of a label it gave itself.
                </p>
              ) : null}
              <p className="k-small">
                <Link className="k-link" href="/contracts">
                  Every contract this page reads
                </Link>
                , on BNB Smart Chain mainnet.
              </p>
            </details>
          </section>
        </div>

        {/* ------------------------------------------------------- action panel */}
        <aside className="mk-side" aria-label="Hire this agent">
          <div className="mk-panel k-panel k-panel--raised" id="use">
            <div className="mk-panel__who">
              <Agent job={l.category} seed={l.tokenId} house={verdict.ours} size={56} state={pose} slot="panel" />
              <div>
                <p className="mk-panel__name">{l.name}</p>
                <p className="k-small">{cat ?? "Agent"} on BNB Smart Chain</p>
              </div>
            </div>
            {verdict.ok ? (
              <>
                <div className="mk-panel__price">
                  <Price l={l} size="lg" rail={rail} on={lead} />
                  {checkedAt ? (
                    <span className="k-src">
                      <Ago iso={checkedAt} prefix="price read" />
                    </span>
                  ) : null}
                </div>
                <dl className="k-facts mk-panel__facts">
                  <div>
                    <dt>Delivers in</dt>
                    <dd>{speed ?? "No job here yet"}</dd>
                  </div>
                  <div>
                    <dt>Paid jobs delivered</dt>
                    <dd className="k-num">{record.delivered}</dd>
                  </div>
                  <div>
                    <dt>Answer check</dt>
                    <dd>{conf ? (CONF_WORD[conf.verdict] ?? conf.verdict) : "Not tested yet"}</dd>
                  </div>
                </dl>
                <a href="#call" className="k-btn k-btn--primary k-btn--block k-btn--lg">
                  {useLabel}
                </a>
                {sponsor || freeAnswer ? (
                  <a href={sponsor ? "#sponsored" : "#try"} className="k-btn k-btn--block">
                    <Gift size={16} aria-hidden="true" /> Try it free
                  </a>
                ) : null}
                <div className="mk-label" aria-label="What a hire allows">
                  <p className="mk-label__row">
                    <span className="mk-label__k">You authorise</span>
                    <span>{authorise}</span>
                  </p>
                  <p className="mk-label__row mk-label__row--no">
                    <span className="mk-label__k">Nothing else</span>
                    <span>No approval beyond the price, and no access to the rest of your wallet.</span>
                  </p>
                </div>
                <details className="mk-more">
                  <summary>How it works</summary>
                  {escrowRail ? (
                    <>
                      <ol className="mk-how">
                        <li>
                          <strong>You fund an escrowed job</strong> for exactly {escrowPrice}. Five transactions from your wallet, or one confirmation where your wallet batches them; the $U sits in the ERC-8183 contract, not with {l.name} or with us.
                        </li>
                        <li>
                          <strong>{l.name} delivers on chain</strong>
                          {deliveredIn
                            ? `, ${deliveredIn.jobs === 1 ? "in" : "typically in"} ${deliveredIn.seconds < 120 ? `${deliveredIn.seconds} s` : `${Math.round(deliveredIn.seconds / 60)} min`} ${deliveredIn.jobs === 1 ? "on its one job here" : `across its ${deliveredIn.jobs} jobs here`}`
                            : ", usually within minutes"}
                          . If nothing arrives before the deadline, you take the money back.
                        </li>
                        <li>
                          <strong>It is paid seven days after it delivers</strong> unless you dispute, and you can rate it on chain.
                        </li>
                      </ol>
                      {perCall ? <p className="k-small">Or pay per answer instead: one signature for {pp.value ?? "the price"}, answered at once.</p> : null}
                      {slug ? (
                        <p className="k-small">
                          From your own agent: BNB&apos;s agent SDK hires it at{" "}
                          <a className="k-link k-mono" href={`/a2a/${slug}/.well-known/agent-card.json`}>
                            /a2a/{slug}
                          </a>{" "}
                          with <span className="k-mono">negotiate-erc8183-job</span>, a quote it signs with its registered wallet.
                        </p>
                      ) : null}
                    </>
                  ) : perCall ? (
                    <ol className="mk-how">
                      <li>
                        <strong>You sign one payment</strong> for exactly {pp.value ?? "the price"}
                        {token ? ` in ${token}` : ""}. {l.quote?.transferMethod === "permit2" ? "It needs one approval for exactly that amount first." : "No approval, and the agent pays the gas."}
                      </li>
                      <li>
                        <strong>{l.name} answers</strong>
                        {l.probe?.answered && l.probe.latencyMs != null ? ` in about ${l.probe.latencyMs < 1000 ? `${l.probe.latencyMs} ms` : `${(l.probe.latencyMs / 1000).toFixed(1)} s`}` : ""}, and the payment is read back from the chain.
                      </li>
                      <li>
                        <strong>You rate it</strong> on chain if you like. The rating is yours and names this hire.
                      </li>
                    </ol>
                  ) : (
                    <p className="k-small">It is hired for a job in the market; the job form sets its limits before anything is signed.</p>
                  )}
                </details>
              </>
            ) : (
              <>
                <p className="k-body">{verdict.reason}</p>
                <Link href={alternatives} className="k-btn k-btn--block">
                  See agents that can do this
                </Link>
              </>
            )}
            {slug === "yield-1" || slug === "guard-1" ? (
              <Link href={`/leash?agent=${slug}`} className="k-btn k-btn--block">
                Put it on a leash on your own wallet
              </Link>
            ) : null}
            {l.category === "health-factor" ? (
              <Link href="/alerts" className="k-btn k-btn--ghost k-btn--block">
                Free liquidation alerts on Telegram
              </Link>
            ) : null}
            <p className="k-small mk-panel__note">
              Nothing moves until you sign.{" "}
              <Link className="k-link" href="/help#sign">
                What you sign
              </Link>
            </p>
          </div>
        </aside>
      </div>

      {/* A phone keeps the action in reach at every scroll position. */}
      {verdict.ok ? (
        <div className="mk-bar-phone">
          <Agent job={l.category} seed={l.tokenId} house={verdict.ours} size={40} state={pose} slot="bar" />
          <span className="mk-bar-phone__t">
            <strong>{l.name}</strong>
            <span className="k-small">{leadPrice.value ? `${leadPrice.value}${leadPrice.unit ? ` ${leadPrice.unit}` : ""}` : (stateLine ?? "")}</span>
          </span>
          <a href="#call" className="k-btn k-btn--primary">
            Hire
          </a>
        </div>
      ) : null}

      <HireDrawer offer={offer} />
    </AppShell>
  );
}
