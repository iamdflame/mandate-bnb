/**
 * The clock this deployment does not have.
 *
 * Vercel's hobby plan runs one cron a day, GitHub Actions is billing-locked,
 * and the probe has to be at most fifteen minutes old for anything on the site
 * to claim liveness. So the schedule lives here instead of in a platform: one
 * authorised endpoint (`/api/cron/tick`) is called every few minutes from
 * outside, and this decides which jobs are actually due.
 *
 * Every job records when it last ran and what it said, so `/status` can show
 * the clock rather than assert it, and a job that starts failing is visible as
 * a widening gap rather than as silence.
 */

import { lastRuns, note, recordStatus } from "@/lib/ops/history";
import { refreshIfStale } from "@/lib/census/refresh";
import { readGridWindow } from "@/lib/grid/window";
import { judgePathChecks } from "@/lib/ops/status";
import { definitionOfDone, score } from "@/lib/ops/definition-of-done";
import { store } from "@/lib/data/snapshots";
import { beat } from "@/lib/heartbeat";
import { sweepOurJobs, sweeperOn } from "@/lib/market/sweeper";
import { renewHouseSessions } from "@/lib/chain/house";
import { runHouse, HOUSE_CADENCE_MIN } from "@/lib/house/run";
import { continuePoolGap } from "@/lib/pancake/pool-gap";

export interface Job {
  name: string;
  everyMinutes: number;
  budgetMs: number;
  run: () => Promise<unknown>;
  /**
   * Runs after the tick has answered, on its own budget. For long reads that
   * would otherwise eat the pinger's thirty seconds and starve every job
   * behind them: the function lives on for its full duration after the reply.
   */
  afterResponse?: boolean;
}

/*
  Order is priority. A pinger gives one call a fixed number of seconds, so the
  tick runs what fits and leaves the rest for the next call rather than being
  cut off mid-job: the cheap sample that keeps the history dense goes first,
  the long reads after it.
*/
export const JOBS: Job[] = [
  /*
    The house agents come first. A turn that finds nothing to do costs a few
    reads; one that acts is the reason the clock exists, and must not be the
    job deferred for lack of time. Range-1 starts no transaction more than
    eight seconds into its turn and resumes on the next one.
  */
  { name: "guard-1", everyMinutes: HOUSE_CADENCE_MIN["guard-1"], budgetMs: 15_000, run: () => runHouse("guard-1") },
  { name: "range-1", everyMinutes: HOUSE_CADENCE_MIN["range-1"], budgetMs: 20_000, run: () => runHouse("range-1") },
  {
    // Six beats and one row in the history. Cheap, so it runs on every tick.
    name: "status",
    everyMinutes: 5,
    budgetMs: 14_000,
    run: async () => {
      const checks = await judgePathChecks();
      const samples = await recordStatus(checks);
      return { ok: checks.every((c) => c.ok), beats: checks.length, samples };
    },
  },
  {
    // The answering set, so no page ever claims a liveness older than this.
    name: "probe",
    everyMinutes: 10,
    budgetMs: 16_000,
    run: () => refreshIfStale({ limit: 40, budgetMs: 14_000, force: true }),
  },
  {
    name: "grid-window",
    everyMinutes: 30,
    budgetMs: 10_000,
    run: async () => {
      const w = await readGridWindow({ fresh: true });
      return { fills: w.fills.length, toBlock: w.toBlock };
    },
  },
  {
    /*
      The definition asks the ladder, the chain and the database, so it is its
      own job rather than a tail on the status sample: it took thirteen seconds
      and pushed a whole tick past the pinger's thirty-second limit.
    */
    name: "definition",
    everyMinutes: 15,
    budgetMs: 22_000,
    run: async () => {
      const boxes = await definitionOfDone();
      if (boxes.length) await store("definition", boxes);
      return score(boxes);
    },
  },
  {
    /*
      Escrowed jobs mature on their own day: a provider that delivered is paid
      only when somebody settles after the dispute window, and one that never
      delivered holds the escrow until the refund is claimed. Neither should
      wait for an operator to be awake.
    */
    name: "sweeper",
    everyMinutes: 30,
    budgetMs: 20_000,
    run: async () => {
      const dry = !sweeperOn();
      const r = await sweepOurJobs({ max: 2, dry });
      return { dry, checked: r.checked, actions: r.actions };
    },
  },
  { name: "yield-1", everyMinutes: HOUSE_CADENCE_MIN["yield-1"], budgetMs: 15_000, run: () => runHouse("yield-1") },
  {
    /*
      A session expires, and nothing used to notice. Guard-1, Yield-1 and
      Grid-1 all lapsed on 12 September; they were still listed, still had
      their keys, and could not act on anything for six days. This renews a
      leash while it still has three days left, so the agents never go quiet
      waiting for an operator to remember. Nothing is due on most runs, and a
      run that is due costs one registration each.
    */
    name: "leases",
    everyMinutes: 6 * 60,
    budgetMs: 20_000,
    run: async () => {
      /*
        Off unless switched on. A renewal is a registration transaction paid
        for out of the operator's own balance, and a job that spends money on
        a clock should be something the operator turned on deliberately, not
        something that starts the moment it is deployed. With it off this
        reports what is lapsing so `/status` can still say so.
      */
      if (process.env.LEASE_RENEWAL !== "on") {
        const due = await renewHouseSessions({ withinDays: 3, max: 0 });
        return {
          off: "LEASE_RENEWAL is not on, so nothing was granted",
          lapsing: due.filter((x) => x.was !== "live" && !x.skipped).map((x) => `${x.slug} ${x.was}`),
          paused: due.filter((x) => x.skipped === "paused").map((x) => x.slug),
        };
      }
      const r = await renewHouseSessions({ days: 21, withinDays: 3, max: 2 });
      const did = r.filter((x) => x.renewed);
      return {
        renewed: did.map((x) => x.slug),
        failed: r.filter((x) => x.error).map((x) => `${x.slug}: ${x.error}`),
        live: r.filter((x) => x.was === "live" && !x.skipped).length,
        paused: r.filter((x) => x.skipped === "paused").map((x) => x.slug),
      };
    },
  },
  {
    name: "heartbeat",
    everyMinutes: 15,
    budgetMs: 5_000,
    run: async () => {
      await beat("cron", 1, { by: "tick" });
      return { wrote: "cron" };
    },
  },
  /*
    PancakeSwap's pool gaps. A new window starts every twelve hours; reading
    one takes many slices, since a thousand blocks of V3 swaps is 24 MB, so the
    job looks in on every tick, reads what fits, and publishes when done.
  */
  {
    name: "pool-gap",
    everyMinutes: 5,
    // The tick takes at most 22 of the function's 60 seconds; this takes at most 36 of the rest.
    budgetMs: 36_000,
    afterResponse: true,
    run: () => continuePoolGap({ budgetMs: 34_000 }),
  },
];

export interface Ran {
  job: string;
  ok: boolean;
  ms: number;
  detail: unknown;
  skipped?: string;
}

/** When each job last ran, for the page that shows the clock. */
export async function scheduleState(): Promise<{ name: string; everyMinutes: number; lastRunAt: string | null; ok: boolean | null; overdue: boolean }[]> {
  const last = await lastRuns();
  return JOBS.map((j) => {
    const l = last.get(j.name);
    const at = l?.at ? new Date(l.at) : null;
    return {
      name: j.name,
      everyMinutes: j.everyMinutes,
      lastRunAt: at?.toISOString() ?? null,
      ok: l?.ok ?? null,
      // Twice the interval: one missed tick is a hiccup, two is a stopped clock.
      overdue: !at || Date.now() - at.getTime() > j.everyMinutes * 60_000 * 2,
    };
  });
}

/**
 * Runs the jobs that are due and fit.
 *
 * `maxMs` is the caller's patience, not ours: cron-job.org cuts a request off
 * at thirty seconds and counts it as a failure, so the tick stops starting new
 * jobs near its budget and leaves them for the next call five minutes later.
 * `only` and `force` are for the operator.
 */
export async function tick(opts: { only?: string[]; force?: boolean; maxMs?: number } = {}): Promise<Ran[]> {
  const began = Date.now();
  const maxMs = opts.maxMs ?? 22_000;
  const last = await lastRuns();
  const out: Ran[] = [];
  for (const job of JOBS) {
    if (opts.only?.length && !opts.only.includes(job.name)) continue;
    if (job.afterResponse && !opts.only?.length) {
      out.push({ job: job.name, ok: true, ms: 0, detail: null, skipped: "runs after the response" });
      continue;
    }
    const spent = Date.now() - began;
    if (!opts.only?.length && spent + 2_000 > maxMs) {
      out.push({ job: job.name, ok: true, ms: 0, detail: null, skipped: `deferred: ${Math.round(spent / 1000)}s of the ${Math.round(maxMs / 1000)}s budget already spent` });
      continue;
    }
    const at = last.get(job.name)?.at;
    const due = opts.force || !at || Date.now() - new Date(at).getTime() >= job.everyMinutes * 60_000;
    if (!due) {
      const minutes = Math.ceil((job.everyMinutes * 60_000 - (Date.now() - new Date(at!).getTime())) / 60_000);
      out.push({ job: job.name, ok: true, ms: 0, detail: null, skipped: `not due for ${minutes} more minutes` });
      continue;
    }
    const started = Date.now();
    try {
      const detail = await Promise.race([
        job.run(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`over budget after ${job.budgetMs} ms`)), job.budgetMs)),
      ]);
      await note(job.name, true, detail);
      out.push({ job: job.name, ok: true, ms: Date.now() - started, detail });
    } catch (e) {
      const detail = (e as Error).message.slice(0, 200);
      await note(job.name, false, detail);
      out.push({ job: job.name, ok: false, ms: Date.now() - started, detail });
    }
  }
  return out;
}

/**
 * The jobs that run after the tick has answered, each if due, one after another.
 * Called from the tick route inside `after()`, so the pinger never waits on them.
 */
export async function tickAfter(): Promise<Ran[]> {
  const last = await lastRuns();
  const out: Ran[] = [];
  for (const job of JOBS.filter((j) => j.afterResponse)) {
    const at = last.get(job.name)?.at;
    if (at && Date.now() - new Date(at).getTime() < job.everyMinutes * 60_000) continue;
    const started = Date.now();
    try {
      const detail = await Promise.race([
        job.run(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`over budget after ${job.budgetMs} ms`)), job.budgetMs)),
      ]);
      await note(job.name, true, detail);
      out.push({ job: job.name, ok: true, ms: Date.now() - started, detail });
    } catch (e) {
      const detail = (e as Error).message.slice(0, 200);
      await note(job.name, false, detail);
      out.push({ job: job.name, ok: false, ms: Date.now() - started, detail });
    }
  }
  return out;
}
