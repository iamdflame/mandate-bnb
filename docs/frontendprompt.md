# MANDATE — COMPLETE PRODUCT REDESIGN
## Turn this into a genuinely enjoyable BNB Smart Chain AI-agent marketplace

You are NOT being asked to cosmetically improve the existing website.

You are redesigning the entire product experience.

The current product has strong underlying functionality around:
- ERC-8004 agent discovery
- live endpoint checks
- capability checks
- reputation/evidence
- agent hiring
- x402-style paid calls
- ERC-8183 jobs/mandates
- scoped permissions
- agent bonds
- settlement/performance
- BNB Smart Chain activity

Keep that substance.

BUT the current presentation feels like:
- an editorial research website
- a protocol documentation site
- an onchain methodology paper
- an analyst/research terminal

It does NOT feel enough like:
- an actual marketplace
- an agent store
- a place users want to browse
- a place where users quickly understand what an agent does
- a place where users compare alternatives
- a place where users confidently click “Use”
- a product users would enjoy coming back to

Your job is to fundamentally change that.

The marketplace should feel like a premium intersection of:

- modern crypto marketplace
- AI agent app store
- high-quality SaaS product
- trading terminal
- product discovery platform
- BNB-native onchain application

Do NOT make it look like:
- a blog
- a documentation site
- a generic AI landing page
- a Claude artifact
- a generic SaaS dashboard
- a Web3 template
- a DeFi clone
- a generic “AI agents” neon-purple website


==================================================
1. VERY IMPORTANT — THIS IS A REAL PRODUCT
==================================================

This is a REAL production web application inside the current repository.

DO NOT:
- build a Claude artifact
- use the web-artifacts-builder workflow
- create a single bundled HTML file
- create a prototype disconnected from the current app
- replace the working backend/data integrations with fake data
- throw away current functionality just to make the UI pretty
- hardcode marketplace data that should be live
- replace real onchain data with fabricated numbers

Inspect the current repository first.

Understand:
- framework
- routing
- components
- styling
- data fetching
- blockchain integrations
- contract integrations
- wallet functionality
- existing APIs
- existing agent data
- current responsive implementation

Then redesign the application around those systems.


==================================================
2. THE PRODUCT POSITIONING
==================================================

MANDATE is an agent marketplace for BNB Smart Chain.

The product promise should be immediately obvious:

“Find an agent. See what it can actually do. Put it to work.”

Alternative hero copy:

“Find an agent for the job.”

or:

“Your next onchain worker is already here.”

The product should feel like a marketplace FIRST.

The verification system is the trust layer underneath it.

Do not make “Assay Office” the primary consumer-facing concept.

The phrase can survive inside the Trust / Verification area.

Example positioning:

MANDATE
Agent marketplace for BNB Smart Chain

Discover autonomous agents for:
- Rebalancing
- Grid Trading
- Yield Optimisation
- Health Factor Monitoring

Every agent can surface:
- what it does
- whether it is reachable
- what it costs
- how fast it responds
- what protocols it touches
- what permissions it needs
- what evidence exists
- what performance history exists
- what has actually been checked

The marketplace helps users choose.

The trust layer explains why the information can be trusted.


==================================================
3. CORE UX PRINCIPLE
==================================================

THE USER SHOULD NEVER HAVE TO READ THE PROTOCOL TO UNDERSTAND THE PRODUCT.

The primary journey is:

LAND
↓
UNDERSTAND WHAT MANDATE IS
↓
CHOOSE WHAT YOU NEED
↓
SEE RELEVANT AGENTS
↓
COMPARE
↓
OPEN AGENT
↓
UNDERSTAND PRICE + CAPABILITY + TRUST
↓
USE / HIRE
↓
REVIEW EXACT PERMISSIONS
↓
SIGN
↓
SEE LIVE RESULT

The interface should support this without documentation.

If the user needs a technical explanation, it should be one click away.

Not 600 words of text before the marketplace begins.


==================================================
4. NEW INFORMATION ARCHITECTURE
==================================================

Replace the current protocol-heavy navigation with:

MANDATE logo

Explore
Categories
Activity
My Desk

right side:

Search
List Agent
Connect Wallet

Optional secondary navigation:

Jobs
Trust
Docs

Remove from primary navigation:
- Start
- Offices
- Register
- Floor
- Authority
- Judges
- Method
- Evidence
- API

Those concepts can remain as secondary destinations.

Translate technical concepts into consumer language.

Examples:

“Floor” → “Jobs”
“Authority” → “Permissions”
“Offices” → “Categories”
“Register” → “Agents” or “List Agent”
“Evidence” → “Trust”
“Method” → “How it works”
“Desk” → “My Desk”
“Assay” → “Verification”

“Judges” should NOT be a primary product navigation item.

That sounds like a hackathon page, not a marketplace.


==================================================
5. GLOBAL VISUAL DIRECTION
==================================================

Create a strong visual identity.

Think:

BNB Chain
+
AI agents
+
marketplace
+
onchain activity
+
financial product

The visual mood should be:

dark
precise
energetic
premium
fast
technical
trustworthy
playful enough to feel alive

But NOT:

cyberpunk
neon gamer
purple AI
glassmorphism everywhere
gradient soup
over-rounded SaaS
boring institutional fintech
document/editorial layout


==================================================
6. COLORS
==================================================

Base product palette:

Background:
#0B0E11

Primary surface:
#101419

Secondary surface:
#151A20

Elevated surface:
#1A2027

Borders:
very subtle white/gray transparency

Primary BNB accent:
#F0B90B

Text:
#F5F5F5

Secondary text:
#9299A3

Muted text:
#626A75

Success:
use a clean green

Warning:
BNB yellow

Error:
use a restrained red

IMPORTANT:

Use BNB yellow as an accent.

Do NOT flood the entire UI with yellow.

Yellow should communicate:
- action
- live state
- important metric
- BNB
- selected item
- price
- progress

Do not create purple/blue “AI gradients” as the default aesthetic.


==================================================
7. TYPOGRAPHY
==================================================

The typography must feel like a product, not a blog.

Use a modern high-quality grotesk.

Prefer:
- Geist
- Inter Tight
- Inter
- or another strong modern UI grotesk available in the repository

Avoid:
- Poppins
- generic startup typography
- excessive serif typography
- giant editorial headlines
- monospace for ordinary product content

Monospace may be used for:
- wallet addresses
- contract IDs
- agent IDs
- transaction hashes
- numerical technical values

Typography hierarchy:

Marketplace page:
headline: 40–56px
section title: 24–32px
card title: 16–20px
body: 14–16px
metadata: 12–13px

Do not make every heading enormous.


==================================================
8. LAYOUT PHILOSOPHY
==================================================

Stop using giant editorial whitespace.

The marketplace needs INFORMATION DENSITY.

Desktop:
max-width approximately 1280–1400px.

Use:
- 12-column grid
- compact spacing
- strong alignment
- clear grouping
- dense but breathable cards

The screen should immediately look like a marketplace.

A visitor should see many agents without scrolling forever.

The marketplace is the product.

Do not bury it underneath marketing content.


==================================================
9. HOMEPAGE — REBUILD COMPLETELY
==================================================

The homepage should NOT start with a giant manifesto.

Instead:

TOP NAV

MANDATE

Explore
Categories
Activity
My Desk

Search

List Agent

Connect Wallet


Then HERO:

small eyebrow:

BNB SMART CHAIN · AGENT MARKETPLACE

Headline:

Find an agent.
Put it to work.

Subheadline:

Discover autonomous agents that can manage liquidity, automate trading, optimise yield and protect lending positions — with live onchain signals before you hire.

PRIMARY BUTTON:

Explore agents

SECONDARY:

List your agent


Then the BIG SEARCH COMPONENT:

“What do you want an agent to do?”

Large search bar.

Placeholder examples rotate subtly:

“Rebalance my PancakeSwap LP”
“Monitor my Venus health factor”
“Run a grid strategy”
“Find better stablecoin yield”

Below search:

Quick intent chips:

Rebalance LP
Grid trading
Optimise yield
Protect a loan


==================================================
10. HERO VISUAL
==================================================

Do NOT use:
- generic AI robot image
- stock photo
- human robot illustration
- glowing purple brain
- generic 3D orb

Create a custom MANDATE visual system.

Use abstract visual representations of actual agent jobs.

Four visual motifs:

REBALANCING
concentric liquidity ranges
moving price marker
position range

GRID TRADING
lattice/grid
moving execution points
price ladder

YIELD
flowing capital paths
routing nodes
APR comparison

HEALTH FACTOR
shield/risk ring
collateral gauge
liquidation threshold marker


These should feel like financial instruments / autonomous machines.

Use:
- SVG
- Canvas
- lightweight CSS
- generated local assets if necessary

Prefer abstract technical visuals over photographs.


==================================================
11. LIVE NETWORK STRIP
==================================================

Immediately beneath hero:

LIVE ON BNB SMART CHAIN

Dynamic stats:

[XXX] agents indexed
[XXX] reachable
[XXX] priced
[XXX] active jobs

Then:

“Updated 2 min ago”

or dynamically calculated freshness.

IMPORTANT:

Do NOT display multiple conflicting ecosystem counts without explaining the data source/timestamp.

There should be ONE clearly defined source of truth for each metric.

Clicking a metric can open the relevant filtered marketplace.


==================================================
12. FOUR CATEGORY SHOWCASE
==================================================

This section must be visually strong.

Title:

What do you need done?

Four large category cards.

CARD 1

REBALANCING

Keep LP ranges working while markets move.

Visual:
animated liquidity range.

Metric examples:
X live agents
X reachable
X priced

CTA:
Explore rebalancing


CARD 2

GRID TRADING

Automate entries and exits around a price range.

Visual:
animated grid.


CARD 3

YIELD OPTIMISATION

Find and route capital toward better opportunities.

Visual:
flowing yield routes.


CARD 4

HEALTH FACTOR MONITORING

Protect lending positions before liquidation.

Visual:
health gauge / shield.


Every card should clearly show:

category
what it does
live count
starting price or “varies”
visual
CTA


==================================================
13. FEATURED AGENTS SECTION
==================================================

Title:

Agents people are using

Subtitle:

Live agents with recent activity.

Show a visually rich marketplace grid.

Prefer 3 or 4 cards per row desktop.

Each card must feel like a PRODUCT.

Not an article.

Not a table.

Not a block of prose.


==================================================
14. AGENT CARD DESIGN
==================================================

Each agent card:

TOP

agent avatar / visual

live indicator

category badge

verification badge

Example:

● LIVE
ASSAYED


MAIN

Agent Name

One concise sentence explaining the job.

Example:

“Automatically recentres PancakeSwap V3 LP positions when price leaves the target range.”


CAPABILITY ROW

PancakeSwap
BSC
x402
Session Key


METRICS

0.05 USDT / call
602 ms
Live 1h ago

or:

0.05 USDT
221 calls
98% reachable

Only display metrics that genuinely exist.


TRUST ROW

✓ Endpoint reachable
✓ Wallet active
✓ Capability checked

Or:

2 / 6 checks passed

Make this visually understandable.

Do NOT show a wall of explanatory prose.


BOTTOM ACTION AREA

View agent

and primary:

Use now

For agents that do not yet support immediate hiring:

View details

or

Notify when hireable


==================================================
15. AGENT ARTWORK SYSTEM
==================================================

Every agent needs a recognizable visual identity.

Do not use random profile photos.

Generate deterministic abstract artwork from:

agent category
agent ID
agent name
protocols

For example:

Rebalancing:
circular bands + price tick

Grid:
structured price ladder

Yield:
flowing connected nodes

Health:
shield + threshold ring

The artwork should be colorful enough to make cards visually interesting.

However:

DO NOT make every card look like a colorful NFT.

The visual system should feel like intelligent financial infrastructure.


==================================================
16. MARKETPLACE PAGE
==================================================

Route:

/agents


This is the most important page.

Header:

Agents

“Find an autonomous agent that can do the job.”

Large search field:

Search agents by capability, protocol, or task...


Then filters.

DESKTOP:
left filter rail

MOBILE:
filter drawer

Filters:

Category
- All
- Rebalancing
- Grid Trading
- Yield Optimisation
- Health Factor Monitoring

Availability
- Hireable now
- Reachable
- Recently checked

Trust
- Capability checked
- Assayed
- Has reputation
- Has settled history

Pricing
- Free
- Under $0.05
- Under $0.10
- Custom

Protocol
- PancakeSwap
- Venus
- Aave
- etc.

Execution
- x402
- ERC-8183
- Session key
- Scheduled


Sorting:

Recommended for task
Recently active
Fastest response
Lowest price
Most activity
Most evidence
Newest


==================================================
17. IMPORTANT — "RECOMMENDED" IS NOT A RANDOM AI SCORE
==================================================

Never invent a mysterious ranking score.

If the marketplace sorts something as recommended, explain why.

For example:

“Matches your requested category + currently reachable + price published”

Not:

“AI score: 94”

Trust must be explainable.


==================================================
18. AGENT DETAIL PAGE
==================================================

Route:

/agents/:id


Completely redesign this.

TOP:

Breadcrumb:

Agents / Rebalancing / Agent Name


Main two-column layout.


LEFT SIDE:

Large agent visual

Agent Name

LIVE ●

Rebalancing

Short description

Built for BNB Smart Chain


Trust badges:

Reachable
Capability checked
Wallet active
Assayed
Performance tracked

Only show badges that are actually true.


MIDDLE CONTENT:

“What it does”

very concise explanation.

“How it works”

3–4 steps.

“Protocols”

PancakeSwap
Venus
etc.

“Capabilities”

Read
Swap
Rebalance
Monitor

“Limits”

Spend cap
Allowed contracts
Expiration
Session scope


RIGHT STICKY PANEL:

USE THIS AGENT

Price:
0.05 USDT / call

Response:
~600 ms

Last checked:
12 min ago

Primary button:

Use now — 0.05 USDT

Secondary:

Compare

Tertiary:

View onchain


==================================================
19. PERFORMANCE SECTION
==================================================

Use actual data.

If performance exists:

7D
30D
90D
All

Show:
- returns
- benchmark
- drawdown
- epochs
- settled jobs
- capital
- bond

Use clear charts.

Do NOT invent data.

If there is insufficient data:

show:

NOT ENOUGH SETTLED HISTORY

Then explain:

“Performance is not shown because there are not enough completed positions to calculate it reliably.”

This is much better than a blank page.


==================================================
20. TRUST / ASSAY UI
==================================================

Current MANDATE has a strong verification model.

Keep it.

But redesign it visually.

Instead of six giant paragraphs:

create a compact trust timeline:

1
REGISTERED

2
REACHABLE

3
ACTIVE

4
CAPABILITY CHECKED

5
ASSAYED

6
SETTLED


Show each as a clean node.

Example:

✓ Reachable
Checked 12 min ago
602 ms response

✓ Wallet active
39 transactions

✕ Capability not demonstrated
No recent interaction with required contract

?

Performance unmeasured
Insufficient settled history


Clicking each opens the evidence.


==================================================
21. DO NOT DELETE FAILED CHECKS
==================================================

This is one of MANDATE's strongest differentiators.

A failed check should NOT feel like a red error page.

It should feel like:

“Here is what we know.”

Example:

NOT VERIFIED

No recent interaction with PancakeSwap V3 position manager.

That is a data point.

Not a moral judgment.

Keep evidence accessible.

But do not make the user read it unless they want to.


==================================================
22. HIRE / USE FLOW
==================================================

This needs to feel extremely good.

Click:

USE NOW


Open a modal/drawer.

STEP 1
Review

Agent:
Agripinaa Ranger

Task:
Rebalance PancakeSwap V3 position

Price:
0.05 USDT

Estimated response:
< 1 sec


STEP 2
Permissions

Show EXACTLY what this agent may do.

Example:

CAN CALL

PancakeSwap V3
exactInputSingle

PancakeSwap V3
exactInput


CANNOT CALL

sweepToken
refundETH


Spend cap:
0.10 BNB / day

Expires:
24 hours


Use readable labels first.

Advanced technical selector information should be expandable.


STEP 3

Wallet

“Nothing moves until you sign.”

Connect wallet / sign


STEP 4

Processing

Use a beautiful transaction state:

Preparing
↓
Awaiting signature
↓
Submitted
↓
Confirmed


STEP 5

Success

Agent hired.

Show:
transaction hash
cost
agent
permission scope
next action


Button:

Open activity


==================================================
23. PERMISSIONS MUST BE VISUAL
==================================================

The current permission/security work is good but too technical.

Create a “What can this agent do?” component.

Example:

THIS SESSION CAN

✓ Swap on PancakeSwap
✓ Read pool state
✓ Rebalance LP range

THIS SESSION CANNOT

× Transfer funds to arbitrary addresses
× Withdraw collateral
× Modify another protocol

Spend cap

████████░░
0.10 / 0.10 BNB

Expiration

24 hours


A user should understand the safety model in 3 seconds.


==================================================
24. COMPARE FEATURE
==================================================

This should become a major marketplace feature.

Allow selecting up to 3 agents.

Sticky compare bar:

2 agents selected
[Compare]


Comparison page/table:

Agent
Price
Response
Availability
Checks
Wallet separation
Protocols
Capabilities
Performance history
Jobs
Bond
Last checked

Highlight differences.

Example:

Agent A
0.05 USDT
602 ms
Live
2/6 checks

Agent B
0.02 USD1
18 ms
Live
4/6 checks


Do not invent overall quality scores.

Let the data speak.


==================================================
25. LIVE ACTIVITY
==================================================

Route:

/activity


But make this feel like a marketplace activity feed, not a log dump.

Header:

Live marketplace activity

Show real events:

Agent checked
Agent responded
Job opened
Job accepted
Payment settled
Epoch completed
Permission revoked
Agent listed


Use an animated live stream.

Example:

● Agripinaa Ranger responded
602 ms
12 sec ago

● Yield-1 completed epoch
+1.2%
34 sec ago

● New grid job opened
0.12 BNB
1 min ago


Animations should be subtle.


==================================================
26. JOBS / OPEN MARKET
==================================================

Rename “Floor” to:

Jobs

Route:

/jobs


Show open mandates as cards.

Each card:

CATEGORY

Grid Trading


CAPITAL

0.20 BNB


BOND

0.05 BNB


TERM

24 epochs


BENCHMARK

Hold


STATUS

Open for bids


PRIMARY:

View job


SECONDARY:

Bid


This should visually feel like an actual marketplace order board.


==================================================
27. JOB DETAIL
==================================================

Large title:

Grid Trading Job

Capital:
0.20 BNB

Bond required:
0.05 BNB

Duration:
24 epochs

Benchmark:
Hold

Tolerance:
2%

Slash:
25% of bond

Allowed calls:
...

With a sticky action:

Bid for job


The buyer should see:

What you are asking the agent to do
What the agent must risk
What happens if it underperforms
What permissions it receives

before they sign.


==================================================
28. MY DESK
==================================================

Rename current Desk to:

My Desk


Dashboard:

ACTIVE AGENTS

Agent
Status
Task
Spend
Expires

Each row:

● LIVE
Agripinaa Guardian

Health Factor Monitoring

0.02 BNB spent

Expires in 11h


Permissions button

Revoke button


Large revoke interaction:

“Revoke agent access?”

Show exactly what gets revoked.

Confirm.

Then:

✓ Permission revoked onchain


==================================================
29. LIST AGENT
==================================================

Route:

/list


This should feel like the SELL side of a marketplace.

Headline:

List your agent

“Put your agent in front of users looking for onchain work.”


Step 1:

Connect wallet


Step 2:

Agent identity

ERC-8004 ID


Step 3:

Verify endpoint

Run test


Step 4:

Choose category


Step 5:

Set pricing


Step 6:

Preview marketplace listing


Step 7:

Publish


IMPORTANT:

Show the actual marketplace card preview while the user is entering information.

This makes the feature feel like a real marketplace.


==================================================
30. MARKETPLACE CARD PREVIEW
==================================================

Before listing:

Your agent will appear like this:


[AGENT ART]

AGENT NAME

● LIVE

REBALANCING

One-line description

0.05 USDT / call

602 ms

✓ Reachable
✓ Capability checked

[View agent]


==================================================
31. TRUST CENTER
==================================================

Create:

/trust


This is where the deep MANDATE methodology lives.

Here it is okay to be technical.

Explain:

ERC-8004
identity
reputation
validation
endpoint checks
capability checks
assay
bonds
settlement
evidence
session keys
permissions


Use diagrams and interactive explanations.

The homepage should NOT contain all of this.


==================================================
32. HOMEPAGE TRUST SECTION
==================================================

Only show a compact version.

Section:

You don't have to trust the description.

We check what the chain can prove.

Then:

01 Reachable
02 Active
03 Capable
04 Assayed
05 Bonded
06 Settled

Button:

See how verification works


This communicates the differentiator without turning the homepage into documentation.


==================================================
33. MARKETPLACE DISCOVERY EXPERIENCE
==================================================

The marketplace needs to feel FUN to browse.

Add:

Recently active
Trending by usage
New agents
Fastest agents
Lowest-cost calls
Recently verified
Agents with settled history


Do NOT invent fake popularity.

Use real metrics.

If the dataset is too small, say:

“Not enough activity yet”

That honesty is part of the brand.


==================================================
34. SEARCH EXPERIENCE
==================================================

Search should understand intent.

Examples:

“protect my Venus loan”

should surface:
Health Factor Monitoring


“rebalance my PancakeSwap liquidity”

should surface:
Rebalancing


“find better stablecoin yield”

should surface:
Yield Optimisation


“automate grid trades”

should surface:
Grid Trading


The UI can begin as normal text search.

Do not build a fake AI chat interface.

This is a marketplace search box, not a chatbot.


==================================================
35. FILTER CHIPS
==================================================

Make filters visually obvious.

Example:

All
Rebalancing
Grid
Yield
Health

then:

Live only
Hireable
Assayed
Performance history

The selected filter gets the BNB yellow accent.


==================================================
36. EMPTY STATES
==================================================

Never show blank screens.

Example:

No agents match your filters.

Try:
- removing “Assayed”
- expanding the price range
- showing all categories


Button:

Clear filters


==================================================
37. LOADING STATES
==================================================

Use beautiful skeletons.

Agent cards:
visual skeleton
title skeleton
description skeleton
metrics skeleton

Marketplace counts:
animated placeholders

Never flash raw empty HTML.


==================================================
38. ERROR STATES
==================================================

Make blockchain/API errors understandable.

Bad:

RPC_ERROR_429

Good:

We couldn't refresh the agent's status.

Last verified:
12 minutes ago

Retry


Transaction failure:

Your wallet signature was rejected.

Nothing was charged.


This matters enormously in Web3 UX.


==================================================
39. ANIMATION LANGUAGE
==================================================

Motion should make the product feel alive.

DO:

120–180ms button transitions

180–250ms card hover

250–400ms panel transitions

400–700ms large state transitions

subtle spring animation where appropriate

DO NOT:

use scroll-jacking

use giant page transitions

animate everything

make cards bounce

use excessive blur

use constant pulsing everywhere


==================================================
40. SPECIFIC ANIMATIONS
==================================================

HEADER:

subtle background change on scroll


AGENT CARD:

hover:
2–4px lift

artwork:
very subtle movement

metrics:
gentle reveal


LIVE DOT:

soft breathing pulse

NOT giant flashing.


CATEGORY ART:

small animated range / nodes / flows.


FILTERING:

cards should smoothly reflow.

Use layout transitions where supported.


COMPARE:

selected cards get a subtle yellow outline.


HIRE MODAL:

slide/fade from right.

Step transitions should feel immediate.


TRANSACTION:

Pending:
moving progress indicator

Submitted:
transaction icon

Confirmed:
small success burst

Do not use childish confetti.


ACTIVITY:

new event enters from top with very subtle motion.


==================================================
41. MICROINTERACTIONS
==================================================

Buttons should feel tactile.

Primary:
solid BNB yellow

Hover:
slightly brighter

Pressed:
slightly darker / scale 0.98

Secondary:
transparent + border

Hover:
surface changes

Danger:
red only for genuinely destructive operations like revoke.


Tooltip examples:

“Checked 12 minutes ago”

“Price read from agent endpoint”

“Performance requires settled epochs”


Never make users guess.


==================================================
42. BUTTON SYSTEM
==================================================

PRIMARY BUTTON

Use now

Hire agent

Bid for job

Connect wallet


SECONDARY

View agent
Compare
View activity
Learn how it works


TERTIARY

View onchain
Copy ID
Open transaction


DESTRUCTIVE

Revoke access


Avoid:

Learn More
Get Started
Discover
Explore Now
Click Here

unless the destination is genuinely exploratory.

Buttons should describe the action.


==================================================
43. CARD GEOMETRY
==================================================

Cards should not look like giant floating rounded boxes.

Use:

12–16px radius maximum.

1px subtle border.

Dark surfaces.

Small depth difference.

Some sections can use flat surfaces.

Use shadows sparingly.

DO NOT put every component inside a card.

This is critical.

The current site has too much “content block” behavior.

Mix:
- cards
- tables
- rails
- dividers
- inline metrics
- tabs
- drawers

This creates a real product interface.


==================================================
44. DATA VISUALIZATION
==================================================

When relevant:

small sparklines
performance lines
response latency
epoch progress
health factor gauges
bond progress
volume/activity

Charts should be:
- minimal
- readable
- dark
- high contrast
- interactive on hover

Never create charts merely because they look impressive.


==================================================
45. CATEGORY VISUAL LANGUAGE
==================================================

Each category should have its own visual accent inside a consistent overall system.

REBALANCING:
circular geometry

GRID:
square/linear geometry

YIELD:
flowing geometry

HEALTH:
shield/radial geometry


No cartoon mascots.

No human heads.

No humanoid robots.

No random stock images.


==================================================
46. BNB CHAIN BRANDING
==================================================

Use BNB Chain branding carefully.

MANDATE remains the product brand.

Use:

“Built on BNB Smart Chain”

or

“Powered by BNB Chain”

where appropriate.

Do NOT call this:

“Official BNB Chain Marketplace”

unless there is explicit authorization.

Do not modify the BNB Chain logo.

Do not turn the BNB logo into the MANDATE logo.

Use BNB yellow as an ecosystem accent.


==================================================
47. COPY STYLE
==================================================

The current writing is too essay-like.

Rewrite product copy into short sentences.

BAD:

“An agent's office is derived from its own description and, where the chain will show it, from the protocols its wallet has actually touched…”

GOOD:

“Category: Rebalancing

Why:
Its description references LP ranges and rebalancing, and its wallet has interacted with the relevant protocols.”

BAD:

“Every rung, its method and its command…”

GOOD:

“How this agent was checked”

Keep technical detail expandable.


==================================================
48. HOMEPAGE COPY
==================================================

Use something close to:

EYEBROW

BNB SMART CHAIN · AGENT MARKETPLACE


HERO

Find an agent.
Put it to work.


SUBTEXT

Discover autonomous agents for trading, liquidity, yield and risk — with live onchain signals before you hire.


PRIMARY

Explore agents


SECONDARY

List your agent


SEARCH

What do you want an agent to do?


CATEGORY TITLE

What do you need done?


FEATURED TITLE

Agents ready to work


TRUST TITLE

Don't trust the description.
Check the chain.


ACTIVITY TITLE

The market is moving.


SELLER CTA

Built an agent?

List it on MANDATE.


==================================================
49. AGENT CARD COPY
==================================================

Example:

Agripinaa Ranger

● LIVE

Rebalancing

Automatically recentres PancakeSwap V3 LP positions when the range drifts.

0.05 USDT / call

602 ms

✓ Reachable
✓ Wallet active

[View agent]

[Use now]


Do not show 5 paragraphs on a card.


==================================================
50. AGENT DETAIL COPY
==================================================

Use:

What it does

Why it may be useful

What it can access

How it was checked

What it costs

What happens when you hire it

Performance

Activity

Permissions


This creates a natural product hierarchy.


==================================================
51. CURRENT MANDATE FEATURES TO PRESERVE
==================================================

Do not throw away the strongest parts.

Preserve:

- ERC-8004 IDs
- live endpoint checking
- response timing
- wallet activity
- capability checks
- reputation analysis
- settled history
- agent bond
- job/mandate system
- performance measurements
- session permissions
- scoped calls
- spend limits
- expiration
- revocation
- BSCScan links
- evidence
- technical verification


But convert these from PRIMARY content into TRUST / PRODUCT metadata.


==================================================
52. VERY IMPORTANT: DATA FRESHNESS
==================================================

Every live metric needs:

value
+
source
+
last updated

Example:

319 agents

Indexed:
12 min ago

or:

LIVE

Checked:
42 sec ago


Never show:
“319 agents”

without explaining whether that number is:
- current registry count
- indexed count
- searchable count
- verified count
- cached count


Avoid contradictory numbers across routes.


==================================================
53. MOBILE EXPERIENCE
==================================================

Mobile cannot simply be desktop stacked vertically.

Design mobile intentionally.

Navigation:

MANDATE
Search
Menu

Marketplace:

horizontal category chips

Filter button

Sort button

2-column cards when appropriate

or single-column if cards need detail.


Agent page:

agent visual
title
status
price
use button

sticky bottom:

Use agent — 0.05 USDT


Permissions become an expandable drawer.


==================================================
54. ACCESSIBILITY
==================================================

Implement:

keyboard navigation
visible focus states
ARIA labels
semantic buttons
proper contrast
reduced motion
screen reader labels

If prefers-reduced-motion is enabled:

remove nonessential motion.


==================================================
55. RESPONSIVE BREAKPOINTS
==================================================

Design deliberately for:

1440
1280
1024
768
390
375

The 1440 version should look premium.

The 390 version should look like a real mobile product.

Do not simply squeeze the desktop layout.


==================================================
56. TECHNICAL IMPLEMENTATION
==================================================

First inspect the existing repository.

Do not replace the framework.

Reuse:
- current components
- current data sources
- current wallet integration
- current contract hooks
- current API calls
where sensible.

Refactor when necessary.

Create a clean design system.

Suggested component structure:

AppShell
Navbar
SearchBar
CategoryCard
AgentCard
AgentArtwork
StatusBadge
TrustBadge
Metric
FilterRail
FilterDrawer
CompareTray
AgentDetailHeader
TrustTimeline
CapabilityList
PermissionScope
HireDrawer
TransactionStatus
ActivityFeed
JobCard
JobDetail
DeskTable
RevokeDialog
ListAgentWizard
AgentPreview
PerformanceChart


==================================================
57. DESIGN TOKENS
==================================================

Create centralized tokens for:

colors
spacing
radius
typography
shadows
transitions
breakpoints

Do not scatter values throughout the codebase.


==================================================
58. NO GENERIC SHADCN/AI-ARTIFACT LOOK
==================================================

This is a hard requirement.

Do not produce:

huge rounded white cards on dark background

purple gradients

generic dashboard cards

giant hero with three pill buttons

“AI-powered future” marketing copy

generic sparkles

magic wand icons everywhere

robot illustrations

oversized empty sections

default shadcn dashboard appearance

default artifact appearance


If a component looks like it could have come from an AI UI generator without modification, redesign it.


==================================================
59. ICONOGRAPHY
==================================================

Use one coherent icon family.

Prefer crisp line icons.

Do not mix:
- emoji
- random icon libraries
- 3D icons
- childish illustrations

Use icons primarily for:
status
capabilities
protocols
navigation
actions


==================================================
60. AGENT ARTWORK
==================================================

Create a reusable system.

For each category provide a visual generator/component.

Rebalancing:
animated orbiting range bands.

Grid:
moving price dots crossing a grid.

Yield:
capital path flowing between protocol nodes.

Health:
radial health ring with liquidation threshold.


Agent-specific identity should vary through:
- geometry
- seed
- motion
- small accent differences

But stay inside the same art system.


==================================================
61. SOCIAL / ENERGY
==================================================

The marketplace should feel alive.

Add subtle live indicators:

LIVE
CHECKED 32s AGO
3 JOBS RUNNING
12 AGENTS ACTIVE
NEW AGENT
PRICE UPDATED

Use this sparingly.

The purpose is to make it feel like a market, not a static directory.


==================================================
62. "LIVE MARKET" SECTION
==================================================

Near the homepage bottom:

LIVE MARKET

A horizontal stream:

●
Agripinaa Ranger
answered
602 ms

●
New Grid Trading job
0.20 BNB

●
Yield agent
settled epoch
+1.4%

●
New agent listed
Health Factor Monitoring


It should visually communicate:

things are happening here.


==================================================
63. TRUST SHOULD FEEL LIKE A SUPERPOWER
==================================================

MANDATE's strongest differentiator is not:

“There are lots of agents.”

It is:

“You can inspect what an agent actually proved.”

Make that visually obvious.

Example:

WHY THIS AGENT?

✓ Endpoint responded
✓ Wallet active
✓ Required protocol touched
✓ Reputation available
? Performance not yet measurable

[See evidence]


That is much more powerful than a giant paragraph.


==================================================
64. VERIFICATION SCORE
==================================================

Do NOT turn the six checks into a single mysterious “87/100”.

Instead use:

Trust status:

2 / 6 verified

and show exactly what passed.

This is honest and explainable.

If you later introduce an aggregate score, the UI must expose its methodology.


==================================================
65. MARKETPLACE HOME STRUCTURE
==================================================

Final homepage order:

1. Navbar

2. Hero
   headline
   search
   browse CTA

3. Live marketplace stats

4. Four categories

5. Agents ready to work

6. Trending / active agents

7. Live market activity

8. Why MANDATE
   trust / verification

9. Built on BNB Chain

10. Seller CTA

11. Footer


Do NOT put the full methodology before the agent marketplace.


==================================================
66. FOOTER
==================================================

Keep compact.

MANDATE

Agent marketplace for BNB Smart Chain

Explore
Agents
Jobs
Activity
My Desk

For builders
List your agent
API
Docs

Trust
How verification works
Evidence
Onchain contracts

Built on BNB Smart Chain


==================================================
67. SEO / METADATA
==================================================

Update page titles.

Homepage:

MANDATE — BNB Smart Chain Agent Marketplace

Agent:

[Agent Name] — MANDATE Agent Marketplace

Category:

[Category] Agents — MANDATE

Jobs:

Open Agent Jobs — MANDATE


Descriptions should describe the product naturally.

Do not keyword-stuff.


==================================================
68. PERFORMANCE
==================================================

The marketplace must feel fast.

Prioritize:
- server-side data where appropriate
- streaming
- lazy-loading
- image optimization
- lightweight SVG artwork
- virtualized long lists if necessary
- cached metadata
- optimistic UI where safe

Do not load giant visual assets.


==================================================
69. FINAL QA REQUIREMENT
==================================================

DO NOT stop after implementing the first design.

You must:

1. Run the application.

2. Open the actual homepage.

3. Open the marketplace page.

4. Open at least 2 agent detail pages.

5. Open a job page.

6. Open My Desk.

7. Inspect desktop.

8. Inspect mobile.

9. Inspect loading state.

10. Inspect empty state.

11. Inspect wallet/hire flow.

12. Inspect permission flow.

13. Inspect revoke flow.

Then critique the design.


==================================================
70. SELF-CRITIQUE
==================================================

Before declaring success, ask:

Does this look like a marketplace?

Does the page immediately communicate:
“I can find an agent here”?

Can I understand what an agent does in 3 seconds?

Can I see price?

Can I see whether it is live?

Can I see why I should trust the data?

Can I compare two agents?

Can I hire one without reading documentation?

Does the design feel alive?

Does the site feel specifically made for autonomous BNB agents?

Does it look like a real company/product?

Would this look credible next to a major crypto application?

Does any section still look like a blog?

Does any section still look like documentation?

Does any component look like a generic AI-generated artifact?

If yes, redesign it.


==================================================
71. VISUAL REVIEW — IMPORTANT
==================================================

Do not trust the DOM alone.

Actually inspect screenshots of the rendered page.

Review:

desktop:
1440 × 1000

tablet:
1024 × 900

mobile:
390 × 844


Look specifically for:

- too much whitespace
- weak hierarchy
- generic cards
- excessive rounded corners
- text-heavy sections
- weak CTA hierarchy
- insufficient marketplace density
- poor agent imagery
- visual monotony
- confusing navigation
- poor mobile interaction
- excessive yellow
- insufficient contrast
- fake-looking charts
- “AI artifact” appearance


Then fix the issues.


==================================================
72. THE FINAL DESIGN TEST
==================================================

Imagine a first-time user who knows nothing about MANDATE.

They land on the site.

Within 5 seconds they should understand:

“This is a marketplace for autonomous agents on BNB Chain.”

Within 15 seconds:

“I can search for something I need done.”

Within 30 seconds:

“I found an agent that can do it.”

Within 60 seconds:

“I understand what it costs, what it can access, and why its claims are credible.”

Within 90 seconds:

“I can hire it.”


THAT is the product.

Not the methodology page.

Not the protocol.

Not the documentation.

The marketplace.


==================================================
73. MOST IMPORTANT DESIGN PRINCIPLE
==================================================

Make MANDATE feel like a place people want to browse.

The user should feel:

“What agents are out there?”

“Which ones are active?”

“What can they do?”

“What does this one cost?”

“Which protocol does it work with?”

“Can I try it?”

“Can I trust it?”

“Can I compare it?”

“What happened after I hired it?”

That is the emotional loop.

BUILD THAT.

Keep the verification system underneath it as the reason the marketplace is different.

Do not remove the sophistication.

Make the sophistication discoverable instead of overwhelming.