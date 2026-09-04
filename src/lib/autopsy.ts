/**
 * The reputation autopsy.
 *
 * The registry shows a score. This shows the same score, what survives when
 * coordinated reviewers are removed, and the wallets responsible — with the
 * command to reproduce it.
 *
 * It exists because the Sybil finding was buried in a research file nobody
 * opens. A number, the official number, and why the official number is false,
 * on the page for the agent it concerns, does more for data quality than any
 * chart of the same data.
 *
 * Where the corpus cannot be fetched, this returns null rather than an
 * innocent-looking zero. An agent nobody has reviewed and an agent whose
 * reviews could not be loaded are different claims.
 */

import { getAgent, listFeedbacks, type ScanFeedback } from "@/lib/sources/scan";
import {
  detectCoordination,
  profileReviewers,
  SYBIL_DEFAULTS,
  type ReviewerProfile,
} from "@/lib/sybil/detect";

export interface FlaggedReviewer {
  address: string;
  feedbacks: number;
  agentsReviewed: number;
  maxPerAgent: number;
  reasons: string[];
}

export interface Autopsy {
  tokenId: string;
  /** What the official explorer displays. */
  /** Mean of the ratings actually attached to this agent's feedback. */
  officialScore: number | null;
  /** What the explorer's own summary field says, when it says anything. */
  explorerScore: number | null;
  officialFeedbacks: number;
  /** Distinct wallets behind those feedbacks. */
  reviewers: number;
  /** Reviewers left once coordinated cohorts are removed. */
  cleanReviewers: number;
  cleanFeedbacks: number;
  /** Mean score from the surviving reviewers, or null if none survive. */
  dedupedScore: number | null;
  flagged: FlaggedReviewer[];
  reasons: string[];
  /** Share of this agent's feedback written by flagged wallets, 0-100. */
  flaggedShare: number;
  /** Feedback records the whole-registry sample was drawn from. */
  populationSampled: number;
  reproduce: string;
  thresholds: typeof SYBIL_DEFAULTS;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * The rating on a feedback record.
 *
 * `score` is null on every record the BSC registry actually holds; the number
 * a reader sees lives in `value`, as a string. Reading `score ?? 0` — which
 * this did — scored every agent at zero and made the de-duplicated figure
 * meaningless while looking entirely plausible.
 */
const rating = (f: ScanFeedback): number | null => {
  const raw = f.value ?? f.score;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const ratingsOf = (fs: ScanFeedback[]): number[] =>
  fs.map(rating).filter((n): n is number => n !== null);

/**
 * Profiles reviewers against the registry population, not just this agent's.
 *
 * A wallet that left one review here looks unremarkable in isolation and
 * obvious once you can see it left two hundred more across a hundred other
 * agents. Judging coordination from a single agent's corpus would miss exactly
 * the behaviour worth catching.
 */
let cache: { at: number; chainId: number; profiles: Map<string, ReviewerProfile> } | null = null;
/** The corpus moves slowly and the API allows 25 requests a minute. */
const CACHE_MS = 10 * 60 * 1000;

async function population(chainId: number, pages: number): Promise<Map<string, ReviewerProfile>> {
  if (cache && cache.chainId === chainId && Date.now() - cache.at < CACHE_MS) {
    return cache.profiles;
  }
  const all: ScanFeedback[] = [];
  for (let i = 0; i < pages; i++) {
    const page = await listFeedbacks({ chainId, limit: 100, offset: i * 100 });
    const items = page.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  const profiles = profileReviewers(all);
  cache = { at: Date.now(), chainId, profiles };
  return profiles;
}

export async function readAutopsy(
  chainId: number,
  tokenId: string,
  opts: { populationPages?: number } = {},
): Promise<Autopsy | null> {
  let detail: Awaited<ReturnType<typeof getAgent>>;
  const own: ScanFeedback[] = [];
  try {
    detail = await getAgent(chainId, tokenId);
    for (let i = 0; i < 5; i++) {
      const page = await listFeedbacks({ chainId, agentTokenId: tokenId, limit: 100, offset: i * 100 });
      const items = page.items ?? [];
      own.push(...items);
      if (items.length < 100) break;
    }
  } catch {
    return null;
  }

  if (own.length === 0) return null;

  const profiles = await population(chainId, opts.populationPages ?? 12).catch(
    () => profileReviewers(own),
  );
  const owners = new Set(
    [detail.owner_address, detail.agent_wallet, detail.creator_address]
      .filter(Boolean)
      .map((a) => String(a).toLowerCase()),
  );
  const flags = detectCoordination(profiles, { ownerAddresses: owners });

  const clean = own.filter((f) => {
    const a = f.user_address?.toLowerCase();
    return a ? !flags[a]?.length : false;
  });

  const reviewers = new Set(own.map((f) => f.user_address?.toLowerCase()).filter(Boolean));
  const cleanReviewers = new Set(clean.map((f) => f.user_address?.toLowerCase()).filter(Boolean));

  const flagged: FlaggedReviewer[] = [...reviewers]
    .filter((a) => a && flags[a]?.length)
    .map((a) => {
      const p = profiles.get(a as string);
      return {
        address: a as string,
        feedbacks: p?.feedbackCount ?? 0,
        agentsReviewed: p?.agents.size ?? 0,
        maxPerAgent: p?.maxPerAgent ?? 0,
        reasons: flags[a as string] ?? [],
      };
    })
    .sort((x, y) => y.feedbacks - x.feedbacks);

  return {
    tokenId,
    officialScore: mean(ratingsOf(own)),
    explorerScore: detail.average_score ?? null,
    officialFeedbacks: own.length,
    reviewers: reviewers.size,
    cleanReviewers: cleanReviewers.size,
    cleanFeedbacks: clean.length,
    dedupedScore: mean(ratingsOf(clean)),
    flagged,
    flaggedShare: own.length ? ((own.length - clean.length) / own.length) * 100 : 0,
    reasons: [...new Set(flagged.flatMap((f) => f.reasons))].slice(0, 6),
    populationSampled: profiles.size,
    reproduce: `npm run sybil -- ${tokenId}`,
    thresholds: SYBIL_DEFAULTS,
  };
}
