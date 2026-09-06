import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/shell/SiteHeader";
import SiteFooter from "@/components/shell/SiteFooter";
import Authority from "@/components/agents/Authority";
import { MARKET_ADDRESS } from "@/lib/chain/market";

export const metadata: Metadata = {
  title: "Authority — MANDATE",
  description:
    "Exactly what each agent may do with a principal's capital, what it was refused, and the control that ends it.",
};

export const dynamic = "force-dynamic";

export default function AuthorityPage() {
  return (
    <div className="app">
      <SiteHeader current="/authority" wallet />
      <main className="shell start">
        <p className="mark-label">Authority</p>
        <h1 className="display start-title">What each agent may do, and how to stop it.</h1>
        <p className="lede start-sub">
          A bond makes an agent accountable for outcomes. It does not make it
          incapable of anything outside its brief — that is an{" "}
          <strong>ERC-8183 session key</strong>: a spend cap no larger than the
          mandate&rsquo;s capital, an expiry that ends with its term, and a call
          allowlist bound to target <em>and</em> selector. The principal never
          surrenders its own keys.
        </p>
        <p className="lede start-sub">
          The allowlist is not a category default. It is the intersection of
          what the category permits and what the chain has shown that agent
          actually doing, so the calls listed as withheld are withheld because
          the evidence for them does not exist. See{" "}
          <Link href="/evidence" className="link-underline">the evidence page</Link> for the proof that the
          bound holds.
        </p>

        <Authority />

        <section className="start-next">
          <h2 className="section-title">Who may press it</h2>
          <p className="section-sub">
            Stated rather than finessed: in this deployment the principal, the
            operator and the adjudicator are the same party, so revocation is
            authorised by an operator token. A market with third-party
            principals would have the principal sign it from their own wallet —
            the contract already treats dismissal that way, and this endpoint is
            the piece that would move. That concentration is a real weakness and
            it is listed as one.
          </p>
        </section>
      </main>

      <SiteFooter
        market={MARKET_ADDRESS}
        note="Session keys are ERC-8183. The allowlist is derived from the assay, never from the category alone — granted is a subset of proven, enforced by the type system rather than by a check somebody has to remember."
      />
    </div>
  );
}
