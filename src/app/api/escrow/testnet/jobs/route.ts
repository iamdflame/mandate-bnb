/**
 * A testnet job a buyer just funded to one of our agents, told to us so the
 * agent delivers now rather than on the next five-minute pass of the chain.
 *
 *   POST /api/escrow/testnet/jobs {"jobId": "123"}
 *   POST /api/escrow/testnet/jobs {"jobId": "123", "tokenId": "2554"}   another builder's agent
 *
 * The job is read from the testnet kernel and taken on only with the checks
 * the watcher makes (ours, funded, bound to the dispute policy, at our price
 * in test $U), so nothing the caller says is trusted.
 */

import { after, NextResponse } from "next/server";
import { take, callerOf } from "@/lib/api/ratelimit";
import { deliverTestnet, recordTestnetFound, testnetJobRow } from "@/lib/escrow/testnet-jobs";
import { recordTestnetOutside, testnetOutsideRow } from "@/lib/testnet/outside-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!take(`testnet-record:${callerOf(request)}`, { capacity: 20, windowMs: 60_000 }).ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let jobId = "";
  let tokenId = "";
  try {
    const body = (await request.json()) as { jobId?: unknown; tokenId?: unknown };
    jobId = String(body.jobId ?? "");
    tokenId = String(body.tokenId ?? "");
  } catch {
    /* answered below */
  }
  if (!/^\d{1,12}$/.test(jobId)) return NextResponse.json({ error: "Send {\"jobId\": \"…\"}, the testnet kernel's job number." }, { status: 400 });
  // Another builder's agent, named by its testnet id: checked against its signed quote; it delivers its own work.
  if (/^\d{1,12}$/.test(tokenId)) {
    const o = await recordTestnetOutside(BigInt(jobId), tokenId).catch((e: Error) => `failed: ${e.message.split("\n")[0].slice(0, 160)}`);
    if (o !== "recorded" && o !== "already recorded" && o !== "not another builder's agent on our testnet list") {
      return NextResponse.json({ error: `Not taken on: ${o}.` }, { status: /failed|open/.test(o) ? 503 : 409 });
    }
    if (o !== "not another builder's agent on our testnet list") {
      const row = await testnetOutsideRow(jobId);
      return NextResponse.json({ ok: true, data: row ? { jobId: row.jobId, status: row.status, tokenId: row.tokenId, outside: true } : null });
    }
  }
  const r = await recordTestnetFound(BigInt(jobId), null).catch((e: Error) => `failed: ${e.message.split("\n")[0].slice(0, 160)}`);
  if (r !== "recorded" && r !== "already recorded") {
    // A node a block behind the wallet's reads a just-funded job as open: the caller retries.
    return NextResponse.json({ error: `Not taken on: ${r}.` }, { status: /failed|open/.test(r) ? 503 : 409 });
  }
  after(() => deliverTestnet(jobId).catch(() => undefined));
  const row = await testnetJobRow(jobId);
  return NextResponse.json({ ok: true, data: row ? { jobId: row.jobId, status: row.status, slug: row.slug, tokenId: row.tokenId } : null });
}
