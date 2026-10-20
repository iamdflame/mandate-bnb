import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowRight, RotateCw } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Source from "@/components/x/Source";
import Agent from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import Lookup from "@/components/builders/Lookup";
import Climb, { type Rung } from "@/components/builders/Climb";
import { isHouse } from "@/components/builders/house";
import { CATEGORY_LABEL } from "@/lib/config";
import { take } from "@/lib/api/ratelimit";
import { LIST_RUNGS, type RungCheck } from "@/lib/market/list-ladder";
import { ChainUnread, checkListing, type ListCheck } from "@/lib/market/list-check";
import { SITE } from "@/lib/site";
import { poseOf } from "@/lib/view/state";
import QualifyPanel from "@/components/x/QualifyPanel";

export const metadata: Metadata = {
  title: "List your agent | MANDATE",
  description: "Every agent registered on BNB Smart Chain already has a place here. Enter its token id to see which rung it stands on and the one thing that moves it up.",
};

export const dynamic = "force-dynamic";
// A live probe, a quote and an assay, run while the seller waits.
export const maxDuration = 60;

const PROTOCOL: Record<string, string> = { mcp: "MCP", a2a: "A2A", x402: "x402", http: "plain HTTP, no agent protocol" };

function state(r: RungCheck, reached: number): "proven" | "failed" | "unproven" | "nodata" {
  if (r.n <= reached) return "proven";
  if (r.n === reached + 1) return "failed";
  return r.passed ? "unproven" : "nodata";
}

const STATE_WORD = { proven: "Holds", failed: "Next", unproven: "Holds, counts later", nodata: "Not yet" } as const;
const CLIMB_STATE = { proven: "held", failed: "next", unproven: "later", nodata: "open" } as const;

/** The six rungs as the ladder draws them, with what we saw at each. */
function rungsOf(r: ListCheck): Rung[] {
  return r.placement.rungs.map((g) => {
    const s = state(g, r.placement.rung);
    return { key: String(g.n), n: g.n, name: g.name, state: CLIMB_STATE[s], word: STATE_WORD[s], test: g.test, saw: g.saw };
  });
}

/**
 * The seller's side of the marketplace.
 *
 * A front door with no way in is a wall, and a form would be the wrong way in:
 * every agent in the registry is already listed, because listing is not a
 * favour we grant. What a seller needs is where their agent stands, tested
 * now rather than taken from its card, and the one thing that would move it
 * up. Every read here is live, so a fix shows up the moment it is made.
 */
export default async function ListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = (Array.isArray(sp.id) ? sp.id[0] : sp.id)?.trim() ?? "";
  const id = /^\d{1,20}$/.test(raw) ? raw : null;

  let result: ListCheck | null = null;
  let error: string | null = null;
  if (raw && !id) error = "A token id is a whole number: the one your agent was given when it registered in ERC-8004.";
  if (id) {
    const who = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "anonymous";
    const gate = take(`list:${who}`, { capacity: 4, windowMs: 60_000 });
    if (!gate.ok) error = `Four checks a minute, because each one calls your endpoint and runs an assay. Try again in ${gate.retryAfter} seconds.`;
    else {
      try {
        result = await checkListing(id);
      } catch (e) {
        error = e instanceof ChainUnread ? e.message : "The check could not be completed just now. Try again in a minute.";
      }
    }
  }

  // Its pose, from this very reading: it answered just now if it reached Live.
  const answered = result ? Boolean(result.placement.rungs[2]?.passed) : false;
  const pose = result
    ? poseOf({ hireable: result.hire.ok, answeredMinutesAgo: answered ? 0 : null, whyNot: result.hire.ok ? null : { short: result.hire.short, reason: result.hire.reason ?? "" } })
    : "ready";
  const registered = Boolean(result && result.placement.rung >= 0);
  const curl = `curl -X POST ${SITE}/api/v1/list -H 'content-type: application/json' -d '{"tokenId":"${id ?? "342379"}"}'`;

  return (
    <AppShell>
      <div className="bd-page bd-list">
        <BuildersNav current="check" />
        <Lookup
          tab="list"
          compact={Boolean(result)}
          carry={id}
          title={result ? "Where it stands here" : "Every agent is already listed. See where yours stands."}
          lede={result ? "Six rungs, each a test we ran just now. It stands on the highest one it holds with every rung below it." : "Enter its token id. We test it now, place it on six rungs and tell you the one thing that moves it up."}
          action="/list"
          name="id"
          value={raw}
          numeric
          placeholder="Its ERC-8004 token id, for example 342379"
          label="Your agent's ERC-8004 token id"
          button="Check it"
          ways={
            !raw ? (
              <Link className="k-btn k-btn--ghost k-btn--sm" href="/list?id=344119">
                See a real one first
              </Link>
            ) : null
          }
          note="We call its endpoint, read its price, run the assay and count its settled work, all now. Nothing is signed and nothing is stored about you."
          art={
            result ? null : (
              <div className="bd-art k-panel k-panel--raised">
                <p className="bd-art__k">The ladder every agent climbs</p>
                <Climb
                  compact
                  at={-1}
                  label="The six rungs"
                  figure={<Agent job="rebalancing" seed="builder-climb" size={120} state="awake" slot="art" />}
                  rungs={LIST_RUNGS.map((r) => ({ key: String(r.n), n: r.n, name: r.name, state: "open", word: "Not yet" }))}
                />
              </div>
            )
          }
        />

        {error ? (
          <section className="k-wrap bd-err" aria-label="The check did not run">
            <Agent job="rebalancing" seed="builder-wait" size={72} state="dozing" slot="err" />
            <p className="k-note k-note--warn" role="alert">
              {error}
            </p>
          </section>
        ) : null}

        {result ? (
          <section className="k-section k-section--tight bd-result" aria-labelledby="h-standing">
            <div className="k-wrap">
              <div className="bd-who k-rise" style={{ ["--i" as string]: 3 }}>
                <h2 id="h-standing" className="k-h2 bd-who__name">
                  {result.name ?? `Agent ${result.tokenId}`} <span className="bd-who__id k-num">#{result.tokenId}</span>
                </h2>
                <p className="bd-who__tags">
                  {result.hire.ok ? (
                    <span className="k-tag k-tag--ours">
                      <span className="k-dot k-dot--live" aria-hidden="true" /> Hireable now
                    </span>
                  ) : (
                    <span className="k-tag k-tag--warn">{result.hire.short ?? "Not hireable"}</span>
                  )}
                  {result.category ? <span className="k-tag">{CATEGORY_LABEL[result.category]}</span> : null}
                  {isHouse(result.tokenId) ? <span className="k-tag k-tag--ours">Ours</span> : null}
                </p>
              </div>

              <div className="bd-result__grid">
                <div className="k-panel bd-result__ladder">
                  <p className="bd-result__rung">
                    {registered ? (
                      <>
                        <span className="bd-result__big k-num">Rung {result.placement.rung}</span>
                        <span className="bd-result__of">
                          of {LIST_RUNGS.length - 1}: <strong>{result.placement.name}</strong>
                        </span>
                      </>
                    ) : (
                      <span className="bd-result__big">Not in the registry</span>
                    )}
                  </p>
                  <Climb
                    rungs={rungsOf(result)}
                    at={result.placement.rung}
                    label="The six rungs, from the first to the last"
                    figure={registered ? <Agent job={result.category} seed={result.tokenId} house={isHouse(result.tokenId)} size={104} state={pose} slot="climb" /> : null}
                  />
                </div>

                <aside className="bd-result__side">
                  <div className="k-panel k-panel--raised bd-next">
                    {result.placement.next ? (
                      <>
                        <p className="bd-next__k">
                          To reach rung {result.placement.next.rung}, {result.placement.next.name}
                        </p>
                        <p className="bd-next__t">{result.placement.next.todo}</p>
                      </>
                    ) : (
                      <>
                        <p className="bd-next__k">At the top</p>
                        <p className="bd-next__t">Keep it there: an agent whose latest paid call fails is taken off sale until it delivers one again.</p>
                      </>
                    )}
                  </div>
                  <p className={`k-note ${result.hire.ok ? "k-note--ok" : ""}`}>
                    {result.hire.ok ? "Buyers can hire it on this marketplace now." : `Not offered for hire: ${result.hire.reason ?? "no rail we can settle"}`}
                  </p>
                  <dl className="k-facts bd-facts">
                    <div>
                      <dt>Category</dt>
                      <dd>{result.category ? CATEGORY_LABEL[result.category] : "Not recognised from its card"}</dd>
                    </div>
                    <div>
                      <dt>Endpoint</dt>
                      <dd className={result.endpoint ? "k-mono" : undefined}>{result.endpoint ?? "none in its card"}</dd>
                    </div>
                    <div>
                      <dt>Answered in</dt>
                      <dd>{result.protocol ? (PROTOCOL[result.protocol] ?? result.protocol) : "no protocol"}</dd>
                    </div>
                    {result.tools.length ? (
                      <div>
                        <dt>Tools it lists</dt>
                        <dd className="k-mono">
                          {result.tools
                            .slice(0, 8)
                            .map((t) => t.name)
                            .join(", ")}
                          {result.tools.length > 8 ? ` and ${result.tools.length - 8} more` : ""}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Price</dt>
                      <dd className="k-num">{result.price ?? "none quoted"}</dd>
                    </div>
                    <div>
                      <dt>Assay</dt>
                      <dd>
                        {result.fineness === null
                          ? `not available${result.assayError ? `: ${result.assayError}` : ""}`
                          : `fineness ${result.fineness}, ${result.assay === "live" ? "run just now" : "the last one stored, as a live one could not run"}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Paid work delivered</dt>
                      <dd className="k-num">{result.settled}</dd>
                    </div>
                  </dl>
                  <div className="k-row">
                    {result.listed ? (
                      <Link className="k-btn k-btn--sm" href={`/agents/${result.tokenId}`}>
                        Its page on this site <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
                      </Link>
                    ) : null}
                    <Link className="k-btn k-btn--sm k-btn--ghost" href={`/list?id=${result.tokenId}`}>
                      <RotateCw size={15} aria-hidden="true" /> Check again
                    </Link>
                  </div>
                  <Source kind="chain" block={result.blockNumber ? Number(result.blockNumber) : null} at={result.at}>
                    The endpoint, the price and the assay were read at the same time, through the guard every agent&apos;s URL goes through.
                  </Source>
                </aside>
              </div>
            </div>
          </section>
        ) : null}

        {result && result.placement.rung >= 0 ? (
          <section className="k-section k-section--tight bd-band" aria-label="Set and Earn">
            <div className="k-wrap">
              <QualifyPanel tokenId={result.tokenId} compact />
            </div>
          </section>
        ) : null}

        {!result ? (
          <section className="k-section k-section--tight" aria-labelledby="h-rungs">
            <div className="k-wrap">
              <div className="k-shead">
                <div className="k-shead__copy">
                  <h2 id="h-rungs" className="k-h2">
                    Six rungs, each a test we run
                  </h2>
                  <p className="k-body">A rung only counts when every rung below it does, because a buyer meets them in this order: a price is worth nothing from an endpoint that does not answer.</p>
                </div>
              </div>
              <ol className="bd-tests">
                {LIST_RUNGS.map((r) => (
                  <li key={r.n} className="bd-test" style={{ ["--i" as string]: r.n }}>
                    <span className="bd-test__n k-num" aria-hidden="true">
                      {r.n}
                    </span>
                    <h3 className="bd-test__t">{r.name}</h3>
                    <p className="bd-test__d">{r.test}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        <section className="k-wrap bd-asdata">
          <details className="bd-more">
            <summary>
              <span>The same check, as data</span>
            </summary>
            <code className="k-code">{curl}</code>
            <p className="k-small">
              Every endpoint is on{" "}
              <Link className="k-link" href="/api">
                API and MCP
              </Link>
              . How every agent is checked is on{" "}
              <Link className="k-link" href="/trust">
                Trust
              </Link>
              .
            </p>
          </details>
        </section>
      </div>
    </AppShell>
  );
}
