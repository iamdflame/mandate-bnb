/**
 * The four rooms.
 *
 * Categories were query parameters, which meant a job had no address of its
 * own: nothing to link to, nothing to share, and no page that could be shallow
 * or deep on its own terms. The plan is explicit that all four are equal, and
 * the way you find out whether that is true is by giving each one a URL and
 * looking at it. A room with no stranger to hire says so on its own page
 * rather than hiding inside a filtered list.
 */

import type { Category } from "@/lib/config";

export interface Room {
  slug: "rebalance" | "grid" | "yield" | "guard";
  category: Category;
  /** The job, as somebody with the problem would say it. */
  title: string;
  /** What goes wrong if nobody does it. */
  problem: string;
  /** What an agent here is allowed to touch. */
  scope: string;
}

export const ROOMS: Room[] = [
  {
    slug: "rebalance",
    category: "rebalancing",
    title: "Rebalance",
    problem:
      "A PancakeSwap position stops earning the moment the price leaves its range, and it keeps not earning until somebody moves it.",
    scope: "PancakeSwap V3 ranges, through RecipientBound, which has no recipient argument to abuse.",
  },
  {
    slug: "grid",
    category: "grid-trading",
    title: "Grid",
    problem: "Buying low and selling high on a schedule is simple and nobody is awake for all of it.",
    scope: "Bounded buys and sells through SwapBound, capped for the life of the session.",
  },
  {
    slug: "yield",
    category: "yield-optimisation",
    title: "Yield",
    problem: "Cash sits in the venue that paid best last month rather than the one paying best now.",
    scope: "Venus, Lista and Aave supply, recipient bound, so the deposit is credited to you and nobody else.",
  },
  {
    slug: "guard",
    category: "health-factor",
    title: "Guard",
    problem: "A loan drifts toward liquidation at three in the morning and liquidation is permanent.",
    scope: "Repay only, budget capped. It cannot borrow, and it cannot repay for anybody but you.",
  },
];

export const roomBySlug = (slug: string): Room | null => ROOMS.find((r) => r.slug === slug) ?? null;
export const roomFor = (category: string): Room | null => ROOMS.find((r) => r.category === category) ?? null;
export const roomHref = (category: string): string => {
  const r = roomFor(category);
  return r ? `/jobs/${r.slug}` : `/agents?category=${category}`;
};
