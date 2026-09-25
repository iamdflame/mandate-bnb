/**
 * Jobs with capital, carried through every epoch on the site's clock.
 *
 * After an award there is no exit for the buyer until every epoch settles, so
 * a job that waits on a person is a job that can stall with the buyer's money
 * in it. This takes each active job forward on its own:
 *
 *   propose   once an epoch has elapsed, the adjudicator measures the agent's
 *             wallet at a block, works out alpha against the job's benchmark
 *             exactly as the contract checks it, and proposes it with a stake;
 *   finalise  once the challenge window has passed unchallenged, anyone may
 *             finalise, and we do;
 *   close     once the term is served, the capital and bond are released to
 *             their owners' withdrawable balances.
 *
 * A challenged epoch is left alone: it is the owner's to resolve, in public.
 * Each benchmark is the published one: Hold and LiquidationAvoided keep the
 * opening mark, so alpha is the agent's raw return; BestPassiveRate grows the
 * mark at Venus's live USDT supply rate for the time the epoch took.
 */

import { type Address } from "viem";
import { MANDATE_MARKET_V2_ABI } from "@/lib/chain/abiV2";
import { MARKET_V2 } from "@/lib/chain/deployments";
import { marketClient, walletFor } from "@/lib/chain/market";
import { adjudicatorWallet, alphaBetween, closeMandate, finaliseEpoch, marketParameters, previousMarkV2, proposalFor, proposeEpoch, ZERO_REF, type ObservationV2 } from "@/lib/chain/marketV2";
import { valueWallet } from "@/lib/chain/prices";
import { usdtRates } from "@/lib/venus/rates";

const STATE = ["Open", "Active", "Closed", "Abandoned"] as const;
/*
  Jobs #0 to #4 were our own tests in September, opened by our account with our
  keepers as agents, and their keepers' wallets have been used for other work
  since. Measuring them now would record a loss no strategy made, so the clock
  starts at #5 and leaves those as they stand, in public.
*/
export const EPOCHS_FROM = Number(process.env.EPOCHS_FROM ?? 5);
const YEAR = 365n * 24n * 3600n;

interface MandateView {
  principal: Address;
  agent: Address;
  state: number;
  benchmark: number;
  epochLength: number;
  epochsTotal: number;
  epochsSettled: number;
  lastSettledAt: bigint;
}

const read = (functionName: string, args: unknown[] = []) =>
  marketClient.readContract({ address: MARKET_V2, abi: MANDATE_MARKET_V2_ABI, functionName, args } as never) as Promise<unknown>;

/** The benchmark at this moment, from the previous mark, by the job's own rule. Pure, for tests. */
export function benchmarkNow(benchmark: number, previousWei: bigint, elapsedSeconds: bigint, passiveAprBps: bigint | null): bigint {
  if (benchmark === 1 && passiveAprBps !== null && passiveAprBps > 0n) {
    return previousWei + (previousWei * passiveAprBps * elapsedSeconds) / (10_000n * YEAR);
  }
  return previousWei;
}

async function observe(m: MandateView, mandateId: number, epoch: number): Promise<{ obs: ObservationV2; alpha: bigint } | null> {
  const prev = await previousMarkV2(mandateId, epoch);
  if (!prev || prev.valuationWei === 0n) return null;
  const v = await valueWallet(m.agent);
  if (v.weiTotal === 0n) return null;
  const rate = m.benchmark === 1 ? await usdtRates().then((r) => BigInt(Math.round((r.venusApr ?? 0) * 10_000)), () => null) : null;
  const elapsed = BigInt(Math.floor(Date.now() / 1000)) - prev.takenAt;
  const obs: ObservationV2 = {
    wallet: m.agent,
    valuationWei: v.weiTotal,
    gasSpentWei: 0n,
    priceX96: v.sqrtPriceX96,
    blockNumber: v.blockNumber,
    breakdownRef: ZERO_REF,
    benchmarkWei: benchmarkNow(m.benchmark, prev.benchmarkWei, elapsed > 0n ? elapsed : 0n, rate),
  };
  const alpha = alphaBetween(prev, obs);
  return alpha === null ? null : { obs, alpha };
}

/** One pass over every active job: at most one step each, as many as the slice allows. */
export async function advanceEpochs(opts: { budgetMs: number }): Promise<string> {
  const started = Date.now();
  const count = Number((await read("mandateCount")) as bigint);
  const params = await marketParameters();
  if (params.paused) return "the market is paused";
  let adjudicator: ReturnType<typeof walletFor> | null = null;
  const out: string[] = [];
  const now = BigInt(Math.floor(Date.now() / 1000));

  for (let id = EPOCHS_FROM; id < count; id++) {
    if (Date.now() - started > opts.budgetMs) break;
    const m = (await read("getMandate", [BigInt(id)])) as unknown as MandateView;
    if (STATE[m.state] !== "Active") continue;
    try {
      adjudicator ??= adjudicatorWallet();
      if (m.epochsSettled >= m.epochsTotal) {
        await closeMandate(adjudicator, id);
        out.push(`#${id}: served, closed; capital released to its owner`);
        continue;
      }
      const epoch = m.epochsSettled;
      const p = await proposalFor(id, epoch);
      const proposed = p && p.proposer && !/^0x0{40}$/i.test(p.proposer);
      if (!proposed) {
        if (now < m.lastSettledAt + BigInt(m.epochLength)) continue;
        const measured = await observe(m, id, epoch);
        if (!measured) {
          out.push(`#${id} epoch ${epoch}: could not be measured`);
          continue;
        }
        await proposeEpoch(adjudicator, id, measured.alpha, measured.obs, params.proposerStake);
        out.push(`#${id} epoch ${epoch}: proposed ${Number(measured.alpha) / 100}%`);
        continue;
      }
      if (p!.challenged && !p!.resolved) {
        out.push(`#${id} epoch ${epoch}: challenged, left for the owner to resolve`);
        continue;
      }
      if (now >= p!.finalisableAt) {
        await finaliseEpoch(adjudicator, id, epoch);
        out.push(`#${id} epoch ${epoch}: finalised`);
      }
    } catch (e) {
      out.push(`#${id}: failed: ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
    }
  }
  return out.join("; ") || "no epoch due";
}

/** Jobs whose next step is overdue by more than an epoch's grace, for /status. */
export async function overdueEpochs(): Promise<{ id: number; epoch: number; minutesLate: number }[]> {
  const count = Number((await read("mandateCount")) as bigint);
  const { challengeWindow } = await marketParameters();
  const now = Math.floor(Date.now() / 1000);
  const late: { id: number; epoch: number; minutesLate: number }[] = [];
  for (let id = EPOCHS_FROM; id < count; id++) {
    const m = (await read("getMandate", [BigInt(id)])) as unknown as MandateView;
    if (STATE[m.state] !== "Active" || m.epochsSettled >= m.epochsTotal) continue;
    const due = Number(m.lastSettledAt) + m.epochLength + Number(challengeWindow) + 20 * 60;
    if (now > due) late.push({ id, epoch: m.epochsSettled, minutesLate: Math.round((now - due) / 60) });
  }
  return late;
}
