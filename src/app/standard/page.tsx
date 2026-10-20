import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check, Equal, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import Empty from "@/components/x/Empty";
import Ago from "@/components/x/Ago";
import TrustHead from "@/components/trust/TrustHead";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { live } from "@/lib/data/live";
import { findAgent } from "@/lib/data/agents";
import { latestConformance, type Latest } from "@/lib/conformance/run";
import { TOLERANCE } from "@/lib/conformance/checks";
import { DEMO_ADDRESS } from "@/lib/demo";
import { withTimeout } from "@/lib/cache";

export const metadata: Metadata = {
  title: "The MANDATE standard | MANDATE",
  description: "How every agent's answer is checked against our own reading of BNB Smart Chain, by code, and each agent's latest result.",
};

export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Mandate's own agent in each job, the founder of its family. */
const FOUNDER: Record<Category, string> = { rebalancing: "344119", "grid-trading": "344121", "yield-optimisation": "344122", "health-factor": "344123" };

/** The rules, stated from the constants the checks enforce, so the page cannot say one thing while the code does another. */
const RULES: { job: Category; asked: string; checked: string[] }[] = [
  {
    job: "health-factor",
    asked: `The health factor of the Venus loan on ${short(DEMO_ADDRESS)}, the public test account.`,
    checked: [
      `Its health factor is within ${pct(TOLERANCE.healthFactor)} of the one we derive from Venus's Comptroller at the same time (${pct(TOLERANCE.healthFactorAged)} for an answer taken more than an hour earlier).`,
      "With no loan, it says there is none.",
    ],
  },
  {
    job: "rebalancing",
    asked: `Whether the PancakeSwap V3 positions of ${short(DEMO_ADDRESS)} are in range.`,
    checked: [
      "Whether a position is in range matches the pool's own tick, read now.",
      `The pool's current tick it states is within ${TOLERANCE.tick} ticks of ours (not held to this when the answer is more than an hour old).`,
      "An answer naming a position is compared with that position, read from the chain.",
    ],
  },
  {
    job: "yield-optimisation",
    asked: "Where 1,000 USDT earns most on BNB Smart Chain.",
    checked: [
      `A Venus USDT rate it states is within ${pct(TOLERANCE.rate)} of the rate we compute from Venus's rate per block and a block time we measure.`,
      "An answer only about venues we do not read ourselves is not comparable, never failed.",
    ],
  },
  {
    job: "grid-trading",
    asked: "A grid for WBNB/USDT between two prices 8% either side of the price now, with a stop and 1,000 USD of capital, over 10 levels.",
    checked: [
      `Every level lies inside the bounds asked for (within ${pct(TOLERANCE.gridBounds)}).`,
      "It has the number of levels asked for, give or take one, in price order.",
      "Its allocations add up to no more than the capital.",
    ],
  },
];

const WORD: Record<Latest["verdict"], string> = { pass: "Passed", fail: "Failed", "not-comparable": "Not comparable", unreadable: "Could not be checked", untested: "Not tested yet" };
const TONE: Record<Latest["verdict"], string> = { pass: "pass", fail: "fail", "not-comparable": "none", unreadable: "warn", untested: "none" };
const ORDER: Latest["verdict"][] = ["pass", "fail", "unreadable", "not-comparable", "untested"];

/**
 * The standard: one public question per job, an answer compared with our
 * own reading of the chain field by field, by code, and every agent's latest
 * result. No language model grades anything.
 */
export default async function StandardPage() {
  await live();
  const all = [...((await withTimeout(latestConformance().catch(() => new Map<string, Latest>()), 6_000)) ?? new Map<string, Latest>()).values()];
  const passed = all.filter((r) => r.verdict === "pass").length;
  const counts = ORDER.map((v) => ({ v, n: all.filter((r) => r.verdict === v).length })).filter((c) => c.n > 0);
  const rows = all.sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          title="Same question, checked by code."
          lede="Every agent in a job is asked the same public question. We read the same facts from BNB Smart Chain ourselves and compare its answer field by field. Our own agents are held to the same rules."
          art={
            <div className="tr-cmp" aria-hidden="true">
              <div className="tr-cmp__card tr-cmp__card--ask">
                <span className="tr-cmp__k">One public question</span>
                <span className="tr-cmp__line" />
                <span className="tr-cmp__line tr-cmp__line--short" />
              </div>
              <div className="tr-cmp__mid">
                <Agent job="rebalancing" seed="standard-asked" size={120} state="working" slot="cmp" />
              </div>
              <div className="tr-cmp__pair">
                <div className="tr-cmp__card">
                  <span className="tr-cmp__k">Its answer</span>
                  <span className="tr-cmp__line" />
                  <span className="tr-cmp__line tr-cmp__line--short" />
                </div>
                <span className="tr-cmp__eq">
                  <Equal size={18} strokeWidth={2.6} />
                </span>
                <div className="tr-cmp__card tr-cmp__card--ours">
                  <span className="tr-cmp__k">Our reading of the chain</span>
                  <span className="tr-cmp__line" />
                  <span className="tr-cmp__line tr-cmp__line--short" />
                </div>
              </div>
            </div>
          }
        >
          {all.length ? (
            <div className="tr-figs">
              <div className="k-fig tr-fig--ok">
                <span className="k-fig__n k-num">
                  {passed} of {all.length}
                </span>
                <span className="k-fig__l">agents checked passed on their latest answer</span>
              </div>
            </div>
          ) : null}
        </TrustHead>

        <section className="tr-sec tr-sec--first" aria-labelledby="tr-rules">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h2" id="tr-rules">
                  One question per job.
                </h2>
                <p className="k-body">Answers come from an agent&apos;s free call where it has one, and otherwise from our daily test purchase, within a small daily budget.</p>
              </div>
            </div>
            <ul className="tr-rules">
              {RULES.map((r, i) => (
                <li key={r.job} className="tr-rule" data-job={r.job} style={{ ["--i" as string]: i }}>
                  <div className="tr-rule__head">
                    <span className="tr-rule__art" aria-hidden="true">
                      <Agent job={r.job} seed={FOUNDER[r.job]} house size={64} state="ready" slot="rule" />
                    </span>
                    <h3 className="tr-rule__t">{CATEGORY_LABEL[r.job]}</h3>
                  </div>
                  <p className="tr-rule__ask">
                    <span className="tr-rule__k">Asked</span>
                    {r.asked}
                  </p>
                  <ul className="tr-rule__checks">
                    {r.checked.map((c) => (
                      <li key={c}>
                        <Check size={14} strokeWidth={2.6} aria-hidden="true" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="tr-sec" aria-labelledby="tr-results">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 className="k-h2" id="tr-results">
                  Latest results.
                </h2>
                <p className="k-body">
                  {passed} of {all.length} agents checked passed on their latest answer. Each line links to the agent, where the field-by-field comparison is shown.
                </p>
              </div>
            </div>

            {all.length ? (
              <>
                <div className="tr-split" role="img" aria-label={counts.map((c) => `${c.n} ${WORD[c.v].toLowerCase()}`).join(", ")}>
                  {counts.map((c) => (
                    <span key={c.v} className={`tr-split__seg tr-split__seg--${TONE[c.v]}`} style={{ flexGrow: c.n }}>
                      <span className="k-num">{c.n}</span> {WORD[c.v].toLowerCase()}
                    </span>
                  ))}
                </div>
                <div className="k-table-wrap">
                  <table className="k-table tr-results">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Job</th>
                        <th>Result</th>
                        <th>Why</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.tokenId}>
                          <td className="k-table__main">
                            <Link className="tr-results__who" href={`/agents/${r.tokenId}#checks`}>
                              <span>{findAgent(r.tokenId)?.name ?? `Agent #${r.tokenId}`}</span>
                            </Link>
                            <span className="k-src">
                              <Ago iso={r.at} prefix="checked" />
                            </span>
                          </td>
                          <td>{CATEGORY_LABEL[r.category as Category] ?? r.category}</td>
                          <td>
                            <span className={`tr-v tr-v--${TONE[r.verdict]}`}>
                              {r.verdict === "pass" ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : r.verdict === "fail" ? <X size={13} strokeWidth={3} aria-hidden="true" /> : null}
                              {WORD[r.verdict]}
                            </span>
                          </td>
                          <td>
                            {r.checks.length ? (
                              <ul className="tr-fields">
                                {r.checks.map((c, k) => (
                                  <li key={`${c.field}-${k}`} data-pass={c.pass ? "1" : "0"}>
                                    <span className="tr-fields__f">{c.field}</span>
                                    {c.pass ? (
                                      <span className="tr-fields__ok">matches</span>
                                    ) : (
                                      <span className="tr-fields__no">
                                        ours <span className="k-num">{c.ours}</span>, theirs <span className="k-num">{c.theirs}</span>
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="k-small">{r.note}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Empty
                title="No results to show on this request."
                job="health-factor"
                action={
                  <Link className="k-btn" href="/agents?checked=1">
                    See checked agents <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
                  </Link>
                }
              >
                The record of checks did not answer in time, or holds nothing yet. Each agent&apos;s own page still shows its latest check.
              </Empty>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
