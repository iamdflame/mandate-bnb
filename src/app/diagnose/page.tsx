import "@/styles/account.css";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Bell, Search, Wallet } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import AgentCard from "@/components/k/AgentCard";
import Empty from "@/components/x/Empty";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { diagnose, population, type Finding } from "@/lib/diagnose";
import { hireCounts } from "@/lib/market/hires";
import { live } from "@/lib/data/live";
import { viewFixers } from "@/lib/view/diagnose";

export const metadata: Metadata = {
  title: "Check a position | Mandate",
  description:
    "Paste a wallet or a PancakeSwap V3 position and find out whether it is out of range or close to liquidation, then hire an agent that answered when we called it.",
};

export const dynamic = "force-dynamic";
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

/** Our demo account: a real wallet with real positions, offered as a first try. */
const DEMO = "0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90";

/** The three things a check looks for, the job that fixes each, and its founder. */
const LOOKS: { job: Category; seed: string; name: string; what: string; fix: string }[] = [
  { job: "rebalancing", seed: "344119", name: "Range-1", what: "Out of range", fix: "A PancakeSwap V3 position the price has left, earning nothing" },
  { job: "health-factor", seed: "344123", name: "Guard-1", what: "Close to liquidation", fix: "A Venus loan with little headroom left" },
  { job: "yield-optimisation", seed: "344122", name: "Yield-1", what: "Sitting idle", fix: "Stablecoins and BNB held, not earning anywhere" },
];

const GROUP_TITLE: Record<Category, string> = {
  rebalancing: "Your positions",
  "health-factor": "Your Venus loan",
  "yield-optimisation": "Idle money",
  "grid-trading": "Trading",
};

const SEVERITY: Record<Finding["severity"], { word: string; tag: string }> = {
  act: { word: "Act now", tag: "k-tag k-tag--err" },
  watch: { word: "Watch", tag: "k-tag k-tag--warn" },
  fine: { word: "Fine", tag: "k-tag" },
};

function FindingRow({ f }: { f: Finding }) {
  return (
    <li className="ac-find" data-s={f.severity}>
      <span className={SEVERITY[f.severity].tag}>{SEVERITY[f.severity].word}</span>
      <p className="ac-find__t">{f.title}</p>
      <p className="ac-find__d">{f.detail}</p>
    </li>
  );
}

/**
 * The shortest path from a problem to an agent.
 *
 * A plain GET form, server-rendered, so it works with no JavaScript and every
 * result is a URL somebody can paste to a friend. The alternative was a client
 * component posting to an API, which would have made the answer invisible to
 * anyone whose script had not loaded, and unshareable for everyone else.
 */
export default async function DiagnosePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await live();
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 64);

  const counts = await hireCounts().catch(() => null);
  const hires = counts?.byTokenId;
  // A thrown read is the chain failing, which is not the same answer as an input we cannot read.
  let unread = false;
  const result = q
    ? await diagnose(q, hires).catch(() => {
        unread = true;
        return null;
      })
    : null;
  const pop = population();
  const bad = result?.findings.filter((f) => f.severity !== "fine") ?? [];
  const fixers = result?.needed.length ? viewFixers(result.needed, counts) : [];
  const where = result?.kind === "wallet" ? "wallet" : "position";

  // Findings filed under the job that fixes them: the jobs it needs first, then what is fine.
  const groups: { job: Category; items: Finding[]; needs: boolean }[] = [];
  if (result) {
    const order = [...result.needed, ...result.findings.map((f) => f.category).filter((c) => !result.needed.includes(c))];
    for (const job of [...new Set(order)]) groups.push({ job, items: result.findings.filter((f) => f.category === job), needs: result.needed.includes(job) });
  }
  const tally = { act: bad.filter((f) => f.severity === "act").length, watch: bad.filter((f) => f.severity === "watch").length, fine: (result?.findings.length ?? 0) - bad.length };

  return (
    <AppShell>
      <section className={`ac-dx${result ? " ac-dx--done" : ""}`} aria-labelledby="ac-dx-h">
        <div className="ac-dx__pool" aria-hidden="true" />
        <div className="k-wrap ac-dx__in">
          <div className="ac-dx__copy">
            <h1 className="k-display ac-dx__h k-rise" id="ac-dx-h" style={{ ["--i" as string]: 0 }}>
              Is your wallet doing anything?
            </h1>
            <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
              Paste any BNB Chain wallet or a PancakeSwap V3 position number. We read it from the chain and show what is out of range, close to liquidation or sitting idle, and who can fix it.
            </p>
            <form className="ac-dx__form k-rise" style={{ ["--i" as string]: 2 }} action="/diagnose" method="get" role="search">
              <div className="k-field ac-dx__field">
                <Search size={20} aria-hidden="true" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="0x… wallet, or a position number like 1857423"
                  aria-label="Wallet address or PancakeSwap V3 position id"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button className="k-btn k-btn--primary" type="submit">
                  Check it <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                </button>
              </div>
              <p className="k-small ac-dx__hint">
                No wallet to connect and nothing to sign: we only read what the chain shows anyone.{" "}
                {q.toLowerCase() !== DEMO.toLowerCase() ? (
                  <Link className="k-link" href={`/diagnose?q=${DEMO}`}>
                    Try our demo wallet
                  </Link>
                ) : null}
              </p>
            </form>
          </div>

          {/* What a check looks for, and the job that fixes each */}
          <ul className="ac-looks" aria-label="What we look for">
            {LOOKS.map((l, i) => (
              <li key={l.job} className="ac-look" data-job={l.job} style={{ ["--i" as string]: i }}>
                <span className="ac-look__art" aria-hidden="true">
                  <Agent job={l.job} seed={l.seed} house size={76} state="ready" slot="look" />
                </span>
                <span className="ac-look__t">{l.what}</span>
                <span className="ac-look__d">{l.fix}</span>
                <span className="ac-look__job">{CATEGORY_LABEL[l.job]}</span>
              </li>
            ))}
          </ul>
        </div>

        {pop && !result ? (
          <div className="k-wrap">
            <div className="ac-dx__pop k-rise" style={{ ["--i" as string]: 4 }}>
              <div className="k-fig">
                <span className="k-fig__n">{pop.share.toFixed(1)}%</span>
                <span className="k-fig__l">
                  of live PancakeSwap V3 positions were out of range and earning nothing: {pop.outOfRange.toLocaleString("en-GB")} of {pop.live.toLocaleString("en-GB")}.
                </span>
              </div>
              <p className="k-src">
                BNB Smart Chain, block {pop.anchorBlock.toLocaleString("en-GB")}.{" "}
                <Link href="/evidence">How that was measured</Link>
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {q && !result ? (
        <div className="k-wrap ac-sec">
          {unread ? (
            <Empty title="The chain did not answer this time" job="grid-trading" pose="dozing" action={<Link className="k-btn" href={`/diagnose?q=${encodeURIComponent(q)}`}>Try again</Link>}>
              Nothing is wrong with what you typed. Our read of BNB Smart Chain timed out; it usually answers on a second try.
            </Empty>
          ) : (
            <Empty title="That is not a wallet address or a position number" job="rebalancing" pose="failed">
              A wallet is <span className="k-mono">0x</span> followed by forty characters. A PancakeSwap V3 position is a plain number, printed on the position itself.
            </Empty>
          )}
        </div>
      ) : null}

      {result ? (
        <div className="k-wrap ac-sec ac-dx__result">
          <header className="ac-verdict k-rise" style={{ ["--i" as string]: 3 }}>
            <div className="ac-verdict__copy">
              <p className="k-small ac-verdict__for">
                {where === "wallet" ? <Wallet size={14} aria-hidden="true" /> : null}
                <span className="k-mono">{result.kind === "wallet" ? `${result.input.slice(0, 6)}…${result.input.slice(-4)}` : `#${result.input}`}</span>
              </p>
              <h2 className="k-h2">{bad.length === 0 ? "Nothing needs doing" : bad.length === 1 ? "One thing needs doing" : `${bad.length} things need doing`}</h2>
              <p className="k-src">Read from BNB Smart Chain at block {Number(result.blockNumber).toLocaleString("en-GB")}.</p>
            </div>
            {result.findings.length ? (
              <ul className="ac-tally k-num" aria-label="By urgency">
                <li data-s="act">
                  <strong>{tally.act}</strong> act now
                </li>
                <li data-s="watch">
                  <strong>{tally.watch}</strong> to watch
                </li>
                <li data-s="fine">
                  <strong>{tally.fine}</strong> fine
                </li>
              </ul>
            ) : null}
          </header>

          {result.findings.length === 0 ? (
            <Empty title={`No PancakeSwap V3 positions and no Venus borrowing on that ${where}`} job="yield-optimisation" pose="ready" action={<Link className="k-btn" href="/agents">Browse the marketplace</Link>}>
              That is not a failure: most addresses hold neither. If you expected positions here, they may be staked in a farm, which this page does not read yet.
            </Empty>
          ) : (
            <div className="ac-groups">
              {groups.map((g, gi) => {
                const fx = fixers.find((f) => f.category === g.job);
                return (
                  <section key={g.job} className="ac-group" data-job={g.job} data-needs={g.needs ? "1" : undefined} aria-labelledby={`ac-g-${g.job}`} style={{ ["--i" as string]: gi }}>
                    <div className="ac-group__found">
                      <h3 className="ac-group__h" id={`ac-g-${g.job}`}>
                        {GROUP_TITLE[g.job]}
                        <span className="ac-group__n k-num">{g.items.length}</span>
                      </h3>
                      <ol className="ac-finds">
                        {(g.needs ? g.items.filter((f) => f.severity !== "fine") : g.items).map((f, i) => (
                          <FindingRow key={`${f.kind}-${f.tokenId ?? i}`} f={f} />
                        ))}
                      </ol>
                      {g.needs && g.items.some((f) => f.severity === "fine") ? (
                        <details className="ac-more ac-more--sm">
                          <summary>
                            <span className="ac-more__t">{g.items.filter((f) => f.severity === "fine").length} more here, all fine</span>
                          </summary>
                          <ol className="ac-finds ac-more__body">
                            {g.items
                              .filter((f) => f.severity === "fine")
                              .map((f, i) => (
                                <FindingRow key={`${f.kind}-${f.tokenId ?? i}`} f={f} />
                              ))}
                          </ol>
                        </details>
                      ) : null}
                      {g.job === "health-factor" && g.needs ? (
                        <div className="k-row ac-group__also">
                          <Link className="k-btn k-btn--sm" href="/alerts">
                            <Bell size={15} aria-hidden="true" /> Free alert before liquidation
                          </Link>
                          <Link className="k-btn k-btn--sm k-btn--ghost" href="/leash?agent=guard-1">
                            Put Guard-1 on your wallet
                          </Link>
                        </div>
                      ) : null}
                      {g.job === "yield-optimisation" && g.needs ? (
                        <div className="k-row ac-group__also">
                          <Link className="k-btn k-btn--sm k-btn--ghost" href="/leash?agent=yield-1">
                            Put Yield-1 on your wallet
                          </Link>
                        </div>
                      ) : null}
                    </div>

                    {g.needs && fx ? (
                      <div className="ac-group__fix">
                        <p className="ac-group__who">
                          Who can fix it <span className="k-small">{CATEGORY_LABEL[g.job]} agents you can hire now</span>
                        </p>
                        {fx.hireable.length ? (
                          <ul className="ac-fixers">
                            {fx.hireable.map((a, i) => (
                              <li key={a.tokenId}>
                                <AgentCard a={a} i={i} slot={`fx${g.job.slice(0, 3)}${i}`} />
                                <Link className="k-btn k-btn--sm k-btn--block ac-fixers__go" href={`/agents/${a.tokenId}?about=${encodeURIComponent(result.input)}`}>
                                  Hire for this {where}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="ac-nofix">
                            <AlertTriangle size={18} aria-hidden="true" />
                            <div>
                              <p className="ac-nofix__t">No {CATEGORY_LABEL[g.job].toLowerCase()} agent can be hired right now.</p>
                              <p className="k-small">
                                {fx.answering
                                  ? `${fx.answering} answer in an agent protocol, but none has a price we can settle and a clean record. We will not recommend one we could not pay.`
                                  : "None answered in an agent protocol when we last called."}{" "}
                                <Link className="k-link" href={`/agents?category=${g.job}&view=all`}>
                                  See all of them anyway
                                </Link>
                              </p>
                            </div>
                          </div>
                        )}
                        {fx.total > fx.hireable.length ? (
                          <Link className="k-btn k-btn--ghost k-btn--sm ac-group__all" href={`/agents?category=${g.job}`}>
                            All {fx.total} hireable {CATEGORY_LABEL[g.job].toLowerCase()} agents <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
                          </Link>
                        ) : null}
                        <p className="k-src">Only agents a buyer can hire right now, by the same rules as everywhere on this site.</p>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          )}

          {result.findings.length ? (
            <p className="k-small ac-dx__fine">
              A range is half open: at the upper tick the position holds one side of the pair and earns no fees, so we count that as out. Positions whose pool would not answer are reported as unchecked rather than guessed at.
            </p>
          ) : null}

          {bad.length === 0 && result.findings.length > 0 ? (
            <div className="k-note k-note--ok ac-dx__ok">
              <span>Nothing here needs an agent right now.</span>
              <Link className="k-link" href="/agents">
                Browse the marketplace anyway
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
