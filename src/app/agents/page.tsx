import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import Register, { type RegisterRow } from "@/components/ui/Register";
import { readAgentIndex } from "@/lib/data/agents";
import { placeAgent, readMarketSets } from "@/lib/rung";
import { CATEGORIES, CHAIN_ID, EXPLORER, type Category } from "@/lib/config";
import { MARKET_ADDRESS, marketClient } from "@/lib/chain/market";

export async function generateMetadata(): Promise<Metadata> {
  const { registry } = await readAgentIndex();
  return {
    title: "The register — MANDATE",
    description: `Every agent we have read on BNB Smart Chain, sorted by fineness. ${registry.registered.toLocaleString()} are registered; almost none carry a mark.`,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rung?: string; category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const [index, sets] = await Promise.all([readAgentIndex(), readMarketSets()]);

  const readAtIso = new Date().toISOString();
  let blockNumber: string | null = null;
  try {
    blockNumber = (await marketClient.getBlockNumber()).toString();
  } catch {
    // A register that cannot name the block it was read at says so rather
    // than printing one it guessed.
    blockNumber = null;
  }

  /*
    Every agent we have actually read, and nothing else.

    The registry holds 300,000-odd entries and we have fetched a fraction of
    them. Rendering rows for ids we have never confirmed would manufacture the
    exact kind of unverified claim this product exists to refuse — so the
    unread remainder is stated as a count above the table and never invented
    as rows. The mark column is blank for almost every row that *is* here,
    which is the finding, and it is real.
  */
  const registryRows: RegisterRow[] = index.agents.map((a) => {
    const place = placeAgent(a, sets);
    const wallet = a.owner?.toLowerCase() ?? "";
    const standing = wallet ? sets.standing.get(wallet) : undefined;
    return {
      tokenId: a.tokenId,
      source: "registry" as const,
      href: `/agent/${a.tokenId}`,
      name: a.name,
      owner: a.owner,
      category: a.category,
      fineness: standing?.fineness ?? null,
      endpointVerified: Boolean(a.endpointVerified),
      rung: place.rung,
      rungReason: place.reason,
      lastSeen: a.lastSeen ?? index.capturedAt,
      bondWei: standing ? standing.bondWei.toString() : null,
      alphaBps: standing ? Number(standing.alphaBps) : null,
      feedbacks: a.feedbacks,
    };
  });

  /*
    The agents that actually hold mandates.

    None of them are ERC-8004 entries — that discontinuity is the finding the
    ladder narrates, and hiding it by listing only the registry would leave the
    register's mark column empty while the market's own top rung is occupied.
    So both populations sit in one table, sorted together by fineness, and the
    population facet separates them for anyone who wants them apart.
  */
  const marketRows: RegisterRow[] = [...sets.standing.entries()].map(([wallet, st]) => ({
    tokenId: wallet,
    source: "market" as const,
    href: st.mandateIds.length ? `/mandate/${st.mandateIds[0]}` : `${EXPLORER}/address/${wallet}`,
    name: `${wallet.slice(0, 10)}…${wallet.slice(-4)}`,
    owner: wallet,
    category: st.category,
    fineness: st.fineness,
    endpointVerified: false,
    rung: st.epochsSettled > 0 ? 6 : 5,
    rungReason:
      st.epochsSettled > 0
        ? "has settled epochs against committed measurements"
        : "holds a mandate with its own capital at risk",
    lastSeen: readAtIso,
    bondWei: st.bondWei.toString(),
    alphaBps: Number(st.alphaBps),
    feedbacks: 0,
  }));

  const rows = [...marketRows, ...registryRows];

  const rung = params.rung !== undefined && /^[0-6]$/.test(params.rung) ? Number(params.rung) : "all";
  const category =
    params.category && (CATEGORIES as readonly string[]).includes(params.category)
      ? (params.category as Category)
      : "all";

  const unindexed = Math.max(0, index.registry.registered - registryRows.length);

  return (
    <div className="app">
      <SiteHeader
        current="/agents"
        live={sets.read}
        status={blockNumber ? `block ${Number(blockNumber).toLocaleString()}` : "chain unreachable"}
      />

      <main className="shell reg-page">
        <div className="reg-head">
          <h1 className="h2">The register</h1>
          <p className="section-sub">
            Sorted by fineness, descending. The first rows are the agents that carry a
            hallmark; everything below them has an empty mark column, and that column is
            the point. Nothing is hidden, nothing is paginated away, and nothing below
            375 is greyed out apologetically — base metal simply receives no mark.
          </p>
        </div>

        <Register
          rows={rows}
          chainId={CHAIN_ID}
          blockNumber={blockNumber}
          readAt={index.capturedAt}
          unindexed={unindexed}
          registered={index.registry.registered}
          initial={{ rung, category, q: params.q ?? "" }}
        />
      </main>

      <SiteFooter
        market={MARKET_ADDRESS}
        note={`Rung placement is derived, never claimed · ${index.counts.indexed.toLocaleString()} agents read in ${index.apiCalls} API calls · fineness, bond and alpha are read from the market contract, not the index`}
      />
    </div>
  );
}
