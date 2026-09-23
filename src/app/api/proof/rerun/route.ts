import { NextResponse } from "next/server";
import { take, callerOf, limitHeaders } from "@/lib/api/ratelimit";
import { rerunChecks } from "@/lib/advantage/rerun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Three of the six tasks, re-run against the head block for anyone who presses the button on /proof. */
export async function GET(req: Request) {
  const who = callerOf(req);
  // Reads on our own providers: cheap, not free. Six a minute is more than a person pressing a button will use.
  const gate = take(`proof:${who}`, { capacity: 6, windowMs: 60_000 });
  if (!gate.ok) {
    return NextResponse.json({ error: `Six re-runs a minute. Try again in ${gate.retryAfter} seconds.` }, { status: 429, headers: limitHeaders(gate) });
  }
  return NextResponse.json(await rerunChecks(), { headers: { "cache-control": "no-store" } });
}
