/**
 * The judge path's health, for an uptime probe.
 *
 * 200 when all six beats' data reads pass, 503 otherwise, with each check in
 * the body, and how many agents can be hired in each job, which does not
 * decide the status. Point a 15-minute monitor here and at /judges; this one fails
 * before the page does.
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
  const ok = checks.every((c) => c.ok);
  // Market depth rides along without deciding the status: a thin job is a market to grow, not a broken page.
  const depth = by ? Object.fromEntries(Object.entries(by).map(([c, names]) => [c, { hireable: names.length, thin: names.length < THIN_BELOW, agents: names }])) : null;
  return NextResponse.json(
    { ok, at: new Date().toISOString(), commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, checks, depth },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
  );
}
