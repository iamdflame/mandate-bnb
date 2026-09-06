import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import Command from "@/components/ui/Command";
import { MARKET_ADDRESS } from "@/lib/chain/market";

export const metadata: Metadata = {
  title: "Start here — MANDATE",
  description:
    "Every claim this project makes, and the command or link that checks it. No wallet needed.",
};

interface Claim {
  claim: string;
  check: string;
  how: "command" | "link";
  target: string;
  note?: string;
}

/**
 * The judge path.
 *
 * Not a tour. Every row is a claim paired with the thing that falsifies it, so
 * the page can be read in under two minutes and none of it has to be believed.
 */
const CLAIMS: Claim[] = [
  {
    claim: "The number that decides every slash is on chain, not on our laptop.",
    check: "npx mandate-verify --mandate 0 --chain 56 --deployment v1",
    how: "command",
    target: "https://www.npmjs.com/package/mandate-verify",
    note: "Published to npm. It reads nothing but BSC — no database, no API, no file we control, enforced by a build step that fails if any of those appear.",
  },
  {
    claim: "Those numbers were committed before the outcome was known.",
    check: "Read the Observed logs on the market contract",
    how: "link",
    // The canonical deployment, not the superseded one this line used to name.
    target: `https://bscscan.com/address/${MARKET_ADDRESS}#events`,
    note: "The observation is emitted whole, and its hash was stored at award time.",
  },
  {
    claim: "Tamper with any committed number and verification fails.",
    check: "npx mandate-verify --mandate 0 --chain 56 --deployment v1 --tamper",
    how: "command",
    target: "https://www.npmjs.com/package/mandate-verify",
    note: "Perturbs each value by the smallest amount that matters. 8 of 8 rejected.",
  },
  {
    claim: "The Advantage Report's method was fixed before any result existed.",
    check: "Its hash is the calldata of a BSC transaction",
    how: "link",
    target:
      "https://bscscan.com/tx/0x00b0e484c69fc3f149f437e0d05ae19cad019bb9b69875a66eaec9fbbbe370e4",
    note: "The block that transaction landed in is the anchor every task measures backward from, so the window was chosen by the chain.",
  },
  {
    claim: "An agent cannot be granted authority it has not demonstrated.",
    check: "npm run scope-audit",
    how: "link",
    target: "/evidence",
    note: "It refuses three of our own four sessions. A grant that has not been through an assay does not compile.",
  },
  {
    claim: "The session key is bounded, per selector, not just per contract.",
    check: "npm run prove-session",
    how: "link",
    target: "/evidence",
    note: "An agent allowed to swap through the V3 router still cannot call sweepToken on it. Refused with a named UnauthorizedCall.",
  },
  {
    claim: "The registry's reputation scores are manufactured.",
    check: "npm run sybil",
    how: "link",
    target: "/evidence",
    note: "3,000 feedback records written by 32 wallets; 99% by the 14 flagged as coordinated.",
  },
  {
    claim: "Every attestation's full working is public and hash-checked.",
    check: "npm run greenfield -- check",
    how: "link",
    target: "/evidence",
    note: "Objects on BNB Greenfield, read back over the storage provider's gateway and re-hashed against the chain.",
  },
];

export default function StartPage() {
  return (
    <div className="app">
      <SiteHeader current="/start" />
      <main className="start shell">
        <p className="mark-label">Start here · no wallet · under ninety seconds</p>
        <h1 className="display start-title">Nothing here asks to be believed.</h1>
        <p className="lede start-sub">
          Every claim this project makes is paired below with the command or the
          link that would prove it false. No wallet is needed for any of them.
          If you have two minutes, read the left column; if you have ten, run
          the right one.
        </p>

        <ol className="claims">
          {CLAIMS.map((c, i) => (
            <li key={i} className="claim">
              <span className="claim-n">{String(i + 1).padStart(2, "0")}</span>
              <div className="claim-body">
                <p className="claim-text">{c.claim}</p>
                {c.note ? <p className="claim-note">{c.note}</p> : null}
                {c.how === "command" ? (
                  <Command>{c.check}</Command>
                ) : c.target.startsWith("/") ? (
                  <Link href={c.target} className="claim-link">
                    {c.check} →
                  </Link>
                ) : (
                  <a href={c.target} className="claim-link" rel="noreferrer">
                    {c.check} →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>

        <section className="start-next">
          <h2 className="section-title">Then</h2>
          <p className="section-sub">
            The <Link href="/agents" className="link-underline">register</Link> is the
            front door — every agent we have read, sorted by fineness, with a mark
            column that is almost entirely blank. The{" "}
            <Link href="/floor" className="link-underline">floor</Link> is the market
            running live. The{" "}
            <Link href="/evidence" className="link-underline">evidence</Link> page holds
            the reports, including the measurements that went against us.
          </p>
        </section>
      </main>

      <SiteFooter
        market={MARKET_ADDRESS}
        note="Every row above can be run from a clean checkout. None of them read anything we control."
      />
    </div>
  );
}
