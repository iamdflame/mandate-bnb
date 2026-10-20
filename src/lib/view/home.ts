/**
 * The front door's readings: the descent from the registry to the agents you
 * can hire now, the latest real hire, and how old the census is.
 */
import { live } from "@/lib/data/live";
import { withTimeout } from "@/lib/cache";
import { hireCounts } from "@/lib/market/hires";
import { censusAge, listings } from "@/lib/market/listing";
import { funnel, type Stage } from "@/lib/market/funnel";
import { latestReceipt, type Receipt } from "@/lib/market/receipt";
import { fixture } from "./fixtures";

export interface HomeView {
  stages: Stage[];
  receipt: Receipt | null;
  /** Minutes since the census last called every agent; null when it never has. */
  censusMinutes: number | null;
}

export async function viewHome(): Promise<HomeView> {
  const f = fixture<HomeView>("home.json");
  if (f) return f;
  await live();
  const hc = await hireCounts();
  const all = listings(hc.byTokenId, hc.settled, hc.delivery);
  const [stages, receipt] = await Promise.all([funnel(all), withTimeout(latestReceipt().catch(() => null), 6_000)]);
  return { stages, receipt, censusMinutes: censusAge().minutes };
}
