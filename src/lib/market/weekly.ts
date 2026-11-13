/**
 * Outside buyers' escrowed jobs, week by week: the figure an adopter can
 * report. A job counts only when a wallet we do not operate paid for it; our
 * own tests are counted beside it, never in it.
 */

import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { isTeam } from "@/lib/team";

export interface WeekRow {
  /** The Monday the week starts on, UTC, as YYYY-MM-DD. */
  week: string;
  jobs: number;
  delivered: number;
  buyers: number;
  /** Jobs from wallets we operate in the same week, shown for scale and counted nowhere. */
  ours: number;
}

export interface JobRow {
  client: string;
  status: string;
  at: string | Date;
}

const DELIVERED = new Set(["SUBMITTED", "COMPLETED"]);

/** The Monday of a date's week, UTC. */
export function weekOf(at: string | Date): string {
  const d = new Date(at);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
  return monday.toISOString().slice(0, 10);
}

/** Pure, for tests: rows grouped by week, newest first, team wallets apart. */
export function byWeek(rows: JobRow[], team: (wallet: string) => boolean = isTeam): WeekRow[] {
  const weeks = new Map<string, { jobs: number; delivered: number; buyers: Set<string>; ours: number }>();
  for (const r of rows) {
    if (r.status === "OPEN") continue;
    const k = weekOf(r.at);
    const w = weeks.get(k) ?? { jobs: 0, delivered: 0, buyers: new Set<string>(), ours: 0 };
    if (team(r.client)) w.ours += 1;
    else {
      w.jobs += 1;
      if (DELIVERED.has(r.status)) w.delivered += 1;
      w.buyers.add(r.client.toLowerCase());
    }
    weeks.set(k, w);
  }
  return [...weeks.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([week, w]) => ({ week, jobs: w.jobs, delivered: w.delivered, buyers: w.buyers.size, ours: w.ours }));
}

/** Throws when the books cannot be read: an unread week is not an empty week. */
export async function outsideByWeek(): Promise<{ mainnet: WeekRow[]; testnet: WeekRow[] }> {
  if (!pg) throw new Error("no database on this deployment");
  await ensureTables();
  const [main, house, outside] = await Promise.all([
    pg`select client, status, created_at as at from escrow_jobs`,
    pg`select client, status, created_at as at from testnet_escrow_jobs`,
    pg`select client, status, created_at as at from testnet_outside_jobs`,
  ]);
  return { mainnet: byWeek(main as unknown as JobRow[]), testnet: byWeek([...(house as unknown as JobRow[]), ...(outside as unknown as JobRow[])]) };
}
