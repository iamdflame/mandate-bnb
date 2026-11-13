/**
 * The judge path's health, for an uptime probe.
 *
 * 200 when the site's six beats pass, 503 otherwise, with every check in the
 * body. Our own upkeep (beats 7 and 8: gas for our agents, the trial pool that
 * pays for our tests) is reported as `upkeep` and does not decide the status:
 * it read the whole site as down while every hire was served (13 Nov). How
 * many agents can be hired in each job rides along too. Point a 15-minute
 * monitor here and at /judges; this one fails before the page does.
 */

import { NextResponse } from "next/server";
import { hireableByCategory, judgePathChecks, THIN_BELOW } from "@/lib/ops/status";
import { withTimeout } from "@/lib/cache";
import { live } from "@/lib/data/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  await live();
  const [checks, by] = await Promise.all([judgePathChecks(), withTimeout(hireableByCategory().catch(() => null), 8_000)]);
  const ok = checks.filter((c) => c.beat <= 6).every((c) => c.ok);
  const upkeep = checks.filter((c) => c.beat > 6).every((c) => c.ok);
  // Market depth rides along without deciding the status: a thin job is a market to grow, not a broken page.
  const depth = by ? Object.fromEntries(Object.entries(by).map(([c, names]) => [c, { hireable: names.length, thin: names.length < THIN_BELOW, agents: names }])) : null;
  return NextResponse.json(
    { ok, upkeep, at: new Date().toISOString(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, checks, depth },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
  );
}
