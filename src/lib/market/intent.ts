/**
 * What a person typed, mapped to the job they want done.
 *
 * The classifier in lib/assay reads how agents describe themselves ("yield
 * optimisation", "concentrated liquidity"). Buyers do not talk like that: they
 * type "protect my loan" or "better stablecoin yield", and the classifier,
 * correctly for its purpose, finds nothing. This is the buyer's vocabulary,
 * scored first, with the classifier as the fallback, so a search box behaves
 * like a search box and not like a chatbot.
 *
 * It never invents a match. When nothing fits, it returns null and the page
 * searches names and descriptions as plain text.
 */

import { classify } from "@/lib/assay/classify";
import type { Category } from "@/lib/config";

const VOCAB: Record<Category, [RegExp, number][]> = {
  "health-factor": [
    [/\bhealth\s*factor\b/, 3],
    [/\bliquidat/, 3],
    [/\bloan|\bborrow|\bdebt\b|\brepay/, 2],
    [/\bcollateral|\bltv\b/, 2],
    [/\bprotect|\bguard|\bsafe(ty)?\b|\bmonitor/, 1],
    [/\bvenus\b|\baave\b|\blending\b/, 1],
  ],
  "yield-optimisation": [
    [/\byield\b|\bapy\b|\bapr\b/, 3],
    [/\bstablecoin|\bstable\b|\busdt\b|\busd1\b|\busdc\b/, 1],
    [/\bearn|\binterest|\bsavings?\b|\bidle\b/, 2],
    [/\bfarm|\bvault|\bcompound|\bstak/, 2],
    [/\boptimi[sz]e|\bbetter rate|\bbest rate/, 1],
  ],
  rebalancing: [
    [/\brebalanc|\brecent(re|er)/, 3],
    [/\blp\b|\bliquidity\b|\bout of range\b|\brange\b/, 2],
    [/\bpancake|\bv3\b|\bposition\b|\bimpermanent/, 1],
  ],
  "grid-trading": [
    [/\bgrid\b/, 3],
    [/\bdca\b|\blimit order|\bbuy low|\bsell high|\bmarket making/, 2],
    [/\btrad(e|es|ing)\b|\bbot\b|\bstrateg/, 1],
  ],
};

export interface Intent {
  category: Category;
  /** The words that decided it, shown back to the reader. */
  because: string[];
}

export function intentOf(query: string): Intent | null {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return null;

  let best: { category: Category; score: number; because: string[] } | null = null;
  for (const [category, rules] of Object.entries(VOCAB) as [Category, [RegExp, number][]][]) {
    let score = 0;
    const because: string[] = [];
    for (const [re, w] of rules) {
      const m = q.match(re);
      if (m) {
        score += w;
        because.push(m[0].trim());
      }
    }
    if (score > (best?.score ?? 0)) best = { category, score, because };
  }
  // A single weak word ("trade", "safe") is not enough to decide for someone.
  if (best && best.score >= 2) return { category: best.category, because: best.because };

  const c = classify({ name: query, description: query, skills: [], tags: [] });
  return c.category ? { category: c.category, because: c.matched } : null;
}
