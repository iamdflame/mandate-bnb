/**
 * The browser's way to a seller that does not speak to browsers.
 *
 *   POST /api/x402/relay { tokenId, subject?, paid?: { header, value } }
 *
 * A visitor's wallet can sign a payment, but the page cannot always deliver
 * it: Muster's server sends no CORS headers, so Chrome refuses to show the
 * page its 402, let alone its answer. This forwards the call server-side and
 * hands back the seller's status, the payment headers and the body.
 *
 * It is not a proxy. The destination is derived from the agent named, either
 * its sponsored call or the endpoint that quoted us in the census, so a
 * caller cannot aim it at anything else. The signed header it carries
 * authorises one transfer of one amount to the seller's own address, which is
 * exactly what forwarding it does.
 */

import { NextResponse } from "next/server";
import { exchange } from "@/lib/x402/pay";
import { SPONSORED } from "@/lib/market/sponsored-targets";
import { listingFor } from "@/lib/market/listing";
import { take, callerOf, limitHeaders } from "@/lib/api/ratelimit";
import { live } from "@/lib/data/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEPT = ["content-type", "payment-required", "payment-response", "x-payment-response", "www-authenticate"];

export async function POST(request: Request) {
  const limit = take(`relay:${callerOf(request)}`, { capacity: 12, windowMs: 60_000 });
  if (!limit.ok) return NextResponse.json({ error: "Too many calls in a minute." }, { status: 429, headers: limitHeaders(limit) });

  let tokenId = "";
  let subject: string | undefined;
  let paid: { header: string; value: string } | undefined;
  try {
    const b = (await request.json()) as { tokenId?: unknown; subject?: unknown; paid?: { header?: unknown; value?: unknown } };
    tokenId = String(b.tokenId ?? "");
    subject = typeof b.subject === "string" ? b.subject.trim().slice(0, 64) : undefined;
    if (b.paid && typeof b.paid.header === "string" && typeof b.paid.value === "string" && /^(X-PAYMENT|PAYMENT-SIGNATURE)$/i.test(b.paid.header)) {
      paid = { header: b.paid.header.toUpperCase(), value: b.paid.value.slice(0, 16_384) };
    }
  } catch {
    return NextResponse.json({ error: "Send a JSON body naming a tokenId." }, { status: 400 });
  }

  await live();
  const sponsored = SPONSORED[tokenId];
  const listing = listingFor(tokenId);
  const url = sponsored ? sponsored.url(subject) : listing?.quote?.endpoint;
  if (!url) return NextResponse.json({ error: "That agent has no endpoint we have a quote from." }, { status: 404 });
  const target = new URL(url);
  if (target.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(target.hostname)) {
    return NextResponse.json({ error: "That endpoint is not one this relay will call." }, { status: 400 });
  }

  const method = sponsored?.method ?? "GET";
  const body = sponsored?.body === undefined ? undefined : JSON.stringify(sponsored.body);
  const { ex } = await exchange(url, {
    method,
    headers: {
      accept: "application/json, text/event-stream",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(paid ? { [paid.header]: paid.value } : {}),
    },
    body,
    timeoutMs: 45_000,
  }).catch((e: Error) => ({ ex: null, error: e.message.split("\n")[0].slice(0, 160) }) as never);

  if (!ex) return NextResponse.json({ error: "The seller did not answer." }, { status: 502 });
  const headers: Record<string, string> = {};
  for (const k of KEPT) if (ex.response.headers[k]) headers[k] = ex.response.headers[k];
  return NextResponse.json(
    { url, status: ex.response.status, headers, body: ex.response.body, truncated: ex.response.truncated, ms: ex.response.ms },
    { headers: { "cache-control": "no-store" } },
  );
}
