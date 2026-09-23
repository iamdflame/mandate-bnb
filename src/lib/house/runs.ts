/**
 * What each house agent decided, every time it looked.
 *
 * Most runs decide nothing: the loan is healthy, the range is earning, the
 * idle cash is already placed. Those runs are recorded too, because "checked
 * four minutes ago, nothing to do" is the evidence an agent is awake, and an
 * agent that only leaves a trace when it trades cannot be told apart from one
 * that stopped.
 *
 * Runs also carry state a later run needs: the position Range-1 is managing,
 * and how far a recenter got if one was cut off between its transactions.
 * Postgres holds it because the scheduled runs happen on a read-only
 * filesystem, where the scripts' old habit of writing `src/data/*.json`
 * would fail after the transaction had already landed.
 */

import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { withLease } from "@/lib/db/lease";

export type HouseSlug = "range-1" | "grid-1" | "yield-1" | "guard-1";
export type RunMode = "live" | "dry";
/**
 *   nothing    looked, and there was nothing to do
 *   acted      sent its transactions and they landed
 *   would-act  a dry run: this is what it would have sent
 *   partial    sent some steps of a multi-step action; the next run resumes
 *   skipped    could not look or act: paused, leash lapsed, a read failed
 *   failed     tried to act and a transaction did not land
 */
export type RunOutcome = "nothing" | "acted" | "would-act" | "partial" | "skipped" | "failed";

export interface HouseRun {
  id?: number;
  slug: HouseSlug;
  at: string;
  mode: RunMode;
  outcome: RunOutcome;
  /** One sentence: what it saw, and what it did about it. */
  reason: string;
  /** The readings the decision was made on. */
  readings: Record<string, unknown>;
  /** Transactions sent in this run, in order. */
  txs: { step: string; tx: string }[];
  /** What a later run needs to know. */
  state?: Record<string, unknown> | null;
}

/** JSON that survives bigints, which every chain reading is full of. */
export const toJson = (v: unknown): string => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));

interface Row {
  id: string | number;
  slug: HouseSlug;
  at: Date | string;
  mode: RunMode;
  outcome: RunOutcome;
  reason: string;
  readings: Record<string, unknown> | null;
  txs: { step: string; tx: string }[] | null;
  state: Record<string, unknown> | null;
}

const fromRow = (r: Row): HouseRun => ({
  id: Number(r.id),
  slug: r.slug,
  at: r.at instanceof Date ? r.at.toISOString() : new Date(r.at).toISOString(),
  mode: r.mode,
  outcome: r.outcome,
  reason: r.reason,
  readings: r.readings ?? {},
  txs: r.txs ?? [],
  state: r.state,
});

let prunedAt = 0;

export async function recordRun(run: Omit<HouseRun, "id" | "at">): Promise<void> {
  if (!pg || !(await ensureTables())) return;
  await pg`
    insert into house_runs (slug, mode, outcome, reason, readings, txs, state)
    values (${run.slug}, ${run.mode}, ${run.outcome}, ${run.reason}, ${toJson(run.readings)}::jsonb, ${toJson(run.txs)}::jsonb, ${run.state ? toJson(run.state) : null}::jsonb)
  `;
  // Quiet runs are only evidence of being awake; a month of them is enough. Actions are kept.
  if (Date.now() - prunedAt > 3_600_000) {
    prunedAt = Date.now();
    await pg`delete from house_runs where at < now() - interval '30 days' and outcome in ('nothing', 'skipped', 'would-act')`.catch(() => undefined);
  }
}

/** The newest runs for one agent, newest first. */
export async function runsOf(slug: HouseSlug, limit = 20): Promise<HouseRun[]> {
  if (!pg || !(await ensureTables())) return [];
  const rows = (await pg`select * from house_runs where slug = ${slug} order by at desc limit ${limit}`) as Row[];
  return rows.map(fromRow);
}

/** The newest run in which it sent something, live. */
export async function lastAction(slug: HouseSlug): Promise<HouseRun | null> {
  if (!pg || !(await ensureTables())) return null;
  const rows = (await pg`
    select * from house_runs where slug = ${slug} and mode = 'live' and outcome in ('acted', 'partial')
    order by at desc limit 1
  `) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

/** The newest run that carried state, for the agent that keeps some. */
export async function lastState(slug: HouseSlug): Promise<HouseRun | null> {
  if (!pg || !(await ensureTables())) return null;
  const rows = (await pg`select * from house_runs where slug = ${slug} and state is not null order by at desc limit 1`) as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

/** Live actions in a window, for daily caps the agent keeps under. */
export async function actionsSince(slug: HouseSlug, sinceMs: number): Promise<HouseRun[]> {
  if (!pg || !(await ensureTables())) return [];
  const since = new Date(Date.now() - sinceMs).toISOString();
  const rows = (await pg`
    select * from house_runs where slug = ${slug} and mode = 'live' and outcome in ('acted', 'partial') and at > ${since}
    order by at desc
  `) as Row[];
  return rows.map(fromRow);
}

/** For the desk and /status: each agent's newest run and newest live action. */
export async function houseActivity(): Promise<Record<string, { last: HouseRun | null; action: HouseRun | null }>> {
  const out: Record<string, { last: HouseRun | null; action: HouseRun | null }> = {};
  if (!pg || !(await ensureTables())) return out;
  const last = (await pg`select distinct on (slug) * from house_runs order by slug, at desc`) as Row[];
  const acted = (await pg`
    select distinct on (slug) * from house_runs where mode = 'live' and outcome in ('acted', 'partial')
    order by slug, at desc
  `) as Row[];
  for (const r of last) out[r.slug] = { last: fromRow(r), action: null };
  for (const r of acted) out[r.slug] = { last: out[r.slug]?.last ?? null, action: fromRow(r) };
  return out;
}

/** Live actions across every agent, newest first, for the market feed. */
export async function houseActions(limit = 40): Promise<HouseRun[]> {
  if (!pg || !(await ensureTables())) return [];
  const rows = (await pg`
    select * from house_runs where mode = 'live' and outcome in ('acted', 'partial')
    order by at desc limit ${limit}
  `) as Row[];
  return rows.map(fromRow);
}

/*
  One run per agent at a time. A pinger that retries, or an operator forcing a
  tick while one is running, must not send a recenter's withdrawal twice. The
  same lease row the census uses: an atomic upsert with an expiry, which a
  transaction-mode pooler cannot lose the way it loses an advisory lock.
*/
const LEASE_SECONDS = 90;

export function withAgentLease<T>(slug: HouseSlug, fn: () => Promise<T>): Promise<T | null> {
  return withLease(`house:${slug}`, LEASE_SECONDS, fn);
}
