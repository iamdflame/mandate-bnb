# Rebuild status

Every item in `rebuild_plan.md`, with its current state. Updated as work lands.

`DONE` · `PARTIAL` · `TODO` · `BLOCKED` (needs something I cannot supply)

---

## PART I — the problems

### Category A — eligibility

| # | Problem | State | Evidence |
|---|---|---|---|
| A1 | No Agent Advantage Report → ineligible for TermiX $10k | **DONE** | `docs/AGENT_ADVANTAGE_REPORT.md`, 6 tasks, lock anchored on BSC |
| A2 | Sessions not registered in KeyStore | **DONE** | 4 sessions `registered: true`, each with its authorising tx |
| A3 | One session, one category | **DONE** | 4 mandates, 4 categories, 4 sessions |
| A4 | No PancakeSwap track submission | **DONE** | `docs/PANCAKESWAP.md` + pool-gap scanner |
| A5 | No x402 / b402 rail | **DONE** | two paid endpoints, 4/4 proven on mainnet |

### Category B — thesis contradictions

| # | Problem | State | Evidence |
|---|---|---|---|
| B1 | ★ Benchmark lives in a local directory | **DONE** | `.benchmarks/` deleted; attestations on chain + Greenfield |
| B2 | Market self-dealt with dust | **PARTIAL** | still one operator; bonds still ~$0.06. Needs R9 |
| B3 | `minBond` source/chain divergence | **DONE** | constructor argument; events on both setters |
| B4 | Alpha reported, not derived; adjudicator is us | **PARTIAL→v2** | v2 makes reporting cost a stake and lets anyone contradict it for the same block. The contract still cannot decide wallet value; it can freeze the money and price the lie |
| B5 | README argues with the brief | **DONE** | opens with the ladder; the directory is swallowed, not rejected |
| B6 | Floor is beautiful, not a marketplace | **DONE** | moved to `/floor`; the ladder is the front door |

### Category C — rubric gaps

| # | Problem | State | Evidence |
|---|---|---|---|
| C1 | 265 of 301,996 classified | **TODO** | `agents.json` holds 3,402 |
| C2 | 1.9 MB static JSON | **TODO** | 1,976,377 bytes, captured 2026-09-04T11:20Z |
| C3 | No self-service listing | **DONE** | `/list-your-agent` — what each rung costs |
| C4 | Agent diversity structurally unequal | **PARTIAL** | 4 categories now have mandates + sessions; only grid has settled epochs |
| C5 | Zero app tests, zero CI | **TODO** | 0 test files, no `.github/` |
| C6 | No agent career page | **DONE** | mandates, epochs, fees, slashes, dismissals, each with its tx |

### Category D — adoption blockers

| # | Problem | State |
|---|---|---|
| D1 | Only runs on your machine | **PARTIAL** — benchmark and preimages are off-machine; `.sessions/` public half still a committed file |
| D2 | Single operator, no key ceremony | **TODO** |
| D3 | No incident/failure path | **TODO** |
| D4 | No economic sustainability model | **TODO** — no protocol fee in the contract |
| D5 | Nothing written back to the substrate | **DONE** — six assays in the Reputation Registry |
| D6 | No licence/brand/team/ADOPTION.md | **TODO** |

### Category E — engineering

| # | Problem | State |
|---|---|---|
| E1 | Adjudicator single EOA | **PARTIAL** — v2 adds two-step handover; multisig is an owner choice, not a contract one |
| E2 | `challengeWindow` may exceed `epochLength` | **DONE** — enforced at open in v2 |
| E3 | `uint96` BNB-only capital | **DONE** — BEP-20 mandates in v2 |
| E4 | No pause / circuit breaker | **DONE** — v2, withdrawals stay open |
| E5 | Strikes + catastrophic alpha are constants | **DONE** — per-mandate in v2 |
| E6 | No bid expiry | **DONE** — v2, and expired bids are skipped on succession |
| E7 | No event indexer / subgraph | **TODO** |
| E8 | No documented rate-limit strategy | **PARTIAL** — limiter exists, undocumented |
| E9 | No deploy runbook | **TODO** |
| E10 | Self-hosted fonts, no third-party requests | **DONE** — stated in README |

### Category F — narrative

| # | Problem | State |
|---|---|---|
| F1 | README fights the brief | **DONE** |
| F2 | Best asset buried in RESEARCH.md | **DONE** — the funnel is the front door |
| F3 | No demo video | **BLOCKED** — I cannot record video |
| F4 | No judge-start path | **DONE** — `/start`, 8 claims each with its falsifier |
| F5 | No stated failures | **DONE** — Advantage Report losses in bold; `scope-audit` refuses us |
| F6 | Fineness metaphor undefined on contact | **DONE** — defined where first used |

---

## PART II — the strategic reframe

| Item | State |
|---|---|
| Trust Ladder as information architecture (rungs 0–6) | **DONE** — `src/lib/ladder.ts`, rendered at `/` |
| Tagline shift | **DONE** |

---

## PART III — the rebuild

### R1 — proof layer

| # | Item | State |
|---|---|---|
| R1.1 | Attestations committed on chain at award | **DONE** |
| R1.2 | Preimages on Greenfield | **DONE** — 3 objects, read back and hash-checked |
| R1.3 | Optimistic settlement + challenge bonds | **DONE** — v2, staked proposals, deployed |
| R1.4 | `npx mandate-verify`, published | **DONE** — `mandate-verify@0.2.0` on npm |
| R1.5 | Local state → Postgres + Greenfield | **PARTIAL** |

### R2 — assay engine v2

| # | Item | State |
|---|---|---|
| R2.1 | Scale to the full indexable registry | **BLOCKED** — needs the 8004scan Pro key |
| R2.2 | Multi-signal, confidence-scored, auditable, contestable classification | **PARTIAL** — on-chain evidence signal now works (see R2 note) |
| R2.3 | Exclusion reason for every excluded agent | **TODO** |
| R2.4 | Reproduce the indexer footgun | **DONE** — tested, **false**; publishing the negative result instead |
| R2.5 | Reputation autopsy per agent | **DONE** — on every agent page |

### R3 — Altana

| # | Item | State |
|---|---|---|
| R3.1 | Register every session in KeyStore | **DONE** |
| R3.2 | Four live sessions, one per category | **DONE** |
| R3.3 | `prove-session-scope.ts`, 8 assertions | **DONE** — 5 proven, 0 failed, 3 inconclusive (Altana relay fault) |
| R3.4 | User-facing revocation in the product | **DONE** — `/authority` |
| R3.5 | Wire revocation to dismissal | **DONE** — `npm run keeper` |
| R3.6 | `hireErc8183Agent` on the buyer side | **DONE** — `npm run prove-hire`, 5 proven |

### R4 — x402 / b402 · R5 — write-back

| # | Item | State |
|---|---|---|
| R4 | b402 selling, buying, low-friction hire path | **DONE** |
| R5 | ★ Write assays back to the Reputation Registry | **DONE** |

### R6 — Advantage Report

| # | Item | State |
|---|---|---|
| R6.1 | Input lock before results | **DONE** — hash anchored on BSC, window chosen by the chain |
| R6.2 | Six tasks | **DONE** |
| R6.3 | Losses published in bold | **DONE** |
| R6.4 | Real artifacts attached | **PARTIAL** — tx hashes and JSON yes; screen recording **BLOCKED** |

### R7–R12

| # | Item | State |
|---|---|---|
| R7 | PancakeSwap doc + pool-gap scanner | **DONE** |
| R8 | Information architecture (9 routes) | **DONE** — all nine |
| R9 | Supply side: listing, shadow mandates, underwriting, bond tiers | **TODO** |
| R10 | Contract v2 (11 items) | **DONE** — 70 tests, deployed to mainnet |
| R11 | Data pipeline | **TODO** |
| R12 | CI, uptime, reliability | **TODO** |

---

## PART IV — what to steal (9 of 30)

**Done:** VEYRA session-scope proof (beaten: wrong-selector) · Docket input lock (beaten: anchored on chain) · Docket published losses · winsznx independent verifier · **winsznx `granted ⊆ proven` as a compiled invariant** · MandateX `ERC721Enumerable` finding · MandateX `chain_id` footgun (tested — false) · Onplaced honest tiering · Agripinaa mainnet operation.

**Remaining (21):** VEYRA proof table · VEYRA refund path · PositionCrew block-pinned reads · PositionCrew stated exclusions · PositionCrew CI badges · PositionCrew no-wallet trial · Agripinaa surplus-vs-limit bps · Agripinaa receipt JSON · Agripinaa MEV protection · SMEAI `/start` · SMEAI video (**blocked**) · SMEAI "calls every agent" headline · Docket anonymised seats · Docket "what is not true yet" · KaizenScope census-as-JSON · KaizenScope buyer-signs-each-step · MandateX exclusion reasons · Kawal write-back · Onplaced trust decay.

## PART V — net-new innovation (3 of 10)

**Done:** #9 published verifier · #4 assay-derived session scope · #6 reputation autopsy pages.
**Remaining:** underwriting/co-bonding · shadow mandates · succession queue surface · per-category benchmarks · reputation autopsy · registry write-back · pool-gap scanner · adverse-results policy.

## PART VI — the adoption case (0 of 8)

`ADOPTION.md` does not exist. All eight sections outstanding: cost model · runbook · key management · failure modes · write-back commitment · ladder as KPI · brand and team · what it is not.

---

## Blocked, and on what

| Item | Needs |
|---|---|
| R2.1 registry-wide classification | 8004scan Pro key (25 → 500 req/min) |
| F3 / R6.4 demo video | a human to record it |
| B2 adversarial bond sizes | capital, not code |
