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
| B2 | Market self-dealt with dust | **PARTIAL** | bond tiers now scale the floor with capital, and underwriting lets a third party post it — so the mechanism no longer requires the operator to be the bidder. The live bonds are still dust, because the funds are |
| B3 | `minBond` source/chain divergence | **DONE** | constructor argument; events on both setters |
| B4 | Alpha reported, not derived; adjudicator is us | **PARTIAL→v2** | v2 makes reporting cost a stake and lets anyone contradict it for the same block. The contract still cannot decide wallet value; it can freeze the money and price the lie |
| B5 | README argues with the brief | **DONE** | opens with the ladder; the directory is swallowed, not rejected |
| B6 | Floor is beautiful, not a marketplace | **DONE** | moved to `/floor`; the ladder is the front door |

### Category C — rubric gaps

| # | Problem | State | Evidence |
|---|---|---|---|
| C1 | 265 of 301,996 classified | **BLOCKED** | 265 of 3,808 indexed, of 303,391 registered. Classification is multi-signal and chain-weighted now; the coverage gap is the 25 req/min anonymous tier, same blocker as R2.1 |
| C2 | 1.9 MB static JSON | **PARTIAL** | Postgres read path built and migrated (3,808 rows); pages report their source. Production has no instance attached, so the deployed site still reads the snapshot |
| C3 | No self-service listing | **DONE** | `/list-your-agent` — what each rung costs |
| C4 | Agent diversity structurally unequal | **DONE** | 4 categories with mandates and registered sessions; grid and yield both have settled, attested epochs |
| C5 | Zero app tests, zero CI | **DONE** | 35 unit tests, three workflows: CI, mainnet verification hourly, smoke every 15 min |
| C6 | No agent career page | **DONE** | mandates, epochs, fees, slashes, dismissals, each with its tx |

### Category D — adoption blockers

| # | Problem | State |
|---|---|---|
| D1 | Only runs on your machine | **DONE** — the benchmark is on chain, preimages on Greenfield, the index in Postgres with a read path, and a runbook a stranger can follow. `.sessions/` public half stays a committed file deliberately: it is metadata that is already on chain, and the signer never leaves the machine that granted it |
| D2 | Single operator, no key ceremony | **PARTIAL** — v2 two-step adjudicator handover, roles documented; **no multisig on the owner**, named as the largest gap |
| D3 | No incident/failure path | **DONE** — `docs/INCIDENTS.md`, eight modes |
| D4 | No economic sustainability model | **DONE** — v2 protocol fee capped at 5%, cost model in `ADOPTION.md` measured from real transactions |
| D5 | Nothing written back to the substrate | **DONE** — six assays in the Reputation Registry |
| D6 | No licence/brand/team/ADOPTION.md | **DONE** — `ADOPTION.md`, all eight sections |

### Category E — engineering

| # | Problem | State |
|---|---|---|
| E1 | Adjudicator single EOA | **PARTIAL** — v2 adds two-step handover; multisig is an owner choice, not a contract one |
| E2 | `challengeWindow` may exceed `epochLength` | **DONE** — enforced at open in v2 |
| E3 | `uint96` BNB-only capital | **DONE** — BEP-20 mandates in v2 |
| E4 | No pause / circuit breaker | **DONE** — v2, withdrawals stay open |
| E5 | Strikes + catastrophic alpha are constants | **DONE** — per-mandate in v2 |
| E6 | No bid expiry | **DONE** — v2, and expired bids are skipped on succession |
| E7 | No event indexer / subgraph | **PARTIAL** — market events are read from logs with provider failover and gaps reported; no subgraph. Honest and it does not scale past a few hundred mandates, said so in `docs/DATA.md` |
| E8 | No documented rate-limit strategy | **DONE** — `docs/DATA.md` |
| E9 | No deploy runbook | **DONE** — `ADOPTION.md` §2, written for someone who is not the author |
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
| R1.5 | Local state → Postgres + Greenfield | **PARTIAL** — preimages on Greenfield, agent index migrated to Postgres with a read path; `.sessions/` public half is still a committed file, deliberately |

### R2 — assay engine v2

| # | Item | State |
|---|---|---|
| R2.1 | Scale to the full indexable registry | **BLOCKED** — needs the 8004scan Pro key |
| R2.2 | Multi-signal, confidence-scored, auditable, contestable classification | **DONE** — chain evidence outweighs text 12:1, every signal kept and shown |
| R2.3 | Exclusion reason for every excluded agent | **DONE** — eight coded reasons, each with a remedy, on every agent page |
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
| R9 | Supply side: listing, shadow mandates, underwriting, bond tiers | **DONE** — all four |
| R10 | Contract v2 (11 items) | **DONE** — 70 tests, deployed to mainnet |
| R11 | Data pipeline | **PARTIAL** — `docs/DATA.md`, Postgres read path + migration, per-source reporting. No subgraph; production has no database attached |
| R12 | CI, uptime, reliability | **DONE** — CI, `mandate-verify` against mainnet on a schedule, production smoke, `docs/INCIDENTS.md` |

---

## PART IV — what to steal (9 of 30)

**Done:** VEYRA session-scope proof (beaten: wrong-selector) · Docket input lock (beaten: anchored on chain) · Docket published losses · winsznx independent verifier · **winsznx `granted ⊆ proven` as a compiled invariant** · MandateX `ERC721Enumerable` finding · MandateX `chain_id` footgun (tested — false) · Onplaced honest tiering · Agripinaa mainnet operation.

**Closed by the frontend rebuild:** SMEAI `/start` (the judge path, every claim beside the command that falsifies it) · Docket "what is not true yet" (its own section on `/evidence`, in the present tense) · MandateX exclusion reasons (`<Exclusions>`, on every certificate, each with the remedy) · PositionCrew block-pinned reads (`<Observation>` stamps the block and the read-age on every figure) · PositionCrew stated exclusions (the register states the unread remainder as a count rather than inventing rows) · PositionCrew no-wallet trial (`/bench` and `/assay`, no wallet anywhere).

**Remaining (15):** VEYRA proof table · VEYRA refund path · PositionCrew CI badges · Agripinaa surplus-vs-limit bps · Agripinaa receipt JSON · Agripinaa MEV protection · SMEAI video (**blocked**) · SMEAI "calls every agent" headline · Docket anonymised seats · KaizenScope census-as-JSON · KaizenScope buyer-signs-each-step · Kawal write-back · Onplaced trust decay.

## PART V — net-new innovation (3 of 10)

**Done:** #9 published verifier · #4 assay-derived session scope · #6 reputation autopsy pages.
**Remaining:** underwriting/co-bonding · shadow mandates · succession queue surface · per-category benchmarks · reputation autopsy · registry write-back · pool-gap scanner · adverse-results policy.

## PART VI — the adoption case (8 of 8)

`ADOPTION.md` is written, all eight sections, costed from measured mainnet transactions. Plus a ninth it did not ask for — **What is not true yet** — listing the multisig gap, the missing Postgres instance, the partial sweep, the dust bonds, the absent video, and the archive-node constraint.

---

## Blocked, and on what

| Item | Needs |
|---|---|
| R2.1 registry-wide classification | 8004scan Pro key (25 → 500 req/min) |
| F3 / R6.4 demo video | a human to record it |
| B2 adversarial bond sizes | capital, not code |
