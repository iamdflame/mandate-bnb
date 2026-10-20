import "@/styles/account.css";
import type { Metadata } from "next";
import Link from "next/link";
import { formatEther } from "viem";
import { KeyRound, ShieldCheck, Wallet } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import LeashWizard from "@/components/x/LeashWizard";
import { LEASH_POLICIES } from "@/lib/leash/policy";

export const metadata: Metadata = {
  title: "Put an agent on a leash | MANDATE",
  description: "Let Yield-1 or Guard-1 act on a passkey wallet you own, within a daily cap you set, and revoke it in one tap.",
};

/**
 * An agent acting on your own wallet, on your terms: a passkey wallet only
 * you control, a budget and a daily cap you choose, an expiry, and a revoke
 * that ends it at once. The agent's key can call Venus for that wallet and
 * nothing else. The label the wizard shows before any signature is read from
 * the same policy the server grants with.
 */
export default async function LeashPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const agent = sp.agent === "guard-1" ? "guard-1" : "yield-1";
  const policy = {
    "yield-1": { touch: LEASH_POLICIES["yield-1"].calls.map((c) => c.words), relay: formatEther(LEASH_POLICIES["yield-1"].nativePerDay) },
    "guard-1": { touch: LEASH_POLICIES["guard-1"].calls.map((c) => c.words), relay: formatEther(LEASH_POLICIES["guard-1"].nativePerDay) },
  };
  return (
    <AppShell>
      <header className="ac-lh">
        <div className="ac-lh__pool" aria-hidden="true" />
        <div className="k-wrap ac-lh__in">
          <h1 className="k-display ac-lh__h k-rise" style={{ ["--i" as string]: 0 }}>
            Put an agent on your own wallet.
          </h1>
          <div className="ac-lh__side">
            <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
              It acts on a wallet you own, within limits you set, until you say stop.
            </p>
            <p className="k-small k-rise" style={{ ["--i" as string]: 2 }}>
              Yield-1 and Guard-1 only, on Venus&apos;s USDT market.
            </p>
          </div>
        </div>
      </header>

      <div className="k-wrap ac-lh__wiz">
        <LeashWizard initial={agent} policy={policy} />
      </div>

      <section className="k-wrap ac-sec" aria-labelledby="ac-holds">
        <div className="ac-holds">
          <h2 className="k-h3" id="ac-holds">
            How the leash holds
          </h2>
          <ul className="ac-steps">
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <Wallet size={18} />
              </span>
              <span>The wallet is a smart account unlocked by your passkey. Only you can move its funds out.</span>
            </li>
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <KeyRound size={18} />
              </span>
              <span>The agent holds a session key the wallet itself checks on every call: which contract, which function, how much a day, until when.</span>
            </li>
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <ShieldCheck size={18} />
              </span>
              <span>The key is registered in the public KeyStore, so anyone can check it, and a revoke kills it on chain at once.</span>
            </li>
          </ul>
          <p className="k-small">
            A leash limits the damage a key can do; it does not make a key harmless.{" "}
            <Link className="k-link" href="/help#sign">
              What you sign
            </Link>
            {"  "}
            <Link className="k-link ac-gap" href="/contracts">
              Contracts
            </Link>
          </p>
        </div>
      </section>
    </AppShell>
  );
}
