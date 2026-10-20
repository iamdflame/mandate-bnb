/**
 * What the marketplace pages render, in the public API's own shapes.
 *
 * The pages read the same `searchMarket`, `marketAgent` and `marketJobs`
 * that /api/v1/market serves, so a person and a program see one market.
 * With design fixtures on (fixtures.ts) the same shapes come from a capture.
 */
import { CATEGORIES, type Category } from "@/lib/config";
import { marketAgent, marketJobs, searchMarket, type MarketAgent, type MarketSearch } from "@/lib/market/market-api";
import { fixture } from "./fixtures";

export type Job = Category;
export const JOBS = CATEGORIES;

export async function viewMarket(params: { q?: string; job?: string; view?: string; limit?: number } = {}): Promise<MarketSearch> {
  const f = fixture<{ data: MarketSearch }>(`market-${params.view ?? "ready"}.json`);
  if (f) {
    const agents = f.data.agents.filter((a) => (!params.job || a.job === params.job) && (!params.q || `${a.name} ${a.jobLabel}`.toLowerCase().includes(params.q.toLowerCase())));
    return { ...f.data, agents: params.limit ? agents.slice(0, params.limit) : agents, matched: agents.length };
  }
  return searchMarket(params);
}

export async function viewAgent(tokenId: string): Promise<MarketAgent | null> {
  const f = fixture<{ data: MarketAgent }>(`agent/${tokenId}.json`);
  if (f) return f.data;
  return marketAgent(tokenId);
}

export async function viewJobs(): ReturnType<typeof marketJobs> {
  const f = fixture<{ data: { jobs: Awaited<ReturnType<typeof marketJobs>> } }>("jobs.json");
  if (f) return f.data.jobs;
  return marketJobs();
}
