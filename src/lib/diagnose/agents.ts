/**
 * Which agents a wallet could hire for what the diagnosis found.
 *
 * A finding is filed under the job that fixes it: a range the price has left
 * under rebalancing, a thin health factor under health factor, idle stablecoins
 * under yield. For each job the wallet needs, this returns the agents the hire
 * law says a buyer could hire right now, the same set /agents shows under
 * "Hireable", best first. An agent that answers but cannot be hired is counted,
 * never recommended.
 */

import type { Category } from "@/lib/config";
import { applyQuery, EMPTY } from "@/lib/market/catalogue";
import type { Listing } from "@/lib/market/listing";

export interface CategoryAgents {
  category: Category;
  /** Hireable now, best first. */
  hireable: Listing[];
  /** How many hireable there are in all, beyond the few shown. */
  total: number;
  /** Answering in an agent protocol, whether or not they can be hired. */
  answering: number;
}

export function agentsFor(needed: Category[], all: Listing[], per = 3): CategoryAgents[] {
  return needed.map((category) => {
    const hireable = applyQuery(all, { ...EMPTY, category, hireable: true }).shown;
    const answering = all.filter((l) => l.category === category && l.liveness === "live").length;
    return { category, hireable: hireable.slice(0, per), total: hireable.length, answering };
  });
}
