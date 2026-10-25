/**
 * Our readers against what agents on BNB Smart Chain actually send.
 *
 * The fixtures are real (src/scripts/build-corpus.ts writes them): cards in
 * every form the registries hold, each priced endpoint's 402 as it answered,
 * and signed escrow quotes from sellers on mainnet and testnet. Each carries
 * what our code read from it. A change that stops one real agent's card,
 * price or quote being read fails here, before it ships; the bugs of 25 Oct
 * (raw-JSON and gzip cards refused, a second payment token ignored, testnet
 * quotes checked against mainnet) each broke a form in this corpus.
 */

import { describe, expect, it } from "vitest";
import cards from "./fixtures/corpus/cards.json";
import payments from "./fixtures/corpus/payments.json";
import quotes from "./fixtures/corpus/quotes.json";
import { readCard, readServices } from "../sources/registry";
import { classify } from "../assay/classify";
import { readRequirements, whyUnpayable } from "../x402/pay";
import { checkSdkQuote, type SdkQuote } from "../escrow/sdk";
import { ESCROW, ESCROW_TESTNET } from "../escrow/contracts";

type Card = { chain: number; tokenId: string; form: string; uri: string | null; card: Record<string, unknown> | null; expect: { read: boolean; error: string | null; name: string | null; services: { name: string; endpoint: string }[]; category: string | null } };
type Payment = { tokenId: string; body: string; paymentRequired: string | null; expect: { asset: string; amount: string; method: string | null; unpayable: string | null }[] };
type Quote = { chain: 56 | 97; tokenId: string; sdk: SdkQuote; signers: string[]; expect: { provider: string; price: string } | { refused: string } };

const parse = (t: string): unknown => {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};

describe("registration cards, in every form the registries hold", () => {
  const all = cards as Card[];

  it("covers the forms registrants write", () => {
    const forms = new Set(all.map((c) => c.form));
    for (const f of ["data-base64", "data-plain", "data-gzip", "raw-json", "ipfs", "https", "empty"]) expect(forms, f).toContain(f);
  });

  it.each(all.filter((c) => c.uri !== null).map((c) => [`${c.chain}:${c.tokenId} (${c.form})`, c] as const))("reads the inline card %s as before", async (_, c) => {
    const r = await readCard(c.uri!);
    expect(r.card !== null).toBe(c.expect.read);
    if (c.expect.read) {
      expect(typeof r.card?.name === "string" ? r.card.name : null).toBe(c.expect.name);
      expect(readServices(r.card)).toEqual(c.expect.services);
    }
  });

  it.each(all.filter((c) => c.card !== null).map((c) => [`${c.chain}:${c.tokenId} (${c.form})`, c] as const))("files the served card %s as before", (_, c) => {
    const services = readServices(c.card);
    expect(services).toEqual(c.expect.services);
    const name = typeof c.card?.name === "string" ? c.card.name : null;
    const description = typeof c.card?.description === "string" ? c.card.description : null;
    expect(classify({ name, description, skills: services.map((s) => s.name) }).category).toBe(c.expect.category);
  });
});

describe("402 answers from every priced endpoint", () => {
  const all = payments as Payment[];

  it("still finds a price we can pay at nearly every one", () => {
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter((p) => p.expect.some((o) => o.unpayable === null)).length / all.length).toBeGreaterThan(0.85);
  });

  it.each(all.map((p) => [p.tokenId, p] as const))("reads #%s's offers as before", (_, p) => {
    const offers = readRequirements(parse(p.body), p.paymentRequired);
    expect(offers.map((o) => ({ asset: o.asset.toLowerCase(), amount: o.amount.toString(), method: o.method ?? null, unpayable: whyUnpayable(o) }))).toEqual(p.expect);
  });
});

describe("signed escrow quotes from sellers on mainnet and testnet", () => {
  const all = quotes as unknown as Quote[];

  it("includes both networks", () => {
    expect(new Set(all.map((q) => q.chain))).toEqual(new Set([56, 97]));
  });

  it.each(all.map((q) => [`${q.chain}:${q.tokenId}`, q] as const))("checks %s's quote as before, against its own network's kernel and token", async (_, q) => {
    const kernel = q.chain === 97 ? ESCROW_TESTNET : ESCROW;
    const now = Number(q.sdk.negotiated_at ?? q.sdk.response.negotiated_at ?? Math.floor(Date.now() / 1000)) + 1;
    const r = await checkSdkQuote(q.sdk, { chainId: q.chain, commerce: kernel.commerce, token: kernel.paymentToken, signers: q.signers, now });
    if ("provider" in q.expect) {
      expect(r).toHaveProperty("ok");
      if ("ok" in r) expect({ provider: r.ok.provider, price: r.ok.price.toString() }).toEqual(q.expect);
    } else expect(r).toEqual({ refused: q.expect.refused });
  });
});
