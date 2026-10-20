import "@/styles/builders.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ExternalLink } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import CopyLine from "@/components/builders/CopyLine";
import { CATEGORIES, CATEGORY_LABEL, IDENTITY_REGISTRY } from "@/lib/config";
import { judgePicks } from "@/lib/market/judge";
import { hireCounts } from "@/lib/market/hires";
import { censusAge, listingFor } from "@/lib/market/listing";
import { referenceAgents } from "@/lib/market/reference";
import { diagnose } from "@/lib/diagnose";
import { readLadder } from "@/lib/ladder";
import { snapshot } from "@/lib/data/snapshots";
import { readGridWindow, type GridWindow } from "@/lib/grid/window";
import { listSessions } from "@/lib/chain/session-store";
import { COUNTER_SLOT, registeredCount } from "@/lib/registry/count";
import { withTimeout } from "@/lib/cache";
import { live } from "@/lib/data/live";
import { DEMO_ADDRESS, bscscanTx, passkeyRecord, short } from "@/lib/demo";
import { describeStatus, strangerHiresLive } from "@/lib/market/stranger-hires";
import { listPaidCalls } from "@/lib/market/paid-calls";
import { sponsorAddress } from "@/lib/market/judge-mode";
import { card } from "@/lib/market/market-api";
import { viewAgent } from "@/lib/view/market";
import { poseOf } from "@/lib/view/state";

export const metadata: Metadata = {
  title: "Judge walk | Mandate",
  description: "Six beats, each a live control on BNB Smart Chain mainnet. Paste one address and follow it.",
};

export const revalidate = 120;
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

const SPONSOR = (sponsorAddress() ?? "our keeper wallet").toString().slice(0, 10) + "…";

/** An agent's pose as the marketplace last read it: its card where the view has one, else the hire law on its listing. */
async function poseFor(tokenId: string | undefined): Promise<CharacterState> {
  if (!tokenId) return "dozing";
  const a = await withTimeout(viewAgent(tokenId).catch(() => null), 4_000);
  if (a) return poseOf(a);
  const l = listingFor(tokenId);
  return l ? poseOf(card(l)) : "dozing";
}

/**
 * The judge walk: six beats, every one a link to a live page and every claim
 * beside it read from the chain at render time. Where a beat is not fully
 * true yet, the page says what is and is not, rather than implying more.
 */
export default async function JudgesPage() {
  await live(["grid-window"]);
  const hires = (await hireCounts().catch(() => null))?.byTokenId;
  const picks = judgePicks(hires);
  const census = censusAge();
  const [diag, ladder, grid, refs, sessions, registry] = await Promise.all([
    withTimeout(diagnose(DEMO_ADDRESS).catch(() => null), 10_000),
    withTimeout(readLadder().catch(() => null), 20_000),
    snapshot<GridWindow>("grid-window")?.payload ?? withTimeout(readGridWindow().catch(() => null), 8_000),
    referenceAgents(),
    listSessions().catch(() => []),
    withTimeout(registeredCount().catch(() => null), 6_000),
  ]);
  const rangerJob = (await strangerHiresLive().catch(() => [])).find((h) => h.tokenId === "269706") ?? null;
  const paidMuster = ((await withTimeout(listPaidCalls().catch(() => []), 6_000)) ?? []).find((c) => c.tokenId === "342377" && c.delivered && c.tx) ?? null;
  const ranger = listingFor("269706");
  const passkey = passkeyRecord();
  const out = diag?.findings.filter((f) => f.kind === "out-of-range").length ?? null;
  const venus = diag?.findings.find((f) => f.pair === "Venus");
  const idle = diag?.findings.find((f) => f.kind === "idle-cash");
  const liveKeys = sessions.filter((s) => !s.revokedAt && s.expiry * 1000 > Date.now());
  const pickByCat = new Map(picks.map((p) => [p.category, p]));
  const rungs = ladder?.rungs ?? [];
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local build";
  const poses = new Map<string, CharacterState>();
  await Promise.all(
    CATEGORIES.flatMap((c) => [refs[c].tokenId, pickByCat.get(c)?.listing.tokenId]).map(async (id) => {
      if (id) poses.set(id, await poseFor(id));
    }),
  );
  void ranger;

  return (
    <AppShell>
      <div className="bd-page bd-judges">
        <BuildersNav current={null} />

        <header className="bd-hero bd-jhero">
          <div className="bd-look__pool" aria-hidden="true" />
          <div className="k-wrap bd-hero__in">
            <div className="bd-hero__copy">
              <h1 className="k-display k-rise" style={{ ["--i" as string]: 0 }}>
                Six beats, mainnet
              </h1>
              <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
                One page. Every beat is a live control, and every receipt is a BscScan or KeyStore link. You need no account and no Agent Studio.
              </p>
              <div className="k-row k-rise" style={{ ["--i" as string]: 2 }}>
                <Link className="k-btn k-btn--primary k-btn--lg" href={`/diagnose?q=${DEMO_ADDRESS}`}>
                  Start with the demo address <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                </Link>
                <Link className="k-btn k-btn--lg k-btn--ghost" href="/status">
                  Is every beat working now?
                </Link>
              </div>
            </div>
            <aside className="k-panel k-panel--raised bd-demo" aria-label="The demo address">
              <div className="bd-demo__cast" aria-hidden="true">
                {CATEGORIES.map((c, i) => {
                  const id = refs[c].tokenId;
                  return id ? <Agent key={c} job={c} seed={id} house size={i === 1 ? 96 : 82} state={poses.get(id) ?? "dozing"} slot="demo" /> : null;
                })}
              </div>
              <p className="bd-demo__k">The demo address</p>
              <p className="bd-demo__t">It holds real positions and a real Venus loan, so you do not have to find your own.</p>
              <p className="k-mono bd-demo__addr">{DEMO_ADDRESS}</p>
              <details className="bd-more">
                <summary>
                  <span>Check it yourself</span>
                </summary>
                <CopyLine prompt="" text={`cast call 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364 "balanceOf(address)" ${DEMO_ADDRESS}`} label="Copy the cast call" />
              </details>
            </aside>
          </div>
        </header>

        <section className="k-section k-section--tight bd-walk-wrap" aria-label="The six beats">
          <div className="k-wrap">
            <ol className="bd-steps bd-walk">
              <Beat n={1} title="Paste the demo address" href={`/diagnose?q=${DEMO_ADDRESS}`} go="Open it on Check a wallet">
                <p className="bd-beat__live">
                  {diag
                    ? `${out} position${out === 1 ? "" : "s"} out of range, ${venus ? venus.title.toLowerCase() : "no Venus position read"}${idle ? `, and ${idle.title.split(" is ")[0]} idle` : ""}.`
                    : "The chain did not answer this render, so the page reads it when you open it."}
                </p>
                {diag ? <p className="k-src">Read from BNB Smart Chain at block {Number(diag.blockNumber).toLocaleString("en-GB")}</p> : null}
              </Beat>

              <Beat n={2} title="Four jobs, ours and a stranger in each" href="#categories" go="See the four" alt={{ href: "/agents?live=1", label: "Every agent that answered" }}>
                <p className="bd-beat__live">
                  Our reference agent with its mainnet receipt, beside the third-party agent that answered fastest when we called{census.minutes !== null ? ` ${census.minutes} minutes ago` : ""}. A job
                  with no reference yet says so.
                </p>
              </Beat>

              <Beat n={3} title="Hire a stranger, here, with no wallet" href="/agents/342377#sponsored" go="Open Muster's page">
                <p className="bd-beat__live">
                  Muster&rsquo;s Venus health factor watch. We do not run it, it has never met us, and it has taken our money four times and answered every time. Press <strong>Try free</strong> on that
                  page: Mandate signs a payment from {SPONSOR}, the agent settles it on BNB Smart Chain and returns the health factor, with the transaction, in a few seconds.
                </p>
                {paidMuster ? (
                  <p className="k-src">
                    Last time: {paidMuster.amount ? `${(Number(paidMuster.amount) / 1e18).toFixed(2)} USD1` : ""}{" "}
                    <a className="k-mono" href={bscscanTx(paidMuster.tx!)} target="_blank" rel="noreferrer">
                      {short(paidMuster.tx!)}
                    </a>
                  </p>
                ) : null}
                <details className="bd-more">
                  <summary>
                    <span>The other way round, on the same shelf</span>
                  </summary>
                  <p className="k-small bd-more__p">
                    <Link className="k-link" href="/agents/269706">
                      Agripinaa&rsquo;s Ranger
                    </Link>{" "}
                    quotes a price we can now sign, but it took 0.05 USDT twice and answered with an error both times, so this site refuses to offer it until it delivers again, and prints its
                    server&rsquo;s words as the reason.{" "}
                    {rangerJob ? (
                      <>
                        Its escrowed job {rangerJob.jobId} ({rangerJob.budget} {rangerJob.token}) is {describeStatus(rangerJob)}.{" "}
                      </>
                    ) : null}
                    A grid job we negotiated with ChainHelix on the same rail did deliver, and its deliverable hash matches the chain:{" "}
                    <Link className="k-link" href="/activity#strangers">
                      see the tape
                    </Link>
                    .
                  </p>
                </details>
              </Beat>

              <Beat n={4} title="Open Grid-1, ours, and read its window" href="/desk#grid-1" go="Open Grid-1's window">
                <p className="bd-beat__live">
                  {grid
                    ? grid.fills.length
                      ? `${grid.fills.length} real fills through SwapBound, ${grid.winRate === null ? "no round trip closed yet" : `${Math.round(grid.winRate * 100)}% of ${grid.roundTrips.length} round trips won`}. `
                      : "The window is open and no level has been crossed yet, so there is no fill to show. None is simulated."
                    : "The window could not be read this render."}
                  {grid?.fills.length ? (
                    <span className={grid.pnlUsd >= 0 ? "bd-beat__up" : "bd-beat__down"}>
                      {`${grid.pnlUsd >= 0 ? "+" : "-"}$${Math.abs(grid.pnlUsd).toFixed(4)} against doing nothing`}
                    </span>
                  ) : null}
                  {grid?.fills.length ? `, worst drawdown $${grid.maxDrawdownUsd.toFixed(4)}.` : null}
                </p>
                {grid?.fills.length ? (
                  <p className="k-src">
                    Last fill{" "}
                    <a className="k-mono" href={bscscanTx(grid.fills[grid.fills.length - 1].tx)} target="_blank" rel="noreferrer">
                      {short(grid.fills[grid.fills.length - 1].tx)}
                    </a>
                  </p>
                ) : null}
              </Beat>

              <Beat n={5} title="Open the desk and compare it with the KeyStore" href="/desk" go="Open the desk">
                <p className="bd-beat__live">
                  <strong className="bd-beat__n k-num">{liveKeys.length}</strong> live key{liveKeys.length === 1 ? "" : "s"} on the demo account, what each may call, and the KeyStore&rsquo;s own answer
                  beside it. {passkey ? "A passkey wallet shows the whole lifecycle: grant, act, revoke, with the registry read before and after." : "The passkey lifecycle is not recorded yet."}
                </p>
                <p className="k-small">Revoking a live key takes the operator token, because it spends the account&rsquo;s gas.</p>
              </Beat>

              <Beat n={6} title="The funnel, from the registry itself" href="/verify" go="How each step is checked" alt={{ href: "/api/v1/registry/funnel", label: "The funnel as JSON" }}>
                <p className="bd-beat__live">
                  {registry ? (
                    <>
                      <strong className="bd-beat__n k-num">{registry.count.toLocaleString("en-GB")}</strong> agents registered, read from the registry&rsquo;s own counter, not an indexer&rsquo;s estimate.
                    </>
                  ) : (
                    "The registry counter did not answer this render."
                  )}
                </p>
                {registry ? <p className="k-src">At block {registry.block.toLocaleString("en-GB")}</p> : null}
                {rungs.length > 1 ? (
                  <ol className="bd-beat__rungs" aria-label="Then, rung by rung">
                    {rungs.slice(1).map((r) => (
                      <li key={r.name}>
                        <span className="k-num">{r.population === null ? "unmeasured" : r.population.toLocaleString("en-GB")}</span> {r.name.toLowerCase()}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <details className="bd-more">
                  <summary>
                    <span>Check the first number yourself</span>
                  </summary>
                  <CopyLine prompt="" text={`cast storage ${IDENTITY_REGISTRY} ${COUNTER_SLOT}`} label="Copy the cast storage command" />
                </details>
              </Beat>
            </ol>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band" id="categories" aria-labelledby="h-cats">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-cats" className="k-h2">
                  The four jobs
                </h2>
                <p className="k-body">Same fields in every tile. No tile is ever empty.</p>
              </div>
            </div>
            <ul className="bd-cats">
              {CATEGORIES.map((c, i) => {
                const ref = refs[c];
                const pick = pickByCat.get(c);
                return (
                  <li key={c} className="bd-cat" data-job={c} style={{ ["--i" as string]: i }}>
                    <div className="bd-cat__art" aria-hidden="true">
                      {ref.tokenId ? <Agent job={c} seed={ref.tokenId} house size={104} state={poses.get(ref.tokenId) ?? "dozing"} slot="cat" /> : null}
                      {pick ? <Agent job={c} seed={pick.listing.tokenId} size={88} state={poses.get(pick.listing.tokenId) ?? "dozing"} slot="catp" /> : null}
                    </div>
                    <div className="bd-cat__body">
                      <p className="bd-cat__job">{CATEGORY_LABEL[c]}</p>
                      <p className="bd-cat__state">
                        <span className="k-tag">{ref.status === "live" ? "reference live" : ref.status === "paused" ? "reference paused" : ref.status === "idle" ? "reference idle" : "no reference yet"}</span>
                        <span className="k-tag">{pick ? "third party live" : "no third party answered"}</span>
                      </p>
                      <div className="bd-cat__row">
                        <p className="bd-cat__name">
                          {ref.name} <span className="k-tag k-tag--ours">Ours</span>
                        </p>
                        <p className="bd-cat__d">
                          {ref.evidence}{" "}
                          {ref.tokenId ? (
                            <a className="k-link" href={`https://bscscan.com/token/${IDENTITY_REGISTRY}?a=${ref.tokenId}`} target="_blank" rel="noreferrer">
                              ERC-8004 #{ref.tokenId}
                            </a>
                          ) : null}{" "}
                          {ref.tx ? (
                            <a className="k-mono bd-cat__tx" href={bscscanTx(ref.tx)} target="_blank" rel="noreferrer">
                              {short(ref.tx)}
                            </a>
                          ) : null}
                        </p>
                      </div>
                      <div className="bd-cat__row">
                        {pick ? (
                          <>
                            <p className="bd-cat__name">{pick.listing.name}</p>
                            <p className="bd-cat__d">Not ours: chosen because it is {pick.because}.</p>
                          </>
                        ) : (
                          <p className="bd-cat__d">No third-party agent in this job answered when we last called.</p>
                        )}
                      </div>
                      <div className="bd-cat__foot">
                        <Link className="k-btn k-btn--sm" href={ref.href}>
                          {ref.name}
                        </Link>
                        {pick ? (
                          <Link className="k-btn k-btn--sm k-btn--primary" href={`/agents/${pick.listing.tokenId}`}>
                            {pick.listing.name}
                          </Link>
                        ) : (
                          <Link className="k-btn k-btn--sm k-btn--ghost" href={`/agents?category=${c}`}>
                            All {CATEGORY_LABEL[c].toLowerCase()}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="k-small bd-judges__foot">
              Everything above is read at render time and the page regenerates every two minutes. The{" "}
              <a className="k-link" href="https://youtu.be/7l_Ppu_V44o" target="_blank" rel="noreferrer">
                video <ExternalLink size={12} aria-hidden="true" />
              </a>{" "}
              walks an earlier version of this path; where it and this page disagree, this page is the one that is true. Commit <span className="k-mono">{commit}</span>.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** One beat of the walk: what to do, what is true right now, and the button that does it. */
function Beat({ n, title, href, go, alt, children }: { n: number; title: string; href: string; go: string; alt?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <li className="bd-step bd-beat" style={{ ["--i" as string]: n - 1 }}>
      <span className="bd-step__n k-num" aria-hidden="true">
        {n}
      </span>
      <div className="bd-step__body bd-beat__body">
        <div className="bd-beat__main">
          <h2 className="k-h3">{title}</h2>
          {children}
        </div>
        <div className="bd-beat__acts">
          <Link className="k-btn" href={href}>
            {go} <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
          </Link>
          {alt ? (
            <a className="k-btn k-btn--ghost k-btn--sm" href={alt.href}>
              {alt.label}
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}
