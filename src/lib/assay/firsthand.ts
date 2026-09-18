/**
 * What we know about an agent first hand, for the six checks.
 *
 * The assay used to grade an agent from what the registry and the explorer
 * said about it: a verification flag, transactions with certain contracts,
 * feedback stars. For an agent that sells reads, all three are blind. Muster's
 * health factor watch had taken our money five times and answered every time
 * with a figure that matched Venus, and the six checks gave it one pass out of
 * six, because 8004scan does not index its card, it never sends Venus a
 * transaction, and nobody had left it a star.
 *
 * This is the other source: our own probe, our own paid calls, and where we
 * can, our own reading of the same fact its answer states. An agent's paid
 * answer agreeing with the chain is a capability claim tested, not inferred.
 */

import { parseAbi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { probeFor } from "@/lib/data/probes";
import type { ProbeResult } from "@/lib/probe";
import { listPaidCalls, outcomes, type Outcome, type PaidCallRecord } from "@/lib/market/paid-calls";
import { listSessions } from "@/lib/chain/session-store";
import { readVenus } from "@/lib/diagnose/positions";
import { withTimeout } from "@/lib/cache";
import { REFERENCE, referenceRegistrations } from "@/lib/house";
import { DEMO_ADDRESS } from "@/lib/demo";
import { readGridWindow } from "@/lib/grid/window";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface AnswerCheck {
  at: string;
  tx: string | null;
  /** What the answer stated, in a phrase. */
  what: string;
  /** True when our own reading agrees, false when it does not, null when we have no reading to check against. */
  agrees: boolean | null;
  detail: string;
}

export interface FirstHand {
  probe: ProbeResult | null;
  calls: Outcome | null;
  delivered: PaidCallRecord[];
  answers: AnswerCheck[];
}

/** The contracts and tokens these sessions name, in words rather than hex. */
const TOKEN: Record<string, string> = {
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "WBNB",
  "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": "USD1",
  "0xce24439f2d9c6a2289f741120fe202248b666666": "U",
  "0x5863edaede7394470db19395ca05b1439662952e": "RecipientBound",
  "0x1cf9c5e9339e99e3bfd45f117ca17e6e1a4e59d1": "SwapBound",
  "0xfd5840cd36d94d7229439859c0112a4185bc0255": "Venus vUSDT",
};

const SLOT0 = parseAbi(["function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, uint32 d, bool e)"]);

/**
 * One answer, checked against the chain.
 *
 * The hard part is that an answer is a statement about a moment, and we check
 * it later. BSC's public RPC serves state at the head block only: a read at a
 * week-old block either fails or, worse, returns zeros that look like a real
 * answer. So "the seller said the health factor was 4.0, and Venus says 4.0
 * now" is not proof the seller was right. It is proof of nothing if the
 * position moved in between, and both of these answers are a week old.
 *
 * So each answer is checked two ways, and only the sound one sets the verdict:
 *
 *   - Facts that cannot change: a pool's token pair, its fee, its tick
 *     spacing. These are immutable, so today's reading is the reading that
 *     was true then. A fabricated answer gets them wrong.
 *   - The answer's own arithmetic: a health factor against the collateral and
 *     debt the same answer reports, an in-range verdict against the tick and
 *     the band the same answer reports. A seller passing off a guess
 *     contradicts itself here.
 *   - Live state, where it is still comparable: only when the position behind
 *     it is demonstrably unchanged. Otherwise it is reported as moved, not as
 *     disagreement.
 *
 * An answer we cannot check is recorded as unchecked, never as wrong.
 */
const POOL_FACTS = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
]);

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9);

async function checkAnswer(c: PaidCallRecord): Promise<AnswerCheck> {
  const base = { at: c.at, tx: c.tx };
  const r = (c.deliverable as { result?: Record<string, unknown> } | null)?.result;
  if (!r) return { ...base, what: "an answer with no result field", agrees: null, detail: "no result to check" };

  if (c.tokenId === "342377" && typeof r.healthFactor === "number" && typeof r.account === "string") {
    const theirs = r.healthFactor;
    const what = `health factor ${theirs.toFixed(3)} for ${r.account.slice(0, 10)}…`;
    const col = typeof r.totalCollateralUsd === "number" ? r.totalCollateralUsd : null;
    const debt = typeof r.totalBorrowUsd === "number" ? r.totalBorrowUsd : null;
    const liq = typeof r.liquidityUsd === "number" ? r.liquidityUsd : null;

    // The answer against itself: Venus's health factor is weighted collateral
    // over debt, and its spare liquidity is the difference. A seller that
    // invented the figure has no reason to satisfy both.
    const consistent = col !== null && debt !== null && debt > 0 ? near(theirs, col / debt, 0.01) : null;
    const liquidityAdds = col !== null && debt !== null && liq !== null ? near(liq, col - debt, 0.01) : null;
    if (consistent === false || liquidityAdds === false) {
      return { ...base, what, agrees: false, detail: `its own figures do not agree: ${col} collateral over ${debt} debt is not ${theirs.toFixed(3)}` };
    }

    const ours = await withTimeout(readVenus(r.account as Address).catch(() => null), 8_000);
    const mine = ours?.healthFactor;
    if (!ours || mine === null || mine === undefined) {
      return { ...base, what, agrees: consistent, detail: consistent ? "its collateral, debt and health factor agree with each other; our own Venus reading did not answer in time to compare" : "our own Venus reading did not answer in time" };
    }

    /*
      Is the position still the one the answer was about? The chain gives us
      only the head block, so this comparison means something only if nothing
      has moved since. Spare liquidity is the cheapest witness to that.
    */
    const unchanged = liq !== null ? near(ours.liquidityUsd, liq, 0.02) : null;
    const agreesNow = near(theirs, mine, 0.05);
    if (unchanged === false) {
      return {
        ...base,
        what,
        agrees: consistent,
        detail: `the account has moved since (it had ${liq!.toFixed(4)} spare then, ${ours.liquidityUsd.toFixed(4)} now), so the figure cannot be read back${consistent ? "; its collateral, debt and health factor do agree with each other" : ""}`,
      };
    }
    return {
      ...base,
      what,
      agrees: agreesNow,
      detail: `the position is unchanged since, and Venus reads ${mine.toFixed(3)}${agreesNow ? ", within five percent" : ", which does not agree"}`,
    };
  }

  const drift = r.drift as { inRange?: boolean; lowerTick?: number; upperTick?: number; currentTick?: number; pool?: string } | undefined;
  const pool = r.pool as { pool?: string; token0?: string; token1?: string; fee?: number; tickSpacing?: number; tick?: number } | undefined;
  if (c.tokenId === "342379" && drift && typeof drift.inRange === "boolean" && typeof drift.lowerTick === "number" && typeof drift.upperTick === "number") {
    const addr = (drift.pool ?? pool?.pool) as string | undefined;
    const what = `${drift.inRange ? "in" : "out of"} range for [${drift.lowerTick}, ${drift.upperTick}) at tick ${drift.currentTick}`;

    // The verdict against the tick and band the same answer reports.
    const consistent = typeof drift.currentTick === "number" ? (drift.currentTick >= drift.lowerTick && drift.currentTick < drift.upperTick) === drift.inRange : null;
    if (consistent === false) return { ...base, what, agrees: false, detail: `tick ${drift.currentTick} against [${drift.lowerTick}, ${drift.upperTick}) is not ${drift.inRange ? "in" : "out of"} range: the answer contradicts itself` };

    if (!addr || !pool) return { ...base, what, agrees: consistent, detail: "its verdict follows from the tick and band it reported; it named no pool we could read back" };

    /*
      A pool's pair, fee and tick spacing are immutable, so reading them now
      reads them as they were. This is the part of the answer that a week does
      not touch, and the part a fabricated answer gets wrong.
    */
    const facts = await withTimeout(
      Promise.all([
        marketClient.readContract({ address: addr as Address, abi: POOL_FACTS, functionName: "token0" }),
        marketClient.readContract({ address: addr as Address, abi: POOL_FACTS, functionName: "token1" }),
        marketClient.readContract({ address: addr as Address, abi: POOL_FACTS, functionName: "fee" }),
        marketClient.readContract({ address: addr as Address, abi: POOL_FACTS, functionName: "tickSpacing" }),
      ]).catch(() => null),
      8_000,
    );
    if (!facts) return { ...base, what, agrees: consistent, detail: "its verdict follows from the tick and band it reported; the pool did not answer in time" };
    const [t0, t1, fee, spacing] = facts as [Address, Address, number, number];
    const wrong: string[] = [];
    if (pool.token0 && pool.token0.toLowerCase() !== t0.toLowerCase()) wrong.push("token0");
    if (pool.token1 && pool.token1.toLowerCase() !== t1.toLowerCase()) wrong.push("token1");
    if (typeof pool.fee === "number" && pool.fee !== Number(fee)) wrong.push("fee");
    if (typeof pool.tickSpacing === "number" && pool.tickSpacing !== Number(spacing)) wrong.push("tick spacing");
    if (wrong.length) return { ...base, what, agrees: false, detail: `it reported the wrong ${wrong.join(" and ")} for that pool` };

    const slot = await withTimeout(marketClient.readContract({ address: addr as Address, abi: SLOT0, functionName: "slot0" }).catch(() => null), 6_000);
    const tickNow = slot ? Number((slot as readonly unknown[])[1]) : null;
    const moved = tickNow !== null && typeof drift.currentTick === "number" ? tickNow - drift.currentTick : null;
    return {
      ...base,
      what,
      agrees: consistent === null ? null : consistent,
      detail:
        `it named ${TOKEN[t0.toLowerCase()] ?? t0.slice(0, 10)}/${TOKEN[t1.toLowerCase()] ?? t1.slice(0, 10)} at ${Number(fee) / 10_000}% with tick spacing ${spacing}, which is what the pool is, and its verdict follows from the tick it reported` +
        (moved === null ? "" : `. The tick has moved ${moved > 0 ? "up" : "down"} ${Math.abs(moved)} since, so the range verdict itself is a statement about that moment, not this one`),
    };
  }

  return { ...base, what: "an answer from an off-chain source", agrees: null, detail: "nothing on chain states this fact, so it is not checked" };
}

export async function firstHand(tokenId: string): Promise<FirstHand> {
  const probe = probeFor(tokenId);
  const calls = (await withTimeout(listPaidCalls().catch(() => []), 6_000)) ?? [];
  const mine = calls.filter((c) => c.tokenId === tokenId);
  const delivered = mine.filter((c) => c.paid && c.delivered);
  // The most recent few: enough to show a pattern, cheap enough for a page.
  const answers = await Promise.all(delivered.slice(0, 3).map(checkAnswer));
  return { probe, calls: mine.length ? (outcomes(mine).get(tokenId) ?? null) : null, delivered, answers };
}

/**
 * Our own reference agents, judged by what they did rather than by a wallet
 * that never signs.
 *
 * Each of them acts through a session on the demo account, so the wallet the
 * registry names for them has a deployment transaction and nothing else. The
 * six checks graded that wallet and called our own agents inactive and
 * incapable, which is honest about the wallet and wrong about the agent. This
 * names the account that acts, and for performance, the record that exists:
 * Grid-1's window read from SwapBound's events, losses included, and Range-1's
 * recenter with the position's owner unchanged throughout.
 */
export interface HouseFacts {
  slug: string;
  /** The account the agent's session acts on. */
  operating: Address;
  performance: { verdict: "pass" | "fail" | "inconclusive"; finding: string; evidence: { label: string; value: string; url?: string }[] } | null;
  /** What it actually did on chain, whenever it did it. */
  actions: { label: string; tx: string; at: string }[];
  /** The session it acts through: the allowlist, the caps and the expiry. */
  leash: { calls: string[]; caps: string; expiry: number; registered: boolean; keyId: string; live: boolean } | null;
}

export async function houseFacts(tokenId: string): Promise<HouseFacts | null> {
  const regs = referenceRegistrations();
  const ref = REFERENCE.find((r) => regs[r.slug]?.tokenId === tokenId);
  if (!ref) return null;
  const operating = DEMO_ADDRESS as Address;
  const tx = (h: string) => `https://bscscan.com/tx/${h}`;

  /*
    The session is the custody arrangement. These agents hold no wallet of
    their own: they act on the principal's account through a key whose
    allowlist names four selectors on a contract that can only pay the
    principal back, with a daily cap and an expiry.
  */
  const sessions = await withTimeout(listSessions().catch(() => []), 6_000);
  const mine = (sessions ?? []).filter((x) => x.id.startsWith(`house:${ref.slug}:`));
  const liveOne = mine.find((x) => !x.revokedAt && x.expiry * 1000 > Date.now()) ?? mine[mine.length - 1] ?? null;
  const leash = liveOne
    ? {
        calls: (liveOne.allowlist ?? []).map((c) => `${c.signature.split("(")[0]} on ${TOKEN[c.to.toLowerCase()] ?? c.to}`),
        // `spend` is a list of daily limits, one per token, with the native
        // limit carrying no token at all. Reading it as a map produced NaN.
        caps:
          ((liveOne.permissions as { spend?: { limit?: string; token?: string; period?: string }[] } | undefined)?.spend ?? [])
            .map((sp) => `${Number(sp.limit ?? 0) / 1e18} ${sp.token ? (TOKEN[sp.token.toLowerCase()] ?? sp.token.slice(0, 10)) : "BNB"} a ${sp.period ?? "day"}`)
            .join(", ") || "no spend permitted",
        expiry: liveOne.expiry,
        registered: liveOne.registered,
        keyId: liveOne.keyId,
        live: !liveOne.revokedAt && liveOne.expiry * 1000 > Date.now(),
      }
    : null;

  const actions: { label: string; tx: string; at: string }[] = [];

  if (ref.slug === "grid-1") {
    const w = await withTimeout(readGridWindow().catch(() => null), 8_000);
    for (const f of (w?.fills ?? []).slice(0, 5)) actions.push({ label: `${f.side} ${f.wbnb} WBNB at ${f.price.toFixed(2)} USDT through SwapBound`, tx: f.tx, at: f.at ?? "" });
    if (!w || !w.fills.length) return { slug: ref.slug, operating, performance: null, actions, leash };
    const lost = w.pnlUsd < 0;
    return {
      slug: ref.slug,
      operating,
      actions,
      leash,
      performance: {
        verdict: lost ? "fail" : "pass",
        finding: `${w.fills.length} real fills through SwapBound, ${w.roundTrips.length} round trip${w.roundTrips.length === 1 ? "" : "s"}, ${w.winRate === null ? "no win rate yet" : `${Math.round(w.winRate * 100)}% won`}; against doing nothing it is ${w.pnlUsd < 0 ? "down" : "up"} $${Math.abs(w.pnlUsd).toFixed(2)} net of gas, worst drawdown $${w.maxDrawdownUsd.toFixed(2)}. ${lost ? "It has lost to holding so far, and that stays published." : "It has beaten holding so far."}`,
        evidence: [
          { label: "Window", value: `${w.window.start?.slice(0, 16) ?? "?"} to ${w.window.end?.slice(0, 16) ?? "?"} UTC, blocks ${w.fromBlock} to ${w.toBlock}` },
          ...w.fills.slice(0, 3).map((f) => ({ label: `${f.side} ${f.wbnb} WBNB at ${f.price.toFixed(2)}`, value: f.tx, url: tx(f.tx) })),
          { label: "Read it yourself", value: w.verify },
        ],
      },
    };
  }

  if (ref.slug === "range-1") {
    try {
      const doc = JSON.parse(readFileSync(join(process.cwd(), "src/data/recenter.json"), "utf8")) as { runs?: Record<string, unknown>[] } & Record<string, unknown>;
      const runs = (doc.runs ?? [doc]) as { sameOwnerThroughout?: boolean; before?: { tokenId?: string }; after?: { tokenId?: string; inRange?: boolean }; txs?: Record<string, string>; at?: string }[];
      const last = runs[runs.length - 1];
      for (const [k, v] of Object.entries(last?.txs ?? {})) actions.push({ label: `${k} through RecipientBound`, tx: v, at: last?.at ?? "" });
      if (!last?.txs) return { slug: ref.slug, operating, performance: null, actions, leash };
      return {
        slug: ref.slug,
        operating,
        actions,
        leash,
        performance: {
          verdict: last.sameOwnerThroughout ? "pass" : "fail",
          finding: `Recentred position #${last.before?.tokenId ?? "?"} into #${last.after?.tokenId ?? "?"} through RecipientBound on ${last.at?.slice(0, 10) ?? "?"}; the owner was the principal before, during and after, ${last.after?.inRange ? "and the new range was in range at the mint" : "and the new range was out of range at the mint"}.`,
          evidence: Object.entries(last.txs).map(([k, v]) => ({ label: k, value: v, url: tx(v) })),
        },
      };
    } catch {
      return { slug: ref.slug, operating, performance: null, actions, leash };
    }
  }

  /*
    Yield-1 and Guard-1 each ran once, wrote down what they did, and were then
    graded as having done nothing: the capability check looked for protocol
    transactions from a wallet that never signs, and the performance check
    looked for a position history the demo account is too small to have. Both
    runs are on chain with a transaction hash, and both recorded the reading
    before and the reading after, which is the only thing a return can be
    computed from here.
  */
  if (ref.slug === "yield-1") {
    const run = record<{ tx: string; summary: string; at: string; rates?: { venusApr: number | null; aaveApr: number | null } }>("yield-1.json");
    if (!run?.tx) return { slug: ref.slug, operating, performance: null, actions, leash };
    actions.push({ label: "supplied USDT to Venus through its session", tx: run.tx, at: run.at ?? "" });
    const venus = run.rates?.venusApr ?? null;
    const aave = run.rates?.aaveApr ?? null;
    // It supplied at the lower rate on purpose: Aave's supply names the
    // address to credit, and no session here may call a function that does.
    // That is a real limit on what a leash can optimise, and it is published
    // rather than scored as a win.
    const tookLess = venus !== null && aave !== null && aave > venus;
    return {
      slug: ref.slug,
      operating,
      actions,
      leash,
      performance: {
        verdict: tookLess ? "inconclusive" : "pass",
        finding: tookLess
          ? `Supplied to Venus at ${(venus! * 100).toFixed(2)}% a year when Aave paid ${(aave! * 100).toFixed(2)}%. It took the lower rate deliberately: Aave's supply takes the address to credit as an argument, and a session cannot constrain an argument, so no leash here may call it. That is the cost of custody staying with the owner, and it is counted as a cost rather than as a win.`
          : `Supplied to Venus at ${venus === null ? "an unread rate" : `${(venus * 100).toFixed(2)}% a year`}, the best rate reachable through a call its leash permits.`,
        evidence: [
          { label: "Supply", value: run.tx, url: tx(run.tx) },
          { label: "Rates it compared", value: `Venus ${venus === null ? "unread" : `${(venus * 100).toFixed(2)}%`}, Aave ${aave === null ? "unread" : `${(aave * 100).toFixed(2)}%`}` },
          { label: "What it did", value: run.summary },
        ],
      },
    };
  }

  if (ref.slug === "guard-1") {
    const run = record<{ tx: string; summary: string; before: number; after: number; trigger: number; at: string }>("guard-1.json");
    if (!run?.tx) return { slug: ref.slug, operating, performance: null, actions, leash };
    actions.push({ label: "repaid USDT debt through its session", tx: run.tx, at: run.at ?? "" });
    const worked = typeof run.after === "number" && typeof run.trigger === "number" && run.after > run.trigger;
    return {
      slug: ref.slug,
      operating,
      actions,
      leash,
      performance: {
        verdict: worked ? "pass" : "fail",
        finding: `Health factor was ${run.before?.toFixed(3) ?? "?"} against its ${run.trigger?.toFixed(2) ?? "?"} trigger; it repaid part of the account's own debt and the health factor read ${run.after?.toFixed(3) ?? "?"} afterwards. ${worked ? "The thing it exists to prevent was prevented, and the reading before and after is on chain." : "It acted and the health factor is still under the trigger."}`,
        evidence: [
          { label: "Repayment", value: run.tx, url: tx(run.tx) },
          { label: "Health factor", value: `${run.before?.toFixed(3) ?? "?"} before, ${run.after?.toFixed(3) ?? "?"} after, trigger ${run.trigger?.toFixed(2) ?? "?"}` },
          { label: "What it did", value: run.summary },
        ],
      },
    };
  }

  return { slug: ref.slug, operating, performance: null, actions, leash };
}

function record<T>(name: string): T | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "src/data", name), "utf8")) as T;
  } catch {
    return null;
  }
}
