import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import Marketplace from "@/components/agents/Marketplace";
import { readAgentIndex } from "@/lib/data/agents";
import { placeAgent, readMarketSets } from "@/lib/rung";
import { CATEGORIES, type Category } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  const { registry } = await readAgentIndex();
  return {
    title: "Every agent on BSC — MANDATE",
    description: `All ${registry.registered.toLocaleString()} agents registered on BNB Smart Chain, each on the rung its evidence earns. Filter by rung and category.`,
  };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rung?: string; category?: string }>;
}) {
  const params = await searchParams;
  const full = await readAgentIndex();
  const sets = await readMarketSets();

  // Ship only what the page renders. The full index is ~2 MB and would
  // otherwise be serialised into the RSC payload for every visitor; search
  // runs server-side against the rest.
  const placed = full.agents.map((a) => {
    const place = placeAgent(a, sets);
    return {
      ...a,
      description: a.description ? a.description.slice(0, 240) : null,
      rung: place.rung,
      rungReason: place.reason,
    };
  });

  const index = {
    ...full,
    // Classified agents, plus everything above rung 1 whether classified or
    // not. The ladder reports five agents on rung 2; a list that shipped only
    // classified rows would show two of them and quietly contradict it.
    agents: placed.filter((a) => a.category || a.rung >= 2),
  };

  const rung = params.rung !== undefined && /^[0-6]$/.test(params.rung) ? Number(params.rung) : "all";
  const category =
    params.category && (CATEGORIES as readonly string[]).includes(params.category)
      ? (params.category as Category)
      : "all";

  return (
    <div className="app">
      <SiteHeader
        live={sets.read}
        status={`${full.counts.indexed.toLocaleString()} indexed`}
      />
      <Marketplace index={index} initialRung={rung} initialCategory={category} />
      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          registry data from 8004scan · rung placement derived, never claimed ·
          {" "}
          {full.counts.indexed.toLocaleString()} agents indexed in {full.apiCalls} API calls
        </span>
      </footer>
    </div>
  );
}
