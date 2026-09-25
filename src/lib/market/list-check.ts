/**
 * Everything /list reads about one token, read now.
 *
 * A seller who has just fixed their endpoint wants to see the fix, not last
 * night's census, so nothing here comes from a snapshot when it can be read
 * fresh: the identity and card from the registry, the endpoint through the
 * same guard every stranger's URL goes through, the price from its own 402,
 * and the assay against the chain. The stored assay is used only when a live
 * one cannot run, and the result says which it was.
 */

import { CHAIN_ID, type Category } from "@/lib/config";
import { withTimeout } from "@/lib/cache";
import { readRegistryEntry } from "@/lib/sources/registry";
import { endpointFor } from "@/lib/census/run";
import { probe, type ProbeResult } from "@/lib/probe";
import { readQuote, type Quote } from "@/lib/x402/quote";
import { assayAgent } from "@/lib/assay";
import { classify } from "@/lib/assay/classify";
import { assayFor } from "@/lib/market/assays";
import { findAgent } from "@/lib/data/agents";
import { indexToken } from "@/lib/registry/tail";
import { hireCounts } from "@/lib/market/hires";
import { hirePath } from "@/lib/market/hire-law";
import { livenessOf, priceLabelOf, settledFromRecord } from "@/lib/market/listing";
import { placeListing, type ListPlacement } from "@/lib/market/list-ladder";
import { marketClient } from "@/lib/chain/market";

export interface ListCheck {
  tokenId: string;
  at: string;
  /** In our index already, so it has a page on this site. */
  listed: boolean;
  /** The block the identity was read at. */
  blockNumber: string | null;
  name: string | null;
  owner: string | null;
  category: Category | null;
  endpoint: string | null;
  protocol: ProbeResult["protocol"] | null;
  tools: { name: string; description?: string }[];
  price: string | null;
  fineness: number | null;
  /** Whether the fineness came from an assay run just now, or the last stored one. */
  assay: "live" | "stored" | null;
  assayError: string | null;
  settled: number;
  placement: ListPlacement;
  /** What the hire law says about it, with the reason when it will not offer it. */
  hire: { ok: boolean; reason: string | null; short: string | null };
}

/** The chain could not be read, so a missing token cannot be told from an unreachable registry. */
export class ChainUnread extends Error {}

/**
 * `liveAssay: false` uses the stored assay instead of running one, for the
 * clock's own check that this path answers, which cannot spend fifteen
 * seconds on an assay every quarter of an hour.
 */
export async function checkListing(tokenId: string, opts: { liveAssay?: boolean } = {}): Promise<ListCheck> {
  const at = new Date().toISOString();
  const entry = await readRegistryEntry(tokenId).catch(() => null);

  if (!entry) {
    // `ownerOf` failing means either no such token or no chain. Ask the chain something it always answers.
    const block = await withTimeout(marketClient.getBlockNumber().catch(() => null), 6_000);
    if (!block) throw new ChainUnread("BNB Smart Chain did not answer just now, so we cannot tell whether this token exists. Try again in a minute.");
    const placement = placeListing({
      tokenId,
      registered: false,
      card: { resolved: false, name: null, description: null, error: null },
      endpoint: null,
      probe: null,
      quote: null,
      fineness: null,
      settled: 0,
    });
    return {
      tokenId,
      at,
      listed: false,
      blockNumber: block.toString(),
      name: null,
      owner: null,
      category: null,
      endpoint: null,
      protocol: null,
      tools: [],
      price: null,
      fineness: null,
      assay: null,
      assayError: null,
      settled: 0,
      placement,
      hire: { ok: false, reason: "It is not in the ERC-8004 registry.", short: "Not registered" },
    };
  }

  const endpoint = endpointFor(entry);
  // Checking a token lists it: it is indexed now and has a page here from this moment.
  const indexed = findAgent(tokenId) ?? (await indexToken(tokenId, "list").catch(() => null));

  const [reading, live, counts] = await Promise.all([
    probe(tokenId, endpoint),
    opts.liveAssay === false
      ? Promise.resolve({ report: null, error: "not run: the stored assay was asked for" as string | null })
      : withTimeout(
          assayAgent(CHAIN_ID, tokenId, undefined, { registryDeadlineMs: 12_000 }).then(
            (r) => ({ report: r, error: null as string | null }),
            (e: unknown) => ({ report: null, error: e instanceof Error ? e.message.slice(0, 200) : "the assay could not run" }),
          ),
          30_000,
        ),
    hireCounts().catch(() => null),
  ]);

  // A price is only read from an endpoint that answered with one.
  const quote: Quote | null = endpoint && reading.protocol === "x402" ? await readQuote(endpoint).catch(() => null) : null;

  const stored = assayFor(tokenId);
  const report = live?.report ?? stored;
  const assay = live?.report ? "live" : stored ? "stored" : null;
  const assayError = live?.report || (stored && opts.liveAssay === false) ? null : (live?.error ?? "the assay did not finish in 30 seconds");
  const settled = counts?.settled.get(tokenId) ?? settledFromRecord().get(tokenId) ?? 0;

  const category: Category | null =
    indexed?.category ?? (report?.category as Category | null | undefined) ?? classify({ name: entry.name, description: entry.description }).category;

  const listingProbe = {
    answered: reading.answered,
    status: reading.status,
    latencyMs: reading.latencyMs,
    endpoint: reading.endpoint,
    at: reading.at,
    protocol: reading.protocol ?? null,
    tools: reading.tools,
    refused: reading.refused,
    error: reading.error,
  };
  const verdict = hirePath({
    tokenId,
    owner: entry.owner,
    probe: listingProbe,
    liveness: livenessOf(tokenId, listingProbe),
    quote,
    priceLabel: priceLabelOf(quote),
    category,
  });

  const placement = placeListing({
    tokenId,
    registered: true,
    card: { resolved: entry.cardSource !== "unresolved", name: entry.name, description: entry.description, error: entry.cardError },
    endpoint,
    probe: reading,
    quote,
    fineness: report ? report.fineness : null,
    settled,
  });

  return {
    tokenId,
    at,
    listed: Boolean(indexed),
    blockNumber: entry.blockNumber,
    name: entry.name,
    owner: entry.owner,
    category,
    endpoint,
    protocol: reading.protocol ?? null,
    tools: reading.tools ?? [],
    price: priceLabelOf(quote),
    fineness: report ? report.fineness : null,
    assay,
    assayError,
    settled,
    placement,
    hire: { ok: verdict.ok, reason: verdict.reason, short: verdict.short },
  };
}
