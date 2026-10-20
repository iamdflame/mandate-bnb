import type { Category } from "@/lib/config";

/** Mandate's own four, the founders of each job's family, drawn as `house` characters. */
export const FOUNDERS: { id: string; job: Category; name: string }[] = [
  { id: "344119", job: "rebalancing", name: "Range-1" },
  { id: "344121", job: "grid-trading", name: "Grid-1" },
  { id: "344122", job: "yield-optimisation", name: "Yield-1" },
  { id: "344123", job: "health-factor", name: "Guard-1" },
];

export const isHouse = (tokenId: string | null | undefined) => FOUNDERS.some((f) => f.id === tokenId);
