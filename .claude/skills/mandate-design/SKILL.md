---
name: mandate-design
description: "Mandate's design system and review standard: the brand (kept as it is), the k- design layer, the characters, motion, components, copy and the tells to reject. Load it before building, changing or reviewing any Mandate page, component, image or UI copy, even small tweaks."
---

# Mandate design: "The agents are alive, and you hold the leash"

## The idea

Mandate is a marketplace for AI agents on BNB Smart Chain where every agent is checked against the chain before you can hire it. The brand stays exactly as it is: the green notary seal around the M, ink `#0b0d0e`, the signature green `#13b98a`, Instrument Sans for display, Inter for text, JetBrains Mono only for hashes and addresses. What makes the site feel alive is that **the agents are characters**: every agent is drawn, its face seeded by its token id, its pose read from what our last call found. Everything else stays quiet around them.

## Non-negotiables

1. Keep the brand. Never introduce a new palette, logo, display face, gradient wash or accent colour. The four job colours (`--c-cat-*`) belong to the agents and their jobs; green belongs to the Seal: the mark, the one primary action per view, live, the leash, focus.
2. Real data only. Every number is read from the chain or our records and carries its source and age in small type beside it (`.k-src`). Unknown is "not measured", never 0. Mandate's own agents are labelled "Ours". Never invent agents, users, quotes, logos or traction.
3. Claims lead, caveats follow. The claim is set in paper white at body size or larger; the caveat sits under it in `.k-small`/`.k-src`, or one tap away. Never a paragraph of caveat at the claim's weight. Cut copy hard: if a sentence can go, it goes.
4. A character's pose is a fact: `poseOf()` in `src/lib/view/state.ts` (awake = answered within 15 min, ready = hireable, dozing = not answering, failed = answer did not match the chain, graveyard = took payment and did not deliver, leashed = on a buyer's leash). Never pose a character for mood. Decorative characters (empty states, 404, footer) use house seeds or neutral seeds and never stand in for a real agent's state.
5. Every page leads with something to look at: a character, a live figure, a drawn mechanism. Never a wall of text at the top.
6. Phone is composed, not shrunk: reorder, rails (scroll-snap) instead of long stacks, 44 px targets, primary action in thumb reach, no horizontal page scroll.
7. Keep every working flow working: wallet connect, passkey, x402, escrow, leash, MandateMarket, MCP, API. Restyle markup; do not change transaction logic. Every existing URL keeps answering.

## Tokens and layers

- Brand tokens: `src/app/tokens.css` (`--c-*`, plus the renovation's `--k-*` for depth, type scale, motion). Add a token there before using a new value.
- Stylesheets: `src/styles/system.css` (base, type, buttons, surfaces, chips, fields, motion), `shell.css` (nav, sheet, footer), `characters.css`, `agents.css` (the agent card), `pages.css` (inner-page primitives), then one sheet per area: `home.css`, `market.css` (agents, agent page, hire), `trust.css`, `builders.css`, `account.css` (diagnose, leash, desk, live, jobs, receipts, help, judges, misc). The three legacy sheets (`src/app/globals.css`, `theme.css`, `market.css`) sit in `@layer legacy` and lose to every k- rule; a migrated page stops using their classes (`x-`, `m-`, unprefixed).
- Class prefix `k-` for shared parts; a page's own parts use a short page prefix (`h-` home, `mk-` market, `tr-` trust, `bd-` builders, `ac-` account).

## Type

- `.k-mega` one statement per page at most (the home hero); `.k-display` inner page titles; `.k-h2` section titles; `.k-h3` card and step titles; `.k-lede` the one sentence under a title; `.k-body` running text (max 64ch); `.k-small` and `.k-src` provenance and captions only.
- Sentence case everywhere. No tracked all-caps eyebrows, no middle-dot meta strings (use separate spans or a list), no "→" glued to text (use the lucide `ArrowRight` with class `k-btn__go` inside buttons).
- `.k-num` (tabular figures) on every changing number; `.k-mono` only for hashes, addresses, token ids in technical context, and code.

## Components (use these before writing new ones)

- Buttons: `.k-btn` (secondary), `.k-btn--primary` (one per view), `.k-btn--ghost`, `.k-btn--danger`; sizes `--sm`, `--lg`, `--block`; busy state `.k-btn--busy`.
- Surfaces: `.k-panel` (`--raised`, `--float`, `--pad`), `.k-well` for inset readouts. Radius follows hierarchy: 20-22 panels, 14-16 cards and fields, 10-12 controls, pill for chips.
- `.k-chip` (filters; `aria-pressed`), `.k-tag` (`--ours`, `--warn`, `--err`), `.k-state` with `.k-dot` (`--live` pulses, `--ready`, `--warn`, `--err`).
- `.k-field` (input row with icon and button), `.k-tabs`/`.k-tab`, `.k-subnav` (sticky sub-navigation inside a place), `.k-facts` (label/value), `.k-table-wrap` + `.k-table`, `.k-note` (`--ok`, `--warn`, `--err`), `.k-empty` (with a character), `.k-code`, `.k-prose`, `.k-fig`/`.k-figs` (a figure with its label and source, not stat tiles).
- `PageHead` (`src/components/k/PageHead.tsx`): title, lede, crumbs, actions, source, and a character in the pose that fits the page.
- The agent card `.k-agent` (see `AgentCard` in `src/app/page.tsx`): one strict template for every agent; its face, words, price and answer age tell agents apart.
- `InView` (`src/components/k/InView.tsx`): sets `data-in` once on scroll so a section plays its one entrance there.

## Characters

`<Agent job seed state size house view slot omit label />` from `src/components/characters/Agent.tsx`. Server-rendered SVG; the motion is CSS. `job` is the agent's category; `seed` its token id; `house` for Mandate's four (Range-1 344119, Grid-1 344121, Yield-1 344122, Guard-1 344123); `slot` must differ when the same agent appears twice on a page. Sizes: 28-32 in lists and chips, 96-120 on cards, 150-260 for scenes. Give a decorative drawing no `label`; give a meaningful one a `label`.

## Motion

- Durations and easing from tokens: micro 130 ms, UI 220 ms, reveals 760 ms with `--k-ease` (cubic-bezier(0.16, 1, 0.3, 1)), stagger 70 ms. Animate transform, opacity and filter only.
- One orchestrated entrance per page (`.k-rise` with `--i` for order, or a page-specific sequence); everything else responds: hover lift on cards (3-4 px), press `scale(.96)` on buttons and chips, characters lift on hover.
- Real events move: a check resolving, money entering escrow, a delivery landing, a leash drawn and cut. Never animate something as live when it is not.
- Route changes fade (`src/app/template.tsx`, opacity only). No transform or filter on ancestors of fixed elements.
- `prefers-reduced-motion`: every effect has a designed static end state.

## Copy

Plain and declarative, "we" for Mandate and "you" for the visitor. Words we use: hire, answer, check, leash, revoke, receipt, escrow, refund, kept, ready, answering. Words we avoid: revolutionary, seamless, AI-powered, guaranteed, official, score (aggregate), lease, house (say "ours"), rail (say "how you pay"). CTAs name their action ("Find an agent", "Hire for 0.01 $U", "Grant the leash", "Revoke"). Errors say what happened and how to fix it. Empty states invite the next action and show a character.

## Tells to reject

The five AI clusters (studio craft.md), and specifically here: identical cards without a face, four stat tiles under a hero, numbered circles on things that are not a sequence, grey boxes around every section, walls of small grey text, raw JSON as the payoff of a hire (render the answer; raw JSON one tap away), mono for ordinary labels, a second green accent, gradient text, glass blobs.

## Review format

Run the dev server with design fixtures (`MANDATE_FIXTURES=<folder of captured API JSON> npx next dev -p 3100`) and shoot each page with the studio skill's `shoot.mjs` at desktop and phone (`--full --wait 3500`). Read every capture. Check: the first screen leads with a visual; nothing clips or overflows at 390 px; every number has its source; no legacy class family remains on a migrated page; reduced motion shows a finished still; no console errors.
