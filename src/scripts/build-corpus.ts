/**
 * The real-world corpus our readers are tested against: what agents on BNB
 * Smart Chain actually send, saved with what our code read from each.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/build-corpus.ts
 *
 * Writes src/lib/__tests__/fixtures/corpus/{cards,payments,quotes}.json:
 * - cards: registration cards in every form the registries hold (base64,
 *   plain and gzip data URIs, JSON written straight into the tokenURI,
 *   ipfs://, bare CIDs, https), with the name, services and job we read;
 * - payments: each priced endpoint's 402 as it answers now, body and
 *   payment-required header, with the offers we read;
 * - quotes: signed escrow quotes from sellers on mainnet and testnet, with the
 *   provider our check accepts.
 *
 * Run it again when the market changes; the tests then hold the readers to
 * every form seen, so a change that breaks one real agent fails before it ships.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAbi, type Address } from "viem";
import { sql as pg } from "@/lib/db/client";
import { marketClient } from "@/lib/chain/market";
import { testnetPublic } from "@/lib/chain/testnet";
import { IDENTITY_REGISTRY } from "@/lib/config";
import { ESCROW, ESCROW_TESTNET } from "@/lib/escrow/contracts";
import { readCard, readServices } from "@/lib/sources/registry";
import { classify } from "@/lib/assay/classify";
import { warm } from "@/lib/data/snapshots";
import { escrowQuoteMap, getProbes } from "@/lib/data/probes";
import { safeFetch } from "@/lib/net/safe-fetch";
import { readRequirements, whyUnpayable } from "@/lib/x402/pay";
import { negotiateFull } from "@/lib/escrow/a2a";
import { checkSdkQuote } from "@/lib/escrow/sdk";
import { quoteSigners } from "@/lib/escrow/signers";
import { readRegistryEntry } from "@/lib/sources/registry";
import { attributed, taskFor } from "@/lib/escrow/task";
import { DEMO_ADDRESS } from "@/lib/demo";
import { testnetListings } from "@/lib/testnet/sellers";
import { withTimeout } from "@/lib/cache";
import { findAgent } from "@/lib/data/agents";
import { poolNow } from "@/lib/house/services";
import { warmRegistry } from "@/lib/registry/tail";

const OUT = join(process.cwd(), "src/lib/__tests__/fixtures/corpus");
const ABI = parseAbi(["function tokenURI(uint256) view returns (string)"]);
const PER_FORM = 12;
const INLINE_MAX = 24_000;

/** The form a tokenURI is written in. Pure; the test uses it too. */
export function formOf(uri: string): string {
  if (!uri.trim()) return "empty";
  if (uri.startsWith("data:")) {
    const meta = uri.slice(5, uri.indexOf(","));
    return /gzip/.test(meta) ? "data-gzip" : meta.includes("base64") ? "data-base64" : "data-plain";
  }
  if (/^\s*\{/.test(uri)) return "raw-json";
  if (uri.startsWith("ipfs://")) return "ipfs";
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{50,})/.test(uri.trim())) return "bare-cid";
  if (uri.startsWith("ar://")) return "arweave";
  if (/^https:/i.test(uri)) return "https";
  if (/^http:/i.test(uri)) return "http";
  return "other";
}

async function uris(chain: 56 | 97, ids: string[]): Promise<Map<string, string>> {
  const c = chain === 97 ? testnetPublic() : marketClient;
  const address = (chain === 97 ? ESCROW_TESTNET.identity : IDENTITY_REGISTRY) as Address;
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 150) {
    const part = ids.slice(i, i + 150);
    const r = await c.multicall({ contracts: part.map((id) => ({ address, abi: ABI, functionName: "tokenURI", args: [BigInt(id)] })), allowFailure: true });
    r.forEach((x, k) => out.set(part[k]!, String(x.result ?? "")));
  }
  return out;
}

async function cards() {
  // Agents filed under a job first (what buyers see), then a random spread, then the forms found unread on 25 Oct.
  const filed = (await pg!`select token_id from registry_agents where category is not null order by random() limit 300`) as { token_id: string }[];
  const spread = (await pg!`select token_id from registry_agents order by random() limit 500`) as { token_id: string }[];
  const mainnetIds = [...new Set([...filed, ...spread].map((r) => r.token_id).concat(["363253", "363254", "359456", "345230", "1000"]))];
  const testnetIds = testnetListings().map((s) => s.tokenId);
  const all = [...[...(await uris(56, mainnetIds)).entries()].map(([id, uri]) => ({ chain: 56, id, uri })), ...[...(await uris(97, testnetIds)).entries()].map(([id, uri]) => ({ chain: 97, id, uri }))];
  const byForm = new Map<string, typeof all>();
  for (const x of all) {
    const f = formOf(x.uri);
    const list = byForm.get(f) ?? [];
    if (list.length < PER_FORM) list.push(x);
    byForm.set(f, list);
  }
  const out: unknown[] = [];
  for (const [form, list] of byForm) {
    for (const x of list) {
      const inline = form.startsWith("data") || form === "raw-json" || form === "empty" || form === "other";
      if (inline && x.uri.length > INLINE_MAX) continue;
      const r = await withTimeout(readCard(x.uri), 15_000);
      if (!r) continue;
      const services = readServices(r.card);
      const name = typeof r.card?.name === "string" ? r.card.name : null;
      const description = typeof r.card?.description === "string" ? r.card.description : null;
      out.push({
        chain: x.chain,
        tokenId: x.id,
        form,
        // Inline cards are kept as written; a card behind a URL is kept as it was served, since a test cannot fetch.
        uri: inline ? x.uri : null,
        card: inline ? null : r.card,
        expect: { read: r.card !== null, error: r.error, name, services, category: classify({ name, description, skills: services.map((s) => s.name) }).category },
      });
    }
  }
  return out;
}

async function payments() {
  await warm(["probe"]);
  const quotes = getProbes().quotes;
  const out: unknown[] = [];
  for (const [tokenId, q] of Object.entries(quotes ?? {}).slice(0, 80)) {
    const res = await safeFetch(q.endpoint, { timeoutMs: 8_000, maxBytes: 32 * 1024, headers: { accept: "application/json" } }).catch(() => null);
    if (!res || res.status !== 402) continue;
    const header = res.headers.get("payment-required");
    const offers = readRequirements((() => {
      try {
        return JSON.parse(res.text);
      } catch {
        return res.text;
      }
    })(), header);
    out.push({
      tokenId,
      endpoint: q.endpoint.replace(/[?#].*$/, ""),
      body: res.text,
      paymentRequired: header,
      expect: offers.map((o) => ({ asset: o.asset.toLowerCase(), amount: o.amount.toString(), method: o.method ?? null, unpayable: whyUnpayable(o) })),
    });
  }
  return out;
}

async function sdkQuotes() {
  await Promise.all([warm(["probe", "escrow-quotes", "testnet-sellers"]), warmRegistry()]);
  const sellers = [
    ...Object.entries(escrowQuoteMap())
      .filter(([, q]) => q.kind === "sdk" && !q.unpayable)
      .slice(0, 25)
      .map(([tokenId, q]) => ({ chain: 56 as const, tokenId, a2a: q.a2a, skill: q.skill, notify: q.notify, task: q.task ?? null, job: findAgent(tokenId)?.category ?? null, name: findAgent(tokenId)?.name ?? `Agent ${tokenId}` })),
    ...testnetListings()
      .filter((s) => s.hireable)
      .map((s) => ({ chain: 97 as const, tokenId: s.tokenId, a2a: s.a2a, skill: s.skill, notify: s.notify, task: s.quote?.task ?? null, job: s.category, name: s.name })),
  ];
  const bnbUsd = await poolNow().then((p) => p.usdtPerBnb, () => null);
  const out: unknown[] = [];
  for (const s of sellers) {
    const kernel = s.chain === 97 ? ESCROW_TESTNET : ESCROW;
    // Asked as the product asks: the card's own example, or our task for the agent's job (a grid inside a band around BNB's price).
    const ask = s.task ? attributed(s.task) : taskFor(s.job, s.name, { wallet: DEMO_ADDRESS }, { bnbUsd });
    const live = await withTimeout(negotiateFull(s.a2a, ask, { signers: [], skill: s.skill, notify: s.notify, chainId: s.chain }).catch(() => null), 25_000);
    if (!live?.sdk) continue;
    const entry = await readRegistryEntry(s.tokenId, s.chain).catch(() => null);
    const signers = await quoteSigners(s.tokenId, entry, s.chain).catch(() => null);
    if (!signers) continue;
    const checked = await checkSdkQuote(live.sdk, { chainId: s.chain, commerce: kernel.commerce, token: kernel.paymentToken, signers });
    out.push({ chain: s.chain, tokenId: s.tokenId, sdk: live.sdk, signers, expect: "ok" in checked ? { provider: checked.ok.provider, price: checked.ok.price.toString() } : { refused: checked.refused } });
  }
  return out;
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const [c, p, q] = [await cards(), await payments(), await sdkQuotes()];
  writeFileSync(join(OUT, "cards.json"), JSON.stringify(c, null, 1));
  writeFileSync(join(OUT, "payments.json"), JSON.stringify(p, null, 1));
  writeFileSync(join(OUT, "quotes.json"), JSON.stringify(q, null, 1));
  const forms = [...new Set((c as { form: string }[]).map((x) => x.form))];
  console.log(`cards: ${c.length} in forms ${forms.join(", ")}; payments: ${p.length}; quotes: ${q.length}`);
  process.exit(0);
})();
