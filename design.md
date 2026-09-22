# Mandate: the design specification

`docs/REBUILD-PLAN.md` is the parent of this file. That one says what the product is. This one says what it looks like, and it is the file a design critique is run against.

The category is **the assay office and clearing house for on-chain agents**. App Store is the shape. The London Assay Office is the trust model. Hyperliquid is the density. Stripe is the receipt.

We are not a fan site for a chain. Built on BNB Chain appears once, in the footer.

## 1. The three verbs

Every screen is one of three things. If a screen cannot be described with one of these verbs, it is documentation and it belongs under `/evidence`.

1. **See** the wallet, the job, the agent, the chain.
2. **Try** free, in the browser or as a dry run on a pasted wallet. No key, no signature.
3. **Mandate** a leash, an optional bond, a payment. One signature. Revoke is on screen afterwards.

## 2. Colour

Ink is the default canvas. Paper is a scope, not a theme toggle: it is what a receipt and a certificate are printed on.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0C0B0A` | Default canvas. Warm black, not blue black |
| `--steel` | `#1C1B19` | Panels on ink |
| `--paper` | `#F4F0E8` | Receipts, certificates, print |
| `--hairline` | `rgba(244,240,232,0.10)` | Borders on ink |
| `--hallmark` | `#C9A227` | Marks, key numbers, the wordmark underline. 22k gold |
| `--live` | `#3DDC97` | Endpoint up, session live |
| `--dead` | `#E34D4D` | Unreachable, disputed, stolen |
| `--mute` | `#8A8478` | Secondary copy |

Rules:

- **`#F0B90B` is not a colour in this system.** BNB yellow reads as a fan site. It may appear only inside a 12px network chip that says BSC, and nowhere else.
- **Gold is not an accent.** It marks hallmarks, key figures and the wordmark rule. A gold button would turn the whole page into a chain skin.
- **The primary action is paper on ink.** A light solid button on a dark ground. This is the single most recognisable thing about the system.
- **Status colour carries status only.** Green means we checked it and it is up. Red means unreachable, disputed or stolen. Neither is decoration.
- Contrast is tested, not assumed. Every foreground on every ground is computed at 4.5:1 or better in `tools/audit.mjs`.

## 3. Type

Already correct and self-hosted. Do not churn it.

| Role | Face |
|---|---|
| Display | Instrument Serif. Wordmark, certificate titles, empty state headlines |
| Sans | IBM Plex Sans. UI chrome, body |
| Mono | IBM Plex Mono. Blocks, token ids, hashes, ticks, fineness, money |

Why a serif: every competitor is Inter. An assay office issues certificates, and certificates are serif. The wordmark on ink should look letterpressed.

**Mono is mandatory** for any block number, token id, transaction hash, tick, fineness figure or money amount. A hash is never truncated without a copy control next to it.

## 4. Scales

| Scale | Values |
|---|---|
| Space | 4, 8, 12, 16, 24, 32, 48, 64, 96 |
| Breakpoints | `sm` 560, `md` 860, `lg` 1180, `xl` 1400. Mobile first, `min-width` only |
| Radius | 0 on certificates, hashes and tables. 8px on cards and inputs. 999px only on the network chip |

## 5. Motion

120 to 180ms, `ease-out`. Exactly three motions ship:

1. Numbers tick.
2. The hallmark stamps, 12 frames.
3. The receipt sheet slides in from the right.

No page transitions, no bounce, no gradient blobs, no particles, no 3D hero. Everything respects `prefers-reduced-motion`.

## 6. Density

Linear grade. More information per screen than a marketing site, less prose than a research note. A judge should understand a page in four seconds of scanning, not four minutes of reading.

## 7. Information architecture

```
/                        two doors and the funnel instrument
/jobs                    four rooms, identical depth
  /rebalance /grid /yield /guard
  /rebalance/gaps        the pool gap scanner
/agents                  catalogue. Filters: Hireable, Live, Priced, Hallmarked, Graveyard
  /[tokenId]             passport: claim vs chain vs tools
/diagnose                paste or connect, the wallet door
/desk                    keys, caps, expiry, revoke, fills
  /demo                  the published demo address, so a judge never connects
/activity                the live tape
/receipts/[id]           paper certificate of one job
/certificate/[tokenId]   paper certificate of one assay
/proof                   the advantage lab, re-runnable
/graveyard               paid, failed, disputed. Permanent
/list                    the seller ladder, self serve
/status                  the beats as instruments
/judges                  the 90 second path
/evidence                method, restatement, threat model
```

Top navigation, always visible: **Mandate** · Jobs · Agents · Desk · Activity · Search · Connect.
Secondary behind a `···`: Diagnose, Proof, Graveyard, List, Status, Evidence.

Footer only navigation is banned.

## 8. Components

If it is not on this list, it does not ship in v1.

**Primitives:** Button, IconButton, Input, AddressInput, Tabs, Sheet, Dialog, Tooltip, Toast (rare), Table.

**Domain:** `Hallmark` punch, `Fineness` meter, `Funnel` instrument, `SourceChip`, `JobMark`, `AgentCard`, `HireableState`, `LeashCard`, `Receipt`, `TapeRow`, `BlockAge`, `NetworkGate`, `WrongRailNotice`, `EmptyState`.

### SourceChip

The hardest rule in the system and the one that makes the product credible: **every number on screen carries its source.** Chain, probe, 8004scan or house. Hover or focus reveals the block it was read at and how old it is. A figure with no source chip is a bug.

### HireableState

One vocabulary, everywhere a button might go:

| State | What the user sees |
|---|---|
| `hire` | A Hire control |
| `try` | A Try control, free, no signature |
| `wrong-rail` | No Hire. The reason, and an agent in the same room we can settle |
| `unreachable` | No Hire, Try disabled, one line saying when it last answered |
| `graveyard` | No Hire. What it took and what it failed to return |
| `reference` | Hire, plus a Reference badge saying we operate it |

Hireable means we can settle. There is no other meaning.

## 9. Copy

- Second person. Short. No "ecosystem", no "seamless", no "cutting edge".
- Buttons are verbs: See, Try, Mandate, Revoke, Diagnose. Never "Get started", "Learn more", "Submit".
- **Losses render in the same type size as wins.** This is a CSS rule, not an intention.
- Empty states teach the next verb. Never "No data".
- No em dashes.
- Third party names and their data are quoted exactly as they gave them, never rewritten.

## 10. The pass or fail list

A design director's check, and the gate in `tools/audit.mjs`:

- [ ] Someone who has never heard of ERC-8004 completes See, Try, Mandate on a phone in under two minutes.
- [ ] A real top navigation exists.
- [ ] Every number has a source chip. Hover shows block and age.
- [ ] Hire is never offered on an agent we cannot settle.
- [ ] Losses render in the same type size as wins.
- [ ] 390px wide, no horizontal overflow, 44px tap targets.
- [ ] Keyboard: `/` search, `j` and `k` through a list, `enter` opens, `esc` closes.
- [ ] Wrong network is a full screen intercept, not a toast.
- [ ] Empty states teach the next verb.
- [ ] Certificates and receipts work with scripting off.
- [ ] Contrast at least 4.5:1, computed.
- [ ] No emoji as category icons. Four steel marks.
