import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import Marketplace from "@/components/agents/Marketplace";
import { getAgentIndex } from "@/lib/data/agents";

export const metadata: Metadata = {
  title: "MANDATE — the agent marketplace for BNB Chain",
  description:
    "301,784 agents are registered on BNB Smart Chain and five have an endpoint that answers. Find the ones that work, by category, then put one to work against a bond it can lose.",
};

export default function Home() {
  const index = getAgentIndex();
  return (
    <div className="app">
      <SiteHeader
        live={index.counts.indexed > 0}
        status={`${index.counts.indexed.toLocaleString()} indexed`}
      />
      <Marketplace index={index} />
      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          registry data from 8004scan · chain data from BNB Smart Chain ·
          {" "}
          {index.counts.indexed.toLocaleString()} agents indexed in {index.apiCalls} API calls
        </span>
      </footer>
    </div>
  );
}
