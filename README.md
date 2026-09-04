# ASSAY

**The assay office for on-chain agents.**
Built for *The Smart Money Era* — BNB Chain, main track.

---

```
BSC agents registered ............ 301,207
  with any feedback at all .......     473
  with a live, verified endpoint ..      5
```

Those are not projections. Run `npm run funnel` and you will get today's numbers.

An assay is the metallurgical test that determines whether ore is actually
precious metal. ASSAY is the marketplace where every agent is tested against
BNB Smart Chain before it is listed — registry claim on one side, chain truth
on the other, and the evidence attached to both.

## Why this and not a directory

The brief asks for a marketplace where you can browse agents, see how they have
performed, and put them to work. The obstacle is that the underlying registry
does not support any of those three verbs.

Take agent `56:153776`. It is named *"BORT Governance Lens #10923"*, describes
itself as an *"Epic-tier autonomous trading agent"*, and carries a score of
**12.09** on the official explorer. Two RPC calls settle it:

```
eth_getTransactionCount → 0x1   (one transaction, ever)
eth_getBalance          → 0x0   (no BNB)
```

It has never traded. It cannot trade. Its declared `agent_wallet` is byte-for-byte
its owner's address, so the self-custody is a label rather than an arrangement.

That is not one bad apple. It is the median listing. A marketplace that renders
`total_score: 12.09` as though it were true is a directory of 301,202 things
that do not work, with a search box.

**BNB Chain cannot adopt that as "the canonical front door."** Their own judging
criterion — *"real-time, accurate data that goes beyond basic counts"* — says so
out loud. So ASSAY is not a better directory. It is the verification layer that
makes a directory possible.

## The assay

Six tests. Each returns evidence, never an opinion, and every figure on every
page links to the transaction that proves it.

| Assay | Question | Ground truth |
|---|---|---|
| **Identity** | Does the endpoint resolve and answer? | 8004scan probe + declared services |
| **Custody** | Is `agent_wallet` actually distinct from the owner? | Registry detail vs chain |
| **Activity** | Has it ever sent a transaction? | `eth_getTransactionCount`, `eth_getBalance` |
| **Capability** | Does it touch the protocols its category implies? | `eth_getLogs` against PancakeSwap / Venus / Aave |
| **Reputation** | Is its feedback organic or manufactured? | Reviewer graph over the Reputation Registry |
| **Performance** | Did it beat doing nothing? | Settled position history vs hold counterfactual |

### Fineness, not another trust score

Results report in **millesimal fineness** — the real assay-office unit, where
999 is pure and 375 is the lowest grade that may legally carry a hallmark.
"This agent is 133 fine." A **hallmark** is struck only on what passes.

Absence of evidence counts as impurity. An assay office does not grade unproven
metal, and neither does this one.

### The reputation finding

The ERC-8004 Reputation Registry lets any address leave feedback on any agent
for the price of gas. Pulling 4,500 BSC feedback records and tracing them to
their authors:

```
records analysed ............ 4,500
distinct reviewer wallets ...    53
flagged as coordinated ......    32
records surviving cleaning ..    34   (0.76%)
```

Detection runs on four signals — self-review, near-identical activity
cardinality across distinct wallets, co-review Jaccard overlap, and machine
submission cadence. Every flag records *why* it fired; nothing is a black box,
because the entire product depends on you being able to check our work.

This reproduces, independently and live, the finding in Xiong et al.,
[*Can Trustless Agents Be Trusted?*](https://arxiv.org/abs/2606.26028)
(arXiv:2606.26028v2) — 59.2% of BSC reviewers Sybil, 77.9% of rated agents left
with nothing after cleaning.

### The bench

`/bench` accepts **any** agent ID in the ERC-8004 registry and streams the six
tests against it live over SSE. It does not have to be one of ours — including,
pointedly, agents you are being asked to trust somewhere else.

## Running it

```bash
npm install
npm run snapshot        # measure the chain; writes src/data/snapshot.json
npm run dev             # http://localhost:3000
```

Nothing above needs a database or an API key. The site renders from a committed
snapshot of real measurements, so it builds offline and stays up when 8004scan
is down — which, measured, it sometimes is.

```bash
npm run assay -- 153776     # assay one agent in the terminal
npm run sybil               # reproduce the reputation finding
npm run funnel              # today's three numbers
npm run shots               # screenshot the running site
```

### With infrastructure

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres. The indexer writes here; the app reads it in preference to the snapshot. |
| `SCAN_API_KEY` | 8004scan Pro tier. Lifts 30 req/min → 500 req/min. |
| `CHAIN_ID` | `56` mainnet, `97` testnet. **This is the entire mainnet cutover.** |
| `ARCHIVE_RPC_URL` | Optional. Widens the Capability scan from a recent window to full history. |

```bash
npm run db:push         # create tables
npm run worker          # continuous indexer (Railway)
```

## Architecture

```
Railway (always-on)          Postgres                  Vercel
┌──────────────────┐         ┌──────────────────┐      ┌─────────────────┐
│ indexer          │────────▶│ agents           │◀─────│ Next.js app     │
│ • registry crawl │         │ feedbacks        │      │ • marketplace   │
│ • BSC RPC probe  │         │ reviewers        │      │ • certificates  │
│ • assay engine   │         │ reviewer_edges   │      │ • the bench     │
│ • sybil graph    │         │ stats, cursors   │      │   (SSE, live)   │
└──────────────────┘         └──────────────────┘      └─────────────────┘
```

The web app never calls an upstream on the request path. At 30 req/min against
301,207 agents, server-side materialisation is not an optimisation — it is the
only shape that works.

## What is honest about the limits

- **The Capability window is recent, not lifetime.** No free BSC provider serves
  deep history: measured caps are 50 blocks (1rpc), ~2,000 (publicnode) and
  10,000 (drpc), and anything wider is refused as an archive request. So the
  assay asks what the free tier can actually answer — *has it acted recently* —
  which is the sharper question anyway, since every one of these agents claims
  to run continuously. `ARCHIVE_RPC_URL` widens it to a lifetime lookback.
- **A refused scan is recorded as `inconclusive`, never as a failure.** An agent
  is never marked down for our provider's limits.
- **Performance returns `inconclusive` for agents without settled position
  history**, rather than estimating a number we cannot evidence.
- **The registry ships no categories.** `categories: []` for every BSC agent, so
  all four required categories are classified from each agent's own description,
  and the Capability assay then independently checks whether the chain agrees
  with the label. Classification is shown with its matched terms, never hidden.

## Stack

Next.js 15 · React 19 · TypeScript · Drizzle + Postgres · viem · canvas
(no charting library) · self-hosted fonts, so the build has no network
dependency and the page makes no third-party request.

---

Registry data from [8004scan](https://8004scan.io) · chain data from public BSC
RPC · every number reproducible from this repository.
