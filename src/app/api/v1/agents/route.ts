/**
 * The register, as data: the agents filed under the four jobs, filterable by
 * rung, category and whether they can be hired right now (`hireable=1`).
 * `all=1` adds every other registration we have read, unfiled.
 *
 * Returns what has actually been read, and says how much of the registry that
 * is. A caller must be able to tell a small answer from a small registry.
 */

import { findAgent, readAgentIndex, type IndexedAgent } from "@/lib/data/agents";
import { placeAgent, readMarketSets } from "@/lib/rung";
import { CATEGORIES, CHAIN_ID, type Category } from "@/lib/config";
import { fail, gate, ok, preflight } from "@/lib/api/respond";
import { live } from "@/lib/data/live";
import { hireCounts } from "@/lib/market/hires";
import { hirePath } from "@/lib/market/hire-law";
import { censusAge, listings } from "@/lib/market/listing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { capacity: 30, windowMs: 60_000 };
const MAX_LIMIT = 200;

export function OPTIONS() {
  return preflight();
}

export async function GET(request: Request) {
  await live();
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;

  const url = new URL(request.url);
  const rungParam = url.searchParams.get("rung");
  const categoryParam = url.searchParams.get("category");
  const hireableParam = url.searchParams.get("hireable");
  const allParam = url.searchParams.get("all");
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

  const rung = rungParam !== null && /^[0-6]$/.test(rungParam) ? Number(rungParam) : null;

  /*
    An unrecognised filter is refused, not ignored.

    `?category=grid` used to fall through to `null` and return the whole
    unfiltered register, so a caller asking for grid agents got three hundred
    thousand rows of everything and no indication that their filter had been
    dropped. Silently widening a query is the worst of the three options: worse
    than an error, and worse than an empty page, because the caller believes
    the answer.
  */
  if (categoryParam !== null && !(CATEGORIES as readonly string[]).includes(categoryParam)) {
    return fail(
      400,
      `Unknown category "${categoryParam}". Valid categories are ${CATEGORIES.join(", ")}.`,
      CHAIN_ID,
    );
  }
  if (rungParam !== null && rung === null) {
    return fail(400, `Unknown rung "${rungParam}". Rungs run 0 to 6.`, CHAIN_ID);
  }
  if (hireableParam !== null && hireableParam !== "1" && hireableParam !== "0") {
    return fail(400, `hireable is 1 or 0, not "${hireableParam}".`, CHAIN_ID);
  }
  const onlyHireable = hireableParam === "1";
  if (allParam !== null && allParam !== "1" && allParam !== "0") {
    return fail(400, `all is 1 or 0, not "${allParam}".`, CHAIN_ID);
  }
  // The market is the four jobs; every registration we have read, filed or not, only when asked for.
  const everything = allParam === "1";
  const category = (categoryParam as Category | null) ?? null;

  const [index, sets, counts] = await Promise.all([readAgentIndex(), readMarketSets(), hireCounts().catch(() => null)]);
  /*
    Hireable is the hire law's answer, the same one every page gives: an agent
    that answered recently in a protocol we can use, with a rail we can settle
    and no unanswered failure on record. Computed over the census's last reading.
  */
  const hireable = new Set(listings(counts?.byTokenId, counts?.settled).filter((l) => hirePath(l).ok).map((l) => l.tokenId));
  const census = censusAge();

  const row = (a: IndexedAgent) => {
    const place = placeAgent(a, sets);
    const wallet = a.owner?.toLowerCase() ?? "";
    const standing = wallet ? sets.standing.get(wallet) : undefined;
    return {
      tokenId: a.tokenId,
      name: a.name,
      owner: a.owner,
      category: a.category,
      confidence: a.confidence,
      endpointVerified: Boolean(a.endpointVerified),
      rung: place.rung,
      rungName: place.name,
      rungReason: place.reason,
      fineness: standing?.fineness ?? null,
      hallmarked: (standing?.fineness ?? 0) >= 375,
      bondWei: standing ? standing.bondWei.toString() : null,
      alphaBps: standing ? Number(standing.alphaBps) : null,
      lastSeen: a.lastSeen ?? index.capturedAt,
      hireable: hireable.has(a.tokenId),
    };
  };

  const placed = index.agents.map(row);
  /*
    The register is the crawl of the whole registry and can trail the index the
    census reads, so an agent registered since the last crawl is hireable on
    every page and missing here. It is added from the census's own index rather
    than dropped from the one answer a caller asked for.
  */
  const inRegister = new Set(placed.map((a) => a.tokenId));
  for (const id of hireable) {
    const a = inRegister.has(id) ? null : findAgent(id);
    if (a) placed.push(row(a));
  }

  const filtered = placed.filter(
    (a) =>
      (everything || a.category !== null) &&
      (rung === null || a.rung === rung) &&
      (category === null || a.category === category) &&
      (!onlyHireable || a.hireable),
  );

  return ok(
    {
      coverage: {
        registered: index.registry.registered,
        read: placed.length,
        // Filed under one of the four jobs, from the agent's own words.
        classified: placed.filter((a) => a.category !== null).length,
        // A caller must be able to tell "few agents match" from "few agents
        // have been read". Both numbers, always.
        unread: Math.max(0, index.registry.registered - placed.length),
      },
      // How old the liveness behind "hireable" is. A stale census is said, not hidden.
      census: { at: census.at, minutes: census.minutes, stale: census.stale },
      filter: { rung, category, hireable: onlyHireable, all: everything, limit, offset },
      total: filtered.length,
      agents: filtered.slice(offset, offset + limit),
    },
    { chainId: CHAIN_ID, blockNumber: index.registryBlock ? String(index.registryBlock) : null, at: index.capturedAt },
    g.headers,
  );
}
