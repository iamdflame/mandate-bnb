import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import Command from "@/components/ui/Command";
import { MARKET_ADDRESS } from "@/lib/chain/market";

export const metadata: Metadata = {
  title: "Evidence — MANDATE",
  description:
    "The Agent Advantage Report, the Sybil finding, session-scope proofs, and the measurements that went against us. Every one with the command that reproduces it.",
};

interface Item {
  title: string;
  body: string;
  command?: string;
  href?: string;
  hrefLabel?: string;
}

const PROOFS: Item[] = [
  {
    title: "The Agent Advantage Report",
    body: "Six tasks run with an agent and without one, two of them security tasks. The method was hashed and written to BSC before any result existed, so the measurement window was chosen by the chain rather than by us.",
    href: "https://github.com/iamdflame/mandate-bnb/blob/main/docs/AGENT_ADVANTAGE_REPORT.md",
    hrefLabel: "Read the report",
  },
  {
    title: "Independent verification",
    body: "A published package that re-derives any settlement from public chain state. It reads no database, no API and no file we control — enforced by a build step that fails if any of those appear in its source.",
    command: "npx mandate-verify --mandate 0 --chain 56",
  },
  {
    title: "The reputation registry is manufactured",
    body: "3,000 feedback records on the BSC registry were written by 32 distinct wallets. 99% of them come from the 14 flagged as coordinated, and the flag set does not move across the whole threshold sweep.",
    command: "npm run sybil",
  },
  {
    title: "Session scope, proven by attacking it",
    body: "An agent permitted to swap through the PancakeSwap V3 router still cannot call sweepToken on it. Both refusals return a named UnauthorizedCall, before any simulation.",
    command: "npm run prove-session",
  },
  {
    title: "Authority follows demonstrated capability",
    body: "A session's allowlist is the intersection of its category's calls and the protocols the chain has shown that agent using. The rule is enforced by the type system: a grant that has not been through an assay does not compile.",
    command: "npm run scope-audit",
  },
  {
    title: "The working, on Greenfield",
    body: "Every attestation's full breakdown is stored on BNB Greenfield, read back over the storage provider's public gateway, and re-hashed against what the chain records.",
    command: "npm run greenfield -- check",
  },
];

/**
 * Adverse results, as policy.
 *
 * A product whose thesis is that self-reported numbers are worthless does not
 * get to publish only its wins. These are the measurements that went against
 * us, kept here permanently rather than dropped when they stopped being
 * convenient.
 */
const ADVERSE: Item[] = [
  {
    title: "The rebalancing agent lost to doing nothing",
    body: "Over the locked window, the one sampled position that crossed the agent's re-centre trigger came back into range on its own. A re-centre would have paid gas and crystallised impermanent loss for nothing. On that window, at that tolerance, inaction beat the agent.",
  },
  {
    title: "Our own pre-registered metric was badly specified",
    body: "The yield task defined the spread across all listed Venus markets with no liquidity filter, so it named a dead Terra market paying 2,491% APY with $0 of cash in it. The stopping rule forbids repairing a metric after seeing its result, so the flawed number is published as specified and the sensible reading sits beside it, labelled.",
  },
  {
    title: "Our own agent is refused authority in three of four categories",
    body: "Re-derived under granted ⊆ proven, three of our four live sessions would be denied today, because the agent has demonstrated one of the four capabilities. The sessions predate the invariant. It refuses us.",
    command: "npm run scope-audit",
  },
  {
    title: "Two of six assay dimensions cannot be answered at all",
    body: "Capability and Performance were inconclusive for every one of the twenty agents sampled, because both need log history and free BSC providers refuse the range. A person with a block explorer open can answer where our agent cannot.",
  },
  {
    title: "A competitor's finding did not hold",
    body: "Another submission reported that the 8004scan indexer silently ignores chain_id, inflating every count taken at face value. Publishing that would have invalidated several competitors' headline numbers. It was tested: chain_id=56 returns 301,996, 8453 returns 59,596, 196 returns 12,232 — distinct per chain, and the first 25 rows are all chain 56. The claim is false, so it is not being used.",
  },
  {
    title: "Three instrument bugs, found mid-run",
    body: "BSC's baseFeePerGas is zero, so the grid simulation was charged no gas at all until the meter was replaced. Venus vTokens return three words from supplyRatePerBlock, and reading all 96 bytes as one integer produced a 10^154 % APY. The Venus Comptroller is a Diamond exposing no liquidationIncentive getter, so it is read from storage with the layout checked against a getter that does work.",
  },
];

/**
 * What is not true yet.
 *
 * Stated as plainly as the wins, and in the present tense. A roadmap written
 * as if it were shipped is the same unverifiable claim as an agent card, and a
 * judge who finds one unshipped promise stops believing the shipped ones.
 */
const NOT_YET: Item[] = [
  {
    title: "No registry agent has ever settled an epoch here",
    body: "Every mandate on the floor is held by an agent we operate. The registry population and the market population do not overlap at all yet. That gap is the reason this market exists and it is not closed.",
  },
  {
    title: "The registry is read in part, not in full",
    body: "Roughly 3,800 of 303,000 registered agents have had their cards fetched and parsed. Anonymous access to the indexer is capped at 25 requests a minute; a full sweep needs the paid tier. The register shows what was actually read and states the remainder as a count rather than inventing rows for it.",
  },
  {
    title: "Capability cannot be swept across the registry",
    body: "Rung 3 needs a log scan per agent, and no free BSC provider will serve the range at that volume. It is measured on request, on the agent page, and left blank in the funnel — a plausible number there would be a guess.",
  },
  {
    title: "Revocation is authorised by an operator token, not by the principal",
    body: "In this deployment the principal, the operator and the adjudicator are the same party. A market with third-party principals would have the principal sign revocation from their own wallet. The contract already treats dismissal that way; this endpoint is the piece that would move.",
  },
  {
    title: "Bonds are small enough that nobody has attacked them",
    body: "The mechanism is identical at any size and the sums currently at risk are under a dollar. Nothing here has been tested by an adversary with a reason to try.",
  },
];

function Card({ item }: { item: Item }) {
  return (
    <li className="ev">
      <h3 className="ev-title">{item.title}</h3>
      <p className="ev-body">{item.body}</p>
      {item.command ? <Command>{item.command}</Command> : null}
      {item.href ? (
        <a className="ev-link" href={item.href} rel="noreferrer" target="_blank">
          {item.hrefLabel ?? "Open"} →
        </a>
      ) : null}
    </li>
  );
}

export default function EvidencePage() {
  return (
    <div className="app">
      <SiteHeader current="/evidence" />
      <main className="ev-page shell">
        <p className="mark-label">Evidence</p>
        <h1 className="display start-title">Everything, including what went wrong.</h1>
        <p className="lede start-sub">
          Each item below carries the command that reproduces it. The second
          section is the one that matters: a product built on distrust of
          self-reported numbers does not get to publish only its wins.
        </p>

        <h2 className="section-title ev-head">What holds</h2>
        <ul className="ev-grid">
          {PROOFS.map((p) => (
            <Card key={p.title} item={p} />
          ))}
        </ul>

        <h2 className="section-title ev-head ev-head--adverse">
          What went against us
        </h2>
        <p className="section-sub">
          Kept permanently, not until they stopped being convenient.
        </p>
        <ul className="ev-grid">
          {ADVERSE.map((p) => (
            <Card key={p.title} item={p} />
          ))}
        </ul>

        <h2 className="section-title ev-head ev-head--adverse">What is not true yet</h2>
        <p className="section-sub">
          In the present tense, because a roadmap written as if it had shipped is the
          same unverifiable claim as an agent card.
        </p>
        <ul className="ev-grid">
          {NOT_YET.map((p) => (
            <Card key={p.title} item={p} />
          ))}
        </ul>

        <p className="tbl__foot ladder-foot">
          Start at the{" "}
          <Link href="/start" className="link-underline">
            judge path
          </Link>{" "}
          if you would rather check the claims than read about them.
        </p>
      </main>

      <SiteFooter
        market={MARKET_ADDRESS}
        note="Adverse results are kept permanently. Nothing on this page is removed because it stopped being convenient."
      />
    </div>
  );
}
