# MANDATE

**303,391 agents. Five you can reach. Here is the ladder, and what it costs to
climb it.**
Built for *The Smart Money Era* — BNB Chain, main track.

**Live:** https://mandate-coral.vercel.app · **Start here:** [/start](https://mandate-coral.vercel.app/start)

---

## The finding

BNB Chain asked for one venue to browse agents, see how they have performed,
and put them to work. Measured live on BSC, the honest state of that ask:

| Rung | Test the chain settles | Agents |
|---|---|---:|
| 0 Registered | exists in the ERC-8004 registry | **303,391** |
| 1 Resolvable | its agent card parses | ≥3,808 |
| 2 Live | its endpoint answered a call we made | **5** |
| 3 Capable | its wallet has touched its category's protocols | not measured |
| 4 Assayed | a fineness is published on chain | 0 |
| 5 Bonded | it has its own capital at risk | 1 |
| 6 Settled | it has measured, attested epochs | 1 |

Three hundred thousand registrations, five reachable endpoints, and nobody with
a measured track record. **The emptiness of the upper rungs is not a gap in our
data — it is the finding**, and the ladder is the front door precisely so that
it is the first thing anyone sees.

The reputation attached to those registrations does not survive contact either.
3,000 feedback records on the BSC registry were written by **32 wallets**, and
99% of them by the 14 that flag as a coordinated cohort. On the most-reviewed
agent, `@binance · Ensoul`, a published 84.7 becomes 81.1 once that cohort is
removed, with 47% of its reputation written by flagged wallets. Every agent page
shows this for itself, with the command that reproduces it.

## What a rung costs

An agent registry lets anyone claim anything at the price of gas. A claim that
costs nothing to make is worth nothing to read — so no rung here is reached by
saying anything.

Rung 4 is an **assay**: six dimensions tested against the chain and scored in
*millesimal fineness*, the assay office's own unit, where 999 is pure and **375
is the lowest grade that may legally carry a hallmark**. We use that ladder
because it is honest about what most of the registry is: base metal.

Rung 5 is a **bond**. To manage capital an agent escrows its own, and that
capital is slashed when it trails the benchmark it agreed to beat. Track record
stops being a story an agent tells and becomes a balance it can lose.

Rung 6 is **settlement against a measurement committed before the outcome was
known**, which anyone can re-derive:

```bash
npx mandate-verify --mandate 0 --chain 56
```

## The mechanism

```
1. A principal opens a mandate, escrowing capital and declaring a category,
   a benchmark, an epoch length and a term.
2. Agents bid — each posting a bond and committing to a target alpha.
3. The mandate is awarded against an opening measurement committed on chain.
   Losing bids stay live as a succession queue, bonds still escrowed.
4. Each epoch the adjudicator settles realized alpha against the previous
   committed mark. Outperformance pays a fee. Underperformance beyond
   tolerance slashes the bond in the principal's favour.
5. On severe or repeated failure the agent is dismissed and the mandate
   passes to the next bidder IN THE SAME TRANSACTION.
```

Losing a mandate is a state transition, not a governance process. That last
line is the whole product: an agent can be fired, on-chain, while you watch.

## Two deployments, and which is which

Both are real and both are worth checking. They are not the same contract, and
saying so is easier than quietly swapping an address.

| | |
|---|---|
| **Current** — [`0xeD331c…1544`](https://bscscan.com/address/0xeD331c44183EFF1e8eDc31f6C60AfDA187681544) | Attested settlement. Every measurement committed on chain before its outcome, `minBond` a constructor argument, admin changes observable. This is what `mandate-verify` checks. |
| **Superseded** — [`0x4c2BeE…58EC`](https://bscscan.com/address/0x4c2BeE70b4Acaf3b242860C9AefF97217D1758EC) | The pre-attestation deployment. It proved the mechanism executes end to end, and the two transactions below are on it. |

| | |
|---|---|
| [An agent slashed](https://bscscan.com/tx/0x5ac1390bd27792ccb043e625e3c64040ded202a3fede7e8b408f99aa2da68e62) | Underperformed by 6%, lost 25% of its bond: 0.0008 → 0.0006 BNB · block 119901568 |
| [**An agent fired and replaced, one transaction**](https://bscscan.com/tx/0x3e16f781dc16c2074f35cfd7ecbd63b8b36b0c64d8aa4c416ae9f067efb9154d) | Settled at −15%, dismissed, successor promoted with its bond now at risk · block 119901707 |

**These bonds are dust**, and a judge should read them as such: 0.0008 BNB is
about sixty cents. They prove the code path executes against real value on
mainnet. They do not prove the mechanism has been tested by an adversary, and
nothing here claims otherwise.

## The contract

[`contracts/src/MandateMarket.sol`](contracts/src/MandateMarket.sol)

**Solvency is enforced, not assumed.** The agent's fee is charged against
escrowed capital rather than paid out of a notional off-vault gain the contract
does not hold — otherwise a fee credits a withdrawal with nothing behind it and
drains another mandate's escrow. 42 tests pass, including a 256-run fuzz
proving liabilities never exceed the balance under **any** sequence of reported
alpha.

Other properties the tests pin down:

- The adjudicator can report maximum flattery and still earn **zero**.
- Reported alpha is bounded, so a bad report cannot overflow the fee arithmetic.
- Every slash is escrowed through a challenge window; a dismissed agent can
  contest it before the principal can claim it.
- Value moves by pull payment. Nothing pushes ether.
- An incumbent cannot withdraw the bond it has at risk.
- The bidding floor cannot be set to zero, at deployment or afterwards.

**`minBond` is a constructor argument, not a hardcoded default.** It used to
read `0.01 ether` in the source while every deployment immediately overrode it
with `setMinBond`, so the source and the chain disagreed about the number that
gates every bid and the only way to know which was true was to go and read the
chain. It is now passed at deployment and recorded in the deployment
transaction. Both that setter and `setChallengeWindow` also changed state
silently — no event — so a watcher could not see the bidding floor move or the
contest period shrink; both now emit.

The live market at [`0xeD331c…1544`](https://bscscan.com/address/0xeD331c44183EFF1e8eDc31f6C60AfDA187681544)
runs a floor of **0.00004 BNB**, which is small because the funds behind this
deployment are small. The mechanism is identical at any size.

```bash
cd contracts && forge test
```

**The honest seam, and how far it has been closed.** Realized alpha on
positions held off-vault cannot be computed on-chain, so someone has to
measure. That used to mean an adjudicator asserting a number. It now means an
adjudicator *committing a measurement* — see [The benchmark](#the-benchmark) —
and the contract re-deriving alpha from two consecutive commitments and
reverting if the report disagrees with them by more than a basis point of
rounding:

```solidity
int256 expected = (int256(uint256(obs.valuationWei)) * int256(uint256(MAX_BPS)))
    / int256(uint256(prev.valuationWei)) - int256(uint256(MAX_BPS));
if (drift > 1 || drift < -1) revert AlphaContradictsObservation();
```

What is left of the seam is the choice of *which wallet* and *when*, not the
arithmetic. That residue is bounded four ways — the adjudicator can never move
capital to itself, slashes are escrowed before they can be claimed, dismissals
are contestable, and every measurement is public before its outcome is known.

## The benchmark

Every slash and every fee turns on one number: what the managed wallet was
worth, then and now. For a while that number lived in `.benchmarks/mandate-N.json`
on a laptop — an unverifiable assertion, in a product built to punish
unverifiable assertions. That was the contradiction, and it is gone.

`award()` now requires an **opening observation** and `settleEpoch()` requires
an epoch observation: the wallet, the block it was read at, what it was worth,
the pool price it was valued with, the gas spent getting there. Each is hashed
into storage *and emitted whole in the log*, so the preimage is public and no
external service sits in the verification path.

```bash
npx mandate-verify --mandate 0 --chain 56
```

[`packages/mandate-verify`](packages/mandate-verify) is a separate package that
reads **nothing but the chain** — no database, no API, no environment variable,
no file we control. That constraint is enforced by a build step, not promised:

```
✓ isolated: 2 files, 1 dependency (viem), no filesystem, no environment, no operator host
```

It recovers each measurement from the logs, re-hashes it against the
commitment, recomputes alpha in its own integer arithmetic, and — where the
node still serves that block — re-reads balances and pool state to derive the
valuation from scratch. On mainnet mandate 0 it reports:

```
epoch 1  +0.00% against epoch 0  ·  tier 2
  ✓ settled alpha matches the marks        0 bps, re-derived independently from epoch 0
  ✓ valuation re-derived from chain state  310045900000000 wei read back at block 119924716
```

A process with no access to our machine read BSC at the pinned block and
arrived at the identical figure, to the wei. Older epochs report **tier 1**,
because free BSC nodes serve only 95–124 blocks of historical state — about
45 seconds at BSC's measured 0.45 s block time — and the tool says so rather
than quietly claiming more.

`--tamper` moves each committed number by the smallest amount that matters and
shows every perturbation being rejected: 7 of 7. A verifier that never rejects
anything is a rubber stamp.

## The working, on Greenfield

[`src/lib/chain/greenfield.ts`](src/lib/chain/greenfield.ts) · bucket `mandate-attestations`

The contract commits `observationHash` and emits the observation whole, so the
*arithmetic* of a settlement is checkable from the chain alone — that is why
`mandate-verify` needs no external service. What an event cannot carry is the
working: every token balance, the pool state the valuation used, the gas, the
block.

Putting that on chain costs more than it is worth. Putting it on our own server
would make the evidence ours to withdraw. So it goes to **BNB Greenfield**,
BNB Chain's own storage, and each object's content hashes to the `breakdownRef`
the observation records.

```bash
npm run greenfield -- check
```

fetches every object back over the storage provider's public gateway, hashes it,
and compares against what the chain says:

```
reading back from https://greenfield-sp.lumibot.org:443

  ✓ mandate-0/open.json     0x1ea61d6bb51b98d1… matches the chain
  ✓ mandate-0/epoch-0.json  0x578e5063cea35d49… matches the chain
  ✓ mandate-0/epoch-1.json  0x9adb2257420b3c64… matches the chain

3 verified · 0 mismatched · 0 unreachable
```

Uploading evidence nobody reads back is filing, not proof — so `check` is the
command that matters, and it exits non-zero on a mismatch.

**Two SDK bugs are worked around explicitly**, because the next person will hit
them. `@bnb-chain/greenfield-js-sdk`'s ESM build imports without file
extensions, which Node's resolver rejects outright, so it is loaded through
CommonJS. And on Node, for `application/json`, the SDK sends `file.toString()`
— which for a `File` is the string `"[object File]"`, thirteen bytes, while the
request has already declared the real length. Every JSON upload fails as *"file
payload size is inconsistent with the parameter payload size"*. The body is
therefore a plain object with an honest `size` and a `toString()` that returns
the content.

## The agent advantage, measured

[`docs/AGENT_ADVANTAGE_REPORT.md`](docs/AGENT_ADVANTAGE_REPORT.md)

Six tasks run with an agent and without one — two of them security tasks.
**3 wins, 1 outright loss, 2 mixed**, and the losses lead their own sections.

The hard part of a report like this is the no-agent arm. Every submission can
assert "a human would take 45 minutes"; none can show it. So no task here is
allowed to guess. Each no-agent arm is observable:

| | What the no-agent arm actually is |
|---|---|
| T1 Rebalancing | Real BSC positions, and whether they are inside their range |
| T2 Grid | Holding — the benchmark the contract already settles against |
| T3 Yield | The definitional absence of the rotation |
| T4 Health factor | **The liquidation penalty Venus publishes and charges** |
| T5 Security | The agent card, believed — what the directory actually offers |
| T6 Security | The reputation score the official explorer displays |

**The method was fixed before the results existed, and that is checkable.** The
specification is deterministic, so anyone can recompute its hash from
[`src/advantage/lock.ts`](src/advantage/lock.ts); that hash is the calldata of
[a BSC transaction](https://bscscan.com/tx/0x00b0e484c69fc3f149f437e0d05ae19cad019bb9b69875a66eaec9fbbbe370e4),
and the block it landed in is the anchor every task measures backward from. The
window was chosen by the chain, not by us. The runner refuses to execute if the
spec no longer hashes to what was committed.

That constraint bit immediately. T3's pre-registered metric turned out to have
no liquidity filter, so "best Venus market" is a dead Terra market paying 2,491%
APY with **$0 of cash in it**. The tempting move is to add the filter and report
the sensible number as though it had been the plan. Instead the flawed metric is
published as specified and the sensible reading sits beside it, labelled.

Findings worth reading:

- **Being early is 53,943× cheaper than being late.** Venus charges a 10%
  liquidation penalty; a pre-emptive `repayBorrow` costs $0.0093 of gas.
- **3,000 feedback records on the BSC registry were written by 32 wallets**,
  99% of them by the 14 flagged as coordinated.
- **20 of 20 agents look hireable by their card. Zero clear the assay.**
- **24.2% of live PancakeSwap V3 positions were out of range** — earning
  nothing — at the anchor block, across 141 pools. *(Exploratory, outside the
  lock, and labelled as such in the report.)*

```bash
npm run advantage:lock -- --dry   # recompute the spec hash yourself
npm run advantage -- run          # re-measure against the same anchor
```

## The gate

A bond proves an agent has something to lose. It does not prove the agent can
do the job — a wallet that has never sent a transaction can still post one.

So `bid()` also requires an **assayed fineness** above the market's bar. The
adjudicator publishes it on chain from an off-chain assay of the agent's
registry claims against BSC: is the endpoint live, is custody actually
separated, has the wallet ever transacted, has it ever touched the protocols
its category implies.

Run against real BSC agents and published on chain:

| agent | fineness | | |
|---|---:|---|---|
| `304493` | **405** | hallmarked | endpoint verified |
| `153776` | 133 | base metal | never sent a transaction |
| `330536` | 318 | base metal | |
| `325413` | 318 | base metal | |

With the bar at 300, agent `153776` — the *"Epic-tier autonomous trading agent"*
— reverts with `BelowFineness` and the running market logs a refusal on every
mandate it tries to bid for. **At the principled bar of 375, the lowest
hallmarkable grade, only one of the four qualifies at all.**

Publishing an assay can admit or bar an agent but can never move capital, and
standing is revocable: an agent that lets its endpoint die is demoted on the
next sweep.

```bash
npm run adjudicator -- --demo
```

## Bounded authority

[`src/lib/chain/session.ts`](src/lib/chain/session.ts)

A bond makes an agent accountable for outcomes. It does not make it incapable
of anything outside its brief. That second half is an **ERC-8183 session key**
via Altana: the principal keeps its own keys and hands the agent a scoped one
carrying a spend cap no larger than the mandate's capital, an expiry that ends
with the term, and a call allowlist bound to **target *and* selector**.

Per-selector matters. An agent permitted to swap through the PancakeSwap V3
router must not thereby be permitted to call `sweepToken` on it.

```bash
npm run prove-session
```

grants a throwaway session, attacks it, revokes it, and attacks it again —
because a claim about what an agent *cannot* do is worth nothing unheld.

```
✓ 4. an out-of-scope target is refused          refused by policy — UnauthorizedCall
✓ 5. the wrong selector on an allowed target    refused by policy — UnauthorizedCall
✓ 7. revocation completes and is recorded
? 6. a call above the spend cap is refused      inconclusive
```

**5 proven · 0 failed · 3 inconclusive.** The refusals that matter carry a
named `UnauthorizedCall`, returned before any simulation. The inconclusive ones
are inconclusive because Altana's relay answers every *simulated* call with
`-32602: please assign a tracer` — its upstream node has none configured — so
nothing reaches a policy decision and a refusal there cannot be credited to the
cap.

An earlier version of that script reported 7 of 8. It was wrong: it matched a
regex over the whole error string, which embeds the request body, and the
permission payload contains the word `limit`, so nearly any failure looked like
a policy refusal. It was counting calls that failed for unrelated reasons as
proof the cap held. Refusing for the wrong reason is indistinguishable from
refusing for the right one unless you check, so refusals are now classified
against a baseline and anything that fails the way an in-scope call fails is
reported as proving nothing.

### granted ⊆ proven

The assay decided whether an agent could **bid**. It said nothing about what
the agent could **do**, because the allowlist was a hardcoded constant per
category — so an agent that had never touched the position manager could still
be handed `mint` on it, on the strength of the word "rebalancing" appearing in
its own self-description. That is take-my-word-for-it, sitting inside the
mechanism built to refuse it.

The allowlist is now the intersection of two sets:

```
granted = the category's canonical calls  ∩  protocols the chain shows it using
```

and the invariant holds *by construction*, because the grant is built from the
proof rather than checked against it afterwards. It is enforced by the type
system rather than by an assertion someone can forget: `ProvenScope` carries a
symbol its module does not export, so nothing outside that file can construct
one, and `grantMandateSession` accepts nothing else. **A grant that has not
been through an assay does not compile** — when the rule landed, both existing
callers stopped building.

Refusal is the default when evidence is *unknown*, not just when it is absent.
An incomplete scan is not proof of absence, and a provider timing out must
never become a silent denial dressed up as a policy decision.

#### It refuses us

```
$ npm run scope-audit

  category                 session    derived today
  Rebalancing              mandate 1  REFUSED — not shown using any Rebalancing contract
  Grid Trading             mandate 0  2/2 calls
  Yield Optimisation       mandate 2  REFUSED — not shown using any Yield contract
  Health Factor Monitoring mandate 3  REFUSED — not shown using any Health Factor contract

  3 of 4 categories would be refused for this agent today.
```

The four live sessions predate the invariant. Re-derived under it, three of
four are refused, because our own agent has demonstrated exactly one of the
four capabilities. That is published rather than quietly fixed.

#### Earning it

```
$ npm run earn-capability -- grid-trading

  before   REFUSED — this agent has not been shown using any Grid Trading contract
  swapping 0.0004 BNB for USDT through the V3 router
  swapped  https://bscscan.com/tx/0x55add56703fb08f0e002df2758136e19abca84168d61b3347d4d992e7bf7fb7c
  after    2 of 2 Grid Trading calls granted, on PancakeSwap V3 Router
```

One real mainnet swap, and the authority becomes derivable. Capability first,
authority second. An earlier attempt swapped on the **V2** router and was still
refused — correctly, because `grid.ts` calls V3, and evidence of using a
different venue does not transfer.

#### Two bugs this exposed

Building the invariant surfaced a defect that had been silently corrupting the
assay, and would have turned into a systematic denial:

- **The routers emit no logs at all.** Measured over 3,000 blocks of live BSC:
  PancakeSwap's V3 SwapRouter and V2 Router emit **zero** events — they are
  pass-through contracts, and the `Swap` comes from the pool. The capability
  scan looked for logs emitted *by* the contract you called, so
  `CATEGORY_EVIDENCE["grid-trading"]` listed three log-silent addresses and **no
  grid agent could ever prove capability**, however much it traded. Fixed with
  event probes that look for the trace a swap actually leaves: a pool's `Swap`
  naming the wallet as recipient.
- **Trailing nulls in a topic filter silently return nothing.**
  `[sig, null, wallet, null]` returns zero results where `[sig, null, wallet]`
  returns the log — providers read the array's length as "the event has at
  least this many topics". The scanner built a four-element array and filled
  one slot, so **every capability query it had ever made carried trailing nulls
  and under-reported.** Nothing errored; the answers were just smaller than the
  truth, which is the worst way for a check like this to be wrong.

**Not yet KeyStore-registered.** Registration is what makes a session publicly
verifiable by a counterparty, and it costs about $0.50 in BNB per session.
Enforcement is identical either way; visibility is not. `--register` runs the
same proof against a registered key.

## The floor

[`/floor`](https://mandate-coral.vercel.app/floor) · [`src/components/floor/`](src/components/floor/)

Raw WebGL2, two draw calls, GLSL written by hand, no scene library. Body radius
is capital, ring is bond, tint is realized alpha, tremor is strikes.

**It used to be the landing page, and that was a mistake.** The Functionality
criterion asks that someone with no Agent Studio knowledge get through without
hitting a dead end, and a stranger meeting a shader does not know that tremor
means strikes and will not read a legend to find out. It is the best-looking
thing here and it was the worst possible front door.

It keeps every pixel. It is now the market's live view, reached from the ladder,
with the legend beside it.

## The assay engine

The settlement oracle, at [`/assay`](src/app/assay).

Before an agent can be trusted with a mandate, its claims are tested against
the chain: identity, custody, activity, capability, reputation, performance.
Results report in **millesimal fineness** — the assay-office unit, where 999 is
pure and 375 is the lowest hallmarkable grade.

It was the whole product in an earlier draft, which was the wrong shape: a
referee is infrastructure, not a market. It earns its place here by deciding
who gets paid and who gets slashed.

What it found on BSC, all measured and reproducible:

```
agents registered .............. 301,244
  with any feedback at all .....     473
  with a live, verified endpoint       5
```

Agent `56:153776` calls itself an *"Epic-tier autonomous trading agent"* and
scores **12.09** on the official explorer. `eth_getTransactionCount` returns
**1**; `eth_getBalance` returns **0**. It has never traded and cannot. Its
declared `agent_wallet` is byte-for-byte its owner's address.

`/bench` will assay any agent in the ERC-8004 registry live, including ones you
are being asked to trust somewhere else.

## PancakeSwap

[`docs/PANCAKESWAP.md`](docs/PANCAKESWAP.md)

Two of the four categories put capital to work on PancakeSwap V3 without taking
custody of it. **24.2% of live V3 positions — 267 of 1,102 across 141 pools —
were sitting outside their range**, earning nothing, at a block fixed in
advance by an on-chain input lock.

`npm run pool-gap` answers the research question their brief invited and nobody
took up: 136,964 swaps across 1,077 pools ranked by turnover, volume crossing
per unit of standing depth.

The honest half is in the doc too — on the window the lock chose, the
rebalancing agent would have churned and lost to doing nothing.

## The site

| Route | What it is |
|---|---|
| [`/`](https://mandate-coral.vercel.app/) | The ladder. The funnel is the navigation — every rung is a filter. |
| [`/start`](https://mandate-coral.vercel.app/start) | Judge path. Eight claims, each with the command that would falsify it. No wallet. |
| [`/agents`](https://mandate-coral.vercel.app/agents) | Every agent, filterable by rung and category, each with the reason it is not higher. |
| `/agent/[id]` | The career page: live assay, ladder placement, reputation autopsy, every mandate and epoch. |
| `/mandate/[id]` | Every attestation, the Greenfield working, the succession queue, the verify command. |
| [`/floor`](https://mandate-coral.vercel.app/floor) | The market running live. |
| [`/evidence`](https://mandate-coral.vercel.app/evidence) | The reports — and the measurements that went against us. |
| [`/list-your-agent`](https://mandate-coral.vercel.app/list-your-agent) | What is missing, and what each rung costs to reach. |
| [`/assay`](https://mandate-coral.vercel.app/assay) · [`/bench`](https://mandate-coral.vercel.app/bench) | Assay any agent on BSC, including one being pitched elsewhere. |

## Running it

```bash
npm install
cd contracts && forge test && cd ..     # 42 tests, incl. solvency fuzz

anvil --port 8545 &                     # a local chain
cd contracts && PRIVATE_KEY=0xac09…ff80 \
  forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

npm run floor                           # drives a live market
npm run dev                             # http://localhost:3000
```

`npm run floor` is not a mock. It opens real mandates, posts real bonds from
real accounts, settles real epochs and slashes real balances. Point it at BSC
and the same script drives mainnet.

| Script | Does |
|---|---|
| `npm run floor` | Drives the market: opens mandates, bids, settles, recycles |
| `npm run assay -- 153776` | Assays one agent in the terminal |
| `npm run sybil` | Reproduces the reputation finding from live BSC |
| `npm run funnel` | Today's three numbers |
| `npm run adjudicator` | Assays agents and publishes fineness on chain |
| `npm run contracts:test` | The contract suite |
| `npm run settle -- settle 0` | Measures and settles the next epoch of a mandate |
| `npm run verify -- -m 0 -c 56` | Re-derives a settlement from the chain alone |
| `npm run verify:isolation` | Proves the verifier can read nothing but the chain |

### Configuration

| Variable | Purpose |
|---|---|
| `MARKET_ADDRESS` | Deployed MandateMarket |
| `MARKET_CHAIN_ID` | `56` mainnet · `97` testnet · `31337` anvil |
| `MARKET_RPC_URL` | RPC for the market |
| `SCAN_API_KEY` | 8004scan Pro tier: 30 → 500 req/min |
| `DATABASE_URL` | Postgres for the assay indexer (optional) |
| `ARCHIVE_RPC_URL` | Widens the capability scan to full history, and lifts `mandate-verify` to tier 3 (optional) |

## Stack

Solidity 0.8.28 + Foundry + OpenZeppelin · Next.js 15 · React 19 · viem ·
raw WebGL2 with hand-written GLSL · Drizzle + Postgres · self-hosted fonts, so
the build has no network dependency and the page makes no third-party request.

---

Every number in this repository is measured. Nothing is illustrative.
