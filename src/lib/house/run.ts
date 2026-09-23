/**
 * The house agents, running on the site's own clock.
 *
 * Range-1, Guard-1 and Yield-1 used to act only when somebody ran a script
 * on the operator's laptop. Now the scheduled tick (lib/ops/schedule) gives
 * each one a turn: look at the chain, decide, and act through its own leash.
 * The laptop is not in the loop.
 *
 * What a turn may do is bounded three times over, and none of it is new:
 * the session's allowlist and daily caps (enforced by the account), the
 * contracts it calls (RecipientBound and vUSDT can only pay the account),
 * and the agent's own rule (lib/house/range, lib/house/venus).
 *
 * Dry is the default. With HOUSE_AGENTS unset a turn decides and records
 * what it would have sent, and sends nothing; `HOUSE_AGENTS=live` lets it
 * send. Either way:
 *   - a paused agent does not run at all (lib/market/paused);
 *   - an agent whose leash has lapsed records that and stops. It never grants
 *     itself a session: renewal is the leases job's, gated by LEASE_RENEWAL;
 *   - one run per agent at a time, under a lease row;
 *   - three failed attempts in a row stop it for six hours, so a transaction
 *     that keeps failing is not paid for every quarter hour.
 */

import type { Address, Hex } from "viem";
import { marketClient } from "@/lib/chain/market";
import { houseSessionId } from "@/lib/chain/house";
import { getSession, providerFor } from "@/lib/chain/session";
import { recordExecution } from "@/lib/chain/session-store";
import { DEMO_ADDRESS } from "@/lib/demo";
import { pauseForSlug } from "@/lib/market/paused";
import { actionsSince, lastState, recordRun, runsOf, withAgentLease, type HouseRun, type HouseSlug, type RunMode, type RunOutcome } from "@/lib/house/runs";
import { rangeTurn } from "@/lib/house/range";
import { guardTurn, yieldTurn } from "@/lib/house/venus";
import type { Call, Sent, TurnContext, TurnResult } from "@/lib/house/types";

export const houseLive = (): boolean => process.env.HOUSE_AGENTS === "live";

/** How often each agent looks, in minutes. Guard-1 protects a loan, so it looks most often. */
export const HOUSE_CADENCE_MIN = { "guard-1": 10, "range-1": 15, "yield-1": 6 * 60 } as const;

/** No new transaction starts after this long into a turn; the next turn resumes. */
const STEP_WINDOW_MS = 8_000;
/** A session this close to expiry is treated as lapsed: a turn should not start what the leash cannot finish. */
const EXPIRY_MARGIN_MS = 5 * 60_000;
const FAILURE_STOP = 3;
const FAILURE_COOLDOWN_MS = 6 * 3_600_000;

export interface HouseDeps {
  session: (id: string) => Promise<{ expiry: number; revokedAt?: string | null } | null>;
  sender: (sessionId: string) => Promise<(call: Call, description: string) => Promise<Sent>>;
  record: (run: Omit<HouseRun, "id" | "at">) => Promise<void>;
  last: (slug: HouseSlug) => Promise<HouseRun | null>;
  today: (slug: HouseSlug) => Promise<HouseRun[]>;
  recent: (slug: HouseSlug) => Promise<HouseRun[]>;
  lease: <T>(slug: HouseSlug, fn: () => Promise<T>) => Promise<T | null>;
  turns: Partial<Record<HouseSlug, (ctx: TurnContext) => Promise<TurnResult>>>;
}

/** Sends through the agent's own session, waits for the receipt, and notes it on the session's record. */
async function sessionSender(sessionId: string): Promise<(call: Call, description: string) => Promise<Sent>> {
  const executor = (await providerFor(sessionId)).makeExecutor({ client: marketClient });
  return async (call, description) => {
    const r = (await executor.execute({ call, description } as never)) as {
      transactionHash: Hex;
      receipt?: { status: string; blockNumber: bigint; logs: { address: string; topics: Hex[]; data: Hex }[] };
    };
    const receipt = r.receipt ?? (await marketClient.waitForTransactionReceipt({ hash: r.transactionHash, timeout: 30_000 }));
    if (receipt.status !== "success") throw new Error(`${call.functionName} reverted: ${r.transactionHash}`);
    await recordExecution(sessionId, { tx: r.transactionHash, description, status: "confirmed" }).catch(() => undefined);
    return {
      hash: r.transactionHash,
      blockNumber: receipt.blockNumber,
      logs: receipt.logs.map((l) => ({ address: l.address, topics: [...l.topics] as Hex[], data: l.data })),
    };
  };
}

export const DEFAULT_DEPS: HouseDeps = {
  session: (id) => getSession(id),
  sender: sessionSender,
  record: recordRun,
  last: lastState,
  today: (slug) => actionsSince(slug, 24 * 3_600_000),
  recent: (slug) => runsOf(slug, FAILURE_STOP),
  lease: withAgentLease,
  turns: { "range-1": rangeTurn, "guard-1": guardTurn, "yield-1": yieldTurn },
};

export interface HouseTurn {
  slug: HouseSlug;
  mode: RunMode;
  outcome: RunOutcome;
  reason: string;
  txs: { step: string; tx: string }[];
}

export async function runHouse(slug: HouseSlug, opts: { live?: boolean; now?: number; deps?: Partial<HouseDeps> } = {}): Promise<HouseTurn> {
  const deps: HouseDeps = { ...DEFAULT_DEPS, ...opts.deps, turns: { ...DEFAULT_DEPS.turns, ...opts.deps?.turns } };
  const live = opts.live ?? houseLive();
  const mode: RunMode = live ? "live" : "dry";
  const now = opts.now ?? Date.now();
  const done = (outcome: RunOutcome, reason: string, txs: { step: string; tx: string }[] = []): HouseTurn => ({ slug, mode, outcome, reason, txs });

  const turn = deps.turns[slug];
  if (!turn) return done("skipped", `${slug} has no turn to run.`);
  const pause = pauseForSlug(slug);
  if (pause) return done("skipped", pause.reason);

  const ran = await deps.lease(slug, async (): Promise<HouseTurn> => {
    const write = async (row: TurnResult | Omit<TurnResult, "recorded">) => {
      const { recorded: _r, ...rest } = row as TurnResult;
      await deps.record({ slug, mode, ...rest });
    };

    const id = houseSessionId(slug);
    const session = await deps.session(id);
    const alive = session && !session.revokedAt && session.expiry * 1000 > now + EXPIRY_MARGIN_MS;
    if (!alive) {
      const reason = !session
        ? "It holds no session on the account, so it cannot act. Granting one is the operator's decision, not the agent's."
        : session.revokedAt
          ? "Its session was revoked, so it cannot act."
          : `Its leash ${session.expiry * 1000 > now ? "expires within minutes" : `lapsed on ${new Date(session.expiry * 1000).toISOString().slice(0, 10)}`}, so it cannot act. Renewal is the leases job's, not the agent's.`;
      await write({ outcome: "skipped", reason, readings: {}, txs: [] });
      return done("skipped", reason);
    }

    if (live) {
      const recent = await deps.recent(slug);
      const stuck = recent.length >= FAILURE_STOP && recent.slice(0, FAILURE_STOP).every((r) => r.outcome === "failed" && r.mode === "live");
      if (stuck && now - Date.parse(recent[0].at) < FAILURE_COOLDOWN_MS) {
        const reason = `Stopped after ${FAILURE_STOP} failed attempts in a row, so a failing transaction is not paid for every run. It tries again six hours after the last one: ${recent[0].reason}`;
        return done("skipped", reason);
      }
    }

    let sendFn: ((call: Call, description: string) => Promise<Sent>) | null = null;
    // Set by `send` as it goes; asserted so the checker does not narrow it to its first value.
    let stage = "reading" as "reading" | "signer" | "sending";
    const ctx: TurnContext = {
      account: DEMO_ADDRESS as Address,
      live,
      now,
      send: async (call, description) => {
        if (!live) throw new Error("a dry run sends nothing");
        stage = "signer";
        sendFn ??= await deps.sender(id);
        stage = "sending";
        return sendFn(call, description);
      },
      record: async (row) => write(row),
      last: await deps.last(slug),
      today: await deps.today(slug),
      stepDeadline: now + STEP_WINDOW_MS,
    };

    let result: TurnResult;
    try {
      result = await turn(ctx);
    } catch (e) {
      const why = (e as Error).message.split("\n")[0].slice(0, 220);
      // A read that failed is not a failed action, and must not count towards the stop.
      result =
        stage === "sending"
          ? { outcome: "failed", reason: `A transaction did not land: ${why}`, readings: {}, txs: [] }
          : stage === "signer"
            ? { outcome: "failed", reason: `Could not load its session signer, so nothing was sent: ${why}`, readings: {}, txs: [] }
            : { outcome: "skipped", reason: `Could not finish reading the chain: ${why}`, readings: {}, txs: [] };
    }
    if (!result.recorded) await write(result);
    return done(result.outcome, result.reason, result.txs);
  });

  return ran ?? done("skipped", "Another run of this agent is in progress.");
}
