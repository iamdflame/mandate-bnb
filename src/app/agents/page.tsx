import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import Marketplace from "@/components/agents/Marketplace";
import { getAgentIndex } from "@/lib/data/agents";

export const metadata: Metadata = {
  title: "Every agent on BSC — MANDATE",
  description:
    "All 301,784 agents registered on BNB Smart Chain, each on the rung its evidence earns. Filter by rung, category and freshness.",
};

export default function AgentsPage() {
  const full = getAgentIndex();

  // Ship only the classified agents the page actually renders. The full index
  // is ~2MB and would otherwise be serialised into the RSC payload for every
  // visitor; search runs server-side against the rest.
  const index = {
    ...full,
    agents: full.agents
      .filter((a) => a.category)
      .map((a) => ({
        ...a,
        description: a.description ? a.description.slice(0, 240) : null,
      })),
  };

  return (
    <div className="app">
      <SiteHeader
        live={index.counts.indexed > 0}
        status={`${full.counts.indexed.toLocaleString()} indexed`}
      />
      <Marketplace index={index} />
      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          registry data from 8004scan · chain data from BNB Smart Chain ·
          {" "}
          {full.counts.indexed.toLocaleString()} agents indexed in {full.apiCalls} API calls
        </span>
      </footer>
    </div>
  );
}
