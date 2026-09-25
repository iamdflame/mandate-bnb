import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/v2/shell/AppShell";
import LeashWizard from "@/components/x/LeashWizard";

export const metadata: Metadata = {
  title: "Put an agent on a leash | MANDATE",
  description: "Let Yield-1 or Guard-1 act on a passkey wallet you own, within a daily cap you set, and revoke it in one tap.",
};

/**
 * An agent acting on your own wallet, on your terms: a passkey wallet only
 * you control, a budget and a daily cap you choose, an expiry, and a revoke
 * that ends it at once. The agent's key can call Venus for that wallet and
 * nothing else.
 */
export default async function LeashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const agent = sp.agent === "guard-1" ? "guard-1" : "yield-1";
  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Put an agent on a leash</h1>
          <p className="x-mkt-head__sub">It acts on a wallet you own, within limits you set, until you say stop.</p>
        </div>
      </section>
      <div className="x-wrap x-section--tight x-leashpage">
        <LeashWizard initial={agent} />
        <aside className="x-leashpage__side">
          <p className="x-leash__t">How the leash holds</p>
          <ul className="x-leash__may">
            <li>The wallet is a smart account unlocked by your passkey. Only you can move its funds out.</li>
            <li>The agent holds a session key the wallet itself checks on every call: which contract, which function, how much a day, until when.</li>
            <li>The key is registered in the public KeyStore, so anyone can check it, and a revoke kills it on chain at once.</li>
          </ul>
          <p className="x-leash__n">
            <Link className="x-link" href="/help#sign">
              What you sign
            </Link>
            {" · "}
            <Link className="x-link" href="/contracts">
              Contracts
            </Link>
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
