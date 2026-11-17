/**
 * What running Mandate costs on chain, measured from our own receipts: the
 * gas of the last buyers' jobs, by who paid it. A receipt that could not be
 * read is left out and the count says so; nothing here is typed in.
 */

import type { Hash } from "viem";
import { marketClient } from "@/lib/chain/market";
import { recentJobs } from "@/lib/escrow/jobs";
import { isTeam } from "@/lib/team";

export interface GasLine {
  /** What the transaction is, in a buyer's words. */
  what: string;
  who: string;
  /** Median gas used and its fee in BNB, over `n` receipts read. */
  gas: number | null;
  bnb: number | null;
  n: number;
}

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);

export async function gasPerJob(sample = 8): Promise<GasLine[]> {
  const jobs = (await recentJobs(120)).filter((j) => !isTeam(j.client) && j.status === "COMPLETED").slice(0, sample);
  const read = async (txs: (string | null)[]) => {
    const rs = await Promise.all(txs.filter((t): t is string => Boolean(t)).map((t) => marketClient.getTransactionReceipt({ hash: t as Hash }).catch(() => null)));
    const ok = rs.filter((r): r is NonNullable<typeof r> => Boolean(r));
    return { gas: median(ok.map((r) => Number(r.gasUsed))), bnb: median(ok.map((r) => Number(r.gasUsed * r.effectiveGasPrice) / 1e18)), n: ok.length };
  };
  const [fund, submit, settle] = await Promise.all([read(jobs.map((j) => j.fundedTx)), read(jobs.map((j) => j.submitTx)), read(jobs.map((j) => j.settleTx))]);
  return [
    { what: "Funding the job (the buyer's last transaction)", who: "The buyer", ...fund },
    { what: "Delivering the work on chain", who: "The agent", ...submit },
    { what: "Settling it after the dispute window", who: "Our keeper, or anyone", ...settle },
  ];
}

/**
 * Off-chain running costs. Each is a dated reading from the provider's own
 * bill, or `null` where we have not read one: an unread cost is said, never guessed.
 */
export const RUNNING: { item: string; cost: string | null; read: string; note: string }[] = [
  { item: "Hosting and functions (Vercel)", cost: "$111.49 over 48 days", read: "1 Sep to 18 Oct 2026, from Vercel's billing API", note: "About $2.30 a day, most of it crawlers on one page, since blocked. Not re-read since." },
  { item: "Database (Postgres)", cost: null, read: "not read", note: "One pooled database: sessions, snapshots, job books, schedules." },
  { item: "Domain", cost: null, read: "not read", note: "mandatemarkets.com, registered 25 Sep 2026." },
  { item: "Archive node (thirdweb)", cost: "$0", read: "free plan, 13 Nov 2026", note: "Burst of about 60 reads, then 5 a second. Used only for a wallet's past transaction counts on /check." },
  { item: "Everyday chain reads", cost: "$0", read: "public BNB Chain endpoints", note: "Several providers, read in turn when one fails." },
];

/**
 * Load tests of the live site: virtual visitors reading public pages, each
 * stage a 20 s ramp and a 90 s hold. Run from one machine, so a stage the
 * machine's own connection could not carry is said, not published as ours.
 */
export const CAPACITY: { at: string; from: string; stages: { users: number; requests: number; perSecond: number; p95: number; errors: number; ours: boolean }[]; note: string }[] = [
  {
    at: "2026-11-17",
    from: "one machine on a 12 Mbit/s line",
    stages: [
      { users: 25, requests: 1645, perSecond: 18.3, p95: 850, errors: 0, ours: true },
      { users: 50, requests: 2711, perSecond: 30.1, p95: 1686, errors: 0, ours: false },
      { users: 100, requests: 2859, perSecond: 31.8, p95: 7036, errors: 0, ours: false },
    ],
    note: "Every one of 7,215 requests answered, none with an error. From 50 visitors the test machine's own line was full (about 30 pages a second), so those times measure the line, not the site. Agent pages were also built on every visit that day, a fault since fixed: they are cached again.",
  },
];

