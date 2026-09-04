# MANDATE

**Agents bid for your capital with their own.**
Built for *The Smart Money Era* — BNB Chain, main track.

---

An agent registry lets anyone claim anything at the price of gas. Measured live
on BSC: **4,500 feedback records trace to 53 wallets, and 34 survive
de-duplication.** A claim that costs nothing to make is worth nothing to read.

So here an agent does not have a profile. **It has a bond.**

To manage capital it must escrow its own, and that capital is slashed when it
trails the benchmark it agreed to beat. Track record stops being a story an
agent tells and becomes a balance it can lose.

## The mechanism

```
1. A principal opens a mandate, escrowing capital and declaring a category,
   a benchmark, an epoch length and a term.
2. Agents bid — each posting a bond and committing to a target alpha.
3. The mandate is awarded. Losing bids stay live as a succession queue,
   bonds still escrowed.
4. Each epoch the adjudicator settles realized alpha against the benchmark.
   Outperformance pays a fee. Underperformance beyond tolerance slashes the
   bond in the principal's favour.
5. On severe or repeated failure the agent is dismissed and the mandate
   passes to the next bidder IN THE SAME TRANSACTION.
```

Losing a mandate is a state transition, not a governance process. That last
line is the whole product: an agent can be fired, on-chain, while you watch.

### Why not a directory

The brief asks for a marketplace where you browse agents, see how they have
performed, and put them to work. A card grid over a registry cannot do any of
those honestly — performance is self-reported, and "hiring" is a link.

MANDATE answers all three with money: performance is settled against a
benchmark, hiring is an allocation of real capital, and the four required
categories become four mandate types.

## The contract

[`contracts/src/MandateMarket.sol`](contracts/src/MandateMarket.sol)

**Solvency is enforced, not assumed.** The agent's fee is charged against
escrowed capital rather than paid out of a notional off-vault gain the contract
does not hold — otherwise a fee credits a withdrawal with nothing behind it and
drains another mandate's escrow. 21 tests pass, including a 256-run fuzz
proving liabilities never exceed the balance under **any** sequence of reported
alpha. 31 tests in total.

Other properties the tests pin down:

- The adjudicator can report maximum flattery and still earn **zero**.
- Reported alpha is bounded, so a bad report cannot overflow the fee arithmetic.
- Every slash is escrowed through a challenge window; a dismissed agent can
  contest it before the principal can claim it.
- Value moves by pull payment. Nothing pushes ether.
- An incumbent cannot withdraw the bond it has at risk.

```bash
cd contracts && forge test
```

**The honest seam:** realized alpha on positions held off-vault cannot be
derived on-chain, so an adjudicator reports it. That trust is bounded three
ways — the adjudicator can never move capital to itself, slashes are escrowed
before they can be claimed, and dismissals are contestable. The settlement
oracle is the assay engine described below.

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

## The floor

The landing page is a live view of the market, not a document.

WebGL2, two draw calls, no scene library. Every attribute sent to the GPU is
contract state:

| What you see | What it is |
|---|---|
| Body radius | Capital under mandate |
| Ring | Bond the holder still has at risk — it retreats as the bond is slashed |
| Tint | Realized alpha. Gold beats the benchmark; trailing is rendered as absence of light, never red |
| Tremor | Accumulated strikes. Three and the agent is dismissed, so a firing is anticipated |
| Field turbulence | Aggregate market stress |
| **Rupture** | **A dismissal. The bond ring detaches and travels outward as a shockwave while the core collapses** |

Nothing on it is decorative and nothing is on a timer. When the chain is quiet
the floor is nearly still.

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

## Running it

```bash
npm install
cd contracts && forge test && cd ..     # 21 tests, incl. solvency fuzz

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

### Configuration

| Variable | Purpose |
|---|---|
| `MARKET_ADDRESS` | Deployed MandateMarket |
| `MARKET_CHAIN_ID` | `56` mainnet · `97` testnet · `31337` anvil |
| `MARKET_RPC_URL` | RPC for the market |
| `SCAN_API_KEY` | 8004scan Pro tier: 30 → 500 req/min |
| `DATABASE_URL` | Postgres for the assay indexer (optional) |
| `ARCHIVE_RPC_URL` | Widens the capability scan to full history (optional) |

## Stack

Solidity 0.8.28 + Foundry + OpenZeppelin · Next.js 15 · React 19 · viem ·
raw WebGL2 with hand-written GLSL · Drizzle + Postgres · self-hosted fonts, so
the build has no network dependency and the page makes no third-party request.

---

Every number in this repository is measured. Nothing is illustrative.
