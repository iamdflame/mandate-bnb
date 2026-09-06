/**
 * The registry's own totals, read live rather than carried in a snapshot.
 *
 * The headline sentence on the front door and rungs 0 and 2 of the ladder all
 * come from these two numbers, and both were being served out of a committed
 * file. The file said 303,391 registered; the registry said 304,787. A market
 * whose entire argument is that unverifiable figures are worthless cannot open
 * with a figure that is a day and a half old, and it certainly cannot lose a
 * freshness comparison to a competitor's census.
 *
 * Two properties matter here more than speed:
 *
 *   The upstream fails. 8004scan returns `DATABASE_ERROR` several times an
 *   hour, and a single attempt would leave the front door falling back to the
 *   snapshot on a coin flip. It is retried, briefly.
 *
 *   A fallback is never silent. When the live read does not land, the snapshot
 *   figure is served with `live: false` and the page says which it is showing.
 *   Serving a stale number is defensible; serving it as though it were current
 *   is the thing this product exists to catch.
 */

import { countAgents } from "@/lib/sources/scan";
import { memo } from "@/lib/cache";

export interface RegistryTotals {
  registered: number;
  withEndpoint: number;
  /** False when the upstream would not answer and the snapshot is standing in. */
  live: boolean;
  /** When these figures were read. */
  at: string;
}

/**
 * Retries around an upstream that intermittently refuses.
 *
 * Three attempts, spaced far enough apart to clear a transient failure and
 * close enough together that a page render does not wait on them. Beyond that
 * the caller gets null and says so.
 */
async function attempt<T>(fn: () => Promise<T>, tries = 3): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch {
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

async function readTotalsUncached(chainId: number): Promise<RegistryTotals | null> {
  const [registered, withEndpoint] = await Promise.all([
    attempt(() => countAgents({ chainId })),
    attempt(() => countAgents({ chainId, isEndpointVerified: true })),
  ]);

  // A count of zero from an upstream that is failing is not a count of zero.
  if (!registered) return null;

  return {
    registered,
    withEndpoint: withEndpoint ?? 0,
    live: true,
    at: new Date().toISOString(),
  };
}

/**
 * Memoised for ten minutes fresh, an hour stale.
 *
 * The registry grows by roughly a thousand entries a day, so a ten-minute-old
 * count is accurate to within a handful of registrations — and the alternative
 * is two calls against a 30-per-minute anonymous tier on every page render,
 * which is how the front door would start rate-limiting itself.
 */
export function readRegistryTotals(chainId: number): Promise<RegistryTotals | null> {
  return memo(
    `registry-totals:${chainId}`,
    { freshMs: 10 * 60_000, staleMs: 60 * 60_000 },
    () => readTotalsUncached(chainId),
  );
}
