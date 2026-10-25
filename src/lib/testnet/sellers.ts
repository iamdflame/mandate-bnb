/**
 * Agents anyone can hire free on BNB Smart Chain testnet, from every builder,
 * not only ours.
 *
 * Set and Earn counts testnet hires, and on 25 Oct the testnet ERC-8004
 * registry held 2,671 agents: 345 in the four jobs, 17 of them selling
 * escrowed jobs with a signed price for the testnet kernel. Each was refused
 * here only because every quote was checked against mainnet. This keeps that
 * list: it reads the registry in slices (new tokens, then a rotating re-read
 * of older ones), files each agent by what its card says, keeps the ones
 * whose card sells escrowed jobs, and asks each for its price on chain 97 the
 * way the mainnet census asks: the card's own example first, then our
 * structured task, then its name, with a decline recorded as a decline.
 *
 * Kept apart from the mainnet census on purpose: testnet token ids collide
 * with mainnet ones, and nothing here can touch a mainnet listing.
 */

import { parseAbi, type Address } from "viem";
import { testnetPublic } from "@/lib/chain/testnet";
import { ESCROW_TESTNET } from "@/lib/escrow/contracts";
import { readCard, readRegistryEntry, readServices } from "@/lib/sources/registry";
import { classify, fileable } from "@/lib/assay/classify";
import { escrowSeller, quoteWith, type EscrowQuote } from "@/lib/escrow/a2a";
import { quoteSigners } from "@/lib/escrow/signers";
import { attributed, taskFor } from "@/lib/escrow/task";
import { DEMO_ADDRESS } from "@/lib/demo";
import { withTimeout } from "@/lib/cache";
import { loadedLive, snapshot, store, warm } from "@/lib/data/snapshots";
import { testnetProviders } from "@/lib/escrow/testnet-jobs";
import { poolNow } from "@/lib/house/services";
import type { Category } from "@/lib/config";

export interface TestnetSeller {
  /** Its ERC-8004 id on the testnet registry. */
  tokenId: string;
  name: string;
  /** The first line of what its card says it does. */
  what: string | null;
  category: Category;
  owner: string;
  /** Its A2A endpoint, the negotiation skill its card lists, and whether it wants a funded job announced. */
  a2a: string;
  skill: string;
  notify: boolean;
  /** Its card's first task example, when it has one: some sellers price only that form. */
  example: string | null;
  /** One of our four, under its testnet identity. */
  ours: boolean;
  /** Its mainnet id, for ours, where its page lives. */
  mainnetTokenId: string | null;
  readAt: string;
  /** Its last answer to our price request on chain 97. */
  quote: Pick<EscrowQuote, "provider" | "price" | "etaSeconds" | "unpayable" | "at"> & { task: string | null; declined: string | null } | null;
  /** A job opened here passed its deadline undelivered: off sale until it delivers one. */
  missedAt?: string | null;
}

export interface TestnetSellers {
  at: string;
  /** Every token up to here has been read once. */
  scannedTo: number;
  /** Where the rotating re-read of older tokens resumes. */
  recheckFrom: number;
  agents: Record<string, TestnetSeller>;
}

const ABI = parseAbi(["function ownerOf(uint256) view returns (address)", "function tokenURI(uint256) view returns (string)"]);
const REGISTRY = ESCROW_TESTNET.identity as Address;
const CHUNK = 200;
const RECHECK = 60;

const empty = (): TestnetSellers => ({ at: new Date(0).toISOString(), scannedTo: 0, recheckFrom: 1, agents: {} });

/** The list as last stored. */
export function testnetSellers(): TestnetSellers {
  return snapshot<TestnetSellers>("testnet-sellers")?.payload ?? empty();
}

/** Whether a buyer here can hire it now: a live price in test $U, and no job here left undelivered. Pure, for tests. */
export function hireableOnTestnet(s: TestnetSeller, now = Date.now()): { ok: boolean; why: string | null } {
  if (s.missedAt) return { ok: false, why: "It let a job opened here pass its deadline undelivered. It comes back once it delivers one." };
  if (!s.quote) return { ok: false, why: "We have not had its price yet." };
  if (s.quote.unpayable) return { ok: false, why: `Not for hire here: ${s.quote.unpayable}.` };
  if (!(BigInt(s.quote.price || "0") > 0n)) return { ok: false, why: "It quoted no price." };
  // A price older than two days is not a price someone can count on.
  if (now - Date.parse(s.quote.at) > 2 * 86_400_000) return { ok: false, why: "Its last price is more than two days old." };
  return { ok: true, why: null };
}

/** The highest token id the testnet registry holds, found by doubling then halving from a known one. */
async function highestToken(from: number): Promise<number> {
  const c = testnetPublic();
  const exists = (n: number) => c.readContract({ address: REGISTRY, abi: ABI, functionName: "ownerOf", args: [BigInt(n)] }).then(() => true, () => false);
  let lo = Math.max(1, from);
  if (!(await exists(lo))) lo = 1;
  let step = 64;
  let hi = lo + step;
  while (await exists(hi)) {
    lo = hi;
    step *= 2;
    hi = lo + step;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (await exists(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Reads a run of tokens and returns the ones that sell escrowed jobs in one of the four jobs. */
async function readTokens(ids: number[], ours: Map<string, { mainnetTokenId: string | null; category: Category }>): Promise<{ sellers: TestnetSeller[]; read: number[] }> {
  const c = testnetPublic();
  const [uris, owners] = await Promise.all([
    c.multicall({ contracts: ids.map((id) => ({ address: REGISTRY, abi: ABI, functionName: "tokenURI", args: [BigInt(id)] })), allowFailure: true }),
    c.multicall({ contracts: ids.map((id) => ({ address: REGISTRY, abi: ABI, functionName: "ownerOf", args: [BigInt(id)] })), allowFailure: true }),
  ]);
  const sellers: TestnetSeller[] = [];
  const read: number[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 16 }, async () => {
      for (;;) {
        const i = next++;
        if (i >= ids.length) return;
        const id = String(ids[i]);
        const uri = String(uris[i]?.result ?? "");
        read.push(ids[i]!);
        if (!uri) continue;
        const { card } = await withTimeout(readCard(uri).catch(() => ({ card: null })), 10_000).then((r) => r ?? { card: null });
        if (!card) continue;
        const services = readServices(card);
        const name = typeof card.name === "string" && card.name.trim() ? card.name.trim().slice(0, 80) : `Testnet agent #${id}`;
        const description = typeof card.description === "string" ? card.description : null;
        const filed = classify({ name, description, skills: services.map((s) => s.name) });
        const mine = ours.get(id);
        // Ours are filed by the job each was built for, not by a reading of its card.
        if (!mine && (!filed.category || !fileable(filed, services.some((s) => /^https?:/i.test(s.endpoint))))) continue;
        const seller = await withTimeout(escrowSeller(services).catch(() => null), 12_000);
        if (!seller) continue;
        sellers.push({
          tokenId: id,
          name,
          what: description ? description.split(/(?<=[.!?])\s/)[0]!.slice(0, 160) : null,
          category: mine?.category ?? (filed.category as Category),
          owner: String(owners[i]?.result ?? "").toLowerCase(),
          a2a: seller.url,
          skill: seller.skill,
          notify: seller.notify,
          example: seller.examples[0] ?? null,
          ours: Boolean(mine),
          mainnetTokenId: mine?.mainnetTokenId ?? null,
          readAt: new Date().toISOString(),
          quote: null,
        });
      }
    }),
  );
  return { sellers, read };
}

/** Asks one seller its price on chain 97, with the wallets its testnet registration names as the only signers allowed. */
export async function quoteTestnetSeller(s: TestnetSeller, opts: { bnbUsd?: number | null } = {}): Promise<TestnetSeller["quote"]> {
  const entry = await withTimeout(readRegistryEntry(s.tokenId, 97).catch(() => null), 6_000);
  const signers = await quoteSigners(s.tokenId, entry, 97);
  const structured = taskFor(s.category, s.name, { wallet: DEMO_ADDRESS }, { bnbUsd: opts.bnbUsd ?? null });
  const q = await withTimeout(
    quoteWith({ url: s.a2a, notify: s.notify, skill: s.skill, examples: s.example ? [s.example] : [] }, { structured, plain: s.name, mark: attributed }, { signers, chainId: 97 }).catch(() => null),
    22_000,
  );
  if (!q) return null;
  return { provider: q.provider, price: q.price, etaSeconds: q.etaSeconds, unpayable: q.unpayable, at: q.at, task: q.task ?? null, declined: q.declined ?? null };
}

/**
 * One scheduled pass: read newly minted tokens, re-read a slice of older
 * ones, then ask the stalest sellers their price. Merges into the stored list
 * and saves it whole, so it runs only on top of the live one.
 */
export async function refreshTestnetSellers(opts: { budgetMs: number; rescan?: boolean }): Promise<string> {
  const started = Date.now();
  const left = () => opts.budgetMs - (Date.now() - started);
  await warm(["testnet-sellers"]);
  if (!(await loadedLive("testnet-sellers"))) return "the stored testnet list is not loaded on this instance; not saving over it";
  const state: TestnetSellers = structuredClone(testnetSellers());
  // Every token read again from the first, keeping the prices already held.
  if (opts.rescan) state.scannedTo = 0;
  const ours = new Map([...testnetProviders().values()].map((p) => [p.tokenId, { mainnetTokenId: p.mainnetTokenId, category: p.ref.category }] as const));
  // A grid task is priced inside a band around BNB's price now; a seller without one declines.
  const bnbUsd = await poolNow().then((p) => p.usdtPerBnb, () => null);

  let found = 0;
  let dropped = 0;
  const merge = (got: { sellers: TestnetSeller[]; read: number[] }) => {
    const sold = new Set(got.sellers.map((x) => x.tokenId));
    for (const id of got.read) {
      // A token re-read that no longer sells escrowed jobs leaves the list.
      if (!sold.has(String(id)) && state.agents[String(id)]) {
        delete state.agents[String(id)];
        dropped += 1;
      }
    }
    for (const x of got.sellers) {
      const before = state.agents[x.tokenId];
      if (!before) found += 1;
      state.agents[x.tokenId] = { ...x, quote: before?.quote ?? null, missedAt: before?.missedAt ?? null };
    }
  };

  // New tokens first, a chunk at a time, the cursor saved as it moves.
  const top = await highestToken(state.scannedTo).catch(() => state.scannedTo);
  while (state.scannedTo < top && left() > 38_000) {
    const ids = Array.from({ length: Math.min(CHUNK, top - state.scannedTo) }, (_, i) => state.scannedTo + 1 + i);
    merge(await readTokens(ids, ours));
    state.scannedTo = ids[ids.length - 1]!;
  }
  // Then a slice of older tokens again: a card can start selling, or stop.
  if (state.scannedTo > 0 && left() > 36_000) {
    const from = state.recheckFrom > state.scannedTo ? 1 : state.recheckFrom;
    const ids = Array.from({ length: Math.min(RECHECK, state.scannedTo - from + 1) }, (_, i) => from + i);
    merge(await readTokens(ids, ours));
    state.recheckFrom = ids[ids.length - 1]! + 1;
  }

  // Prices, stalest first, while time allows.
  const queue = Object.values(state.agents).sort((a, b) => (a.quote?.at ?? "").localeCompare(b.quote?.at ?? ""));
  let asked = 0;
  let priced = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (;;) {
        // An ask takes at most 28 s (a 6 s registry read, a 22 s price request), so none outlives the budget.
        if (left() < 30_000) return;
        const s = queue.shift();
        if (!s) return;
        asked += 1;
        const q = await quoteTestnetSeller(s, { bnbUsd }).catch(() => null);
        // A seller that did not answer keeps its last price; it is marked asked so the next one gets its turn.
        state.agents[s.tokenId] = { ...state.agents[s.tokenId]!, quote: q ?? (s.quote ? { ...s.quote, at: s.quote.at } : null) };
        if (q && !q.unpayable) priced += 1;
      }
    }),
  );
  state.at = new Date().toISOString();
  await store("testnet-sellers", state, state.at);
  const ready = Object.values(state.agents).filter((s) => hireableOnTestnet(s).ok).length;
  return `read to #${state.scannedTo} of ${top}; ${Object.keys(state.agents).length} sell escrowed jobs (${found} new, ${dropped} gone); asked ${asked}, ${priced} priced; ${ready} hireable`;
}

/**
 * The list a buyer sees: one entry per seller (the same owner serving the
 * same endpoint under two tokens is one agent, its first token kept, so a
 * buyer never counts it as two different agents), hireable ones first.
 */
export function testnetListings(now = Date.now()): (TestnetSeller & { hireable: boolean; why: string | null })[] {
  return listingsOf(Object.values(testnetSellers().agents), now);
}

/** The same, over any list of sellers. Pure, for tests. */
export function listingsOf(agents: TestnetSeller[], now = Date.now()): (TestnetSeller & { hireable: boolean; why: string | null })[] {
  const seen = new Set<string>();
  return [...agents]
    .sort((a, b) => Number(a.tokenId) - Number(b.tokenId))
    .filter((s) => {
      const key = `${s.owner}|${s.a2a.replace(/[?#].*$/, "").replace(/\/$/, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({ ...s, ...((h) => ({ hireable: h.ok, why: h.why }))(hireableOnTestnet(s, now)) }))
    .sort((a, b) => Number(b.hireable) - Number(a.hireable) || Number(b.ours) - Number(a.ours) || Number(a.tokenId) - Number(b.tokenId));
}
