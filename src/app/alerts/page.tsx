import "@/styles/account.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bell, Eye, Lock } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import PageHead from "@/components/k/PageHead";
import AlertSignup from "@/components/x/AlertSignup";
import NeedHelp from "@/components/x/NeedHelp";

export const metadata: Metadata = {
  title: "Liquidation alerts | MANDATE",
  description: "A free Telegram message before your Venus loan on BNB Smart Chain can be liquidated. Nothing to sign; stop any time.",
};

/**
 * Free liquidation alerts. Anyone with a Venus loan can use them, hired or
 * not: a message before the loan can be liquidated, from the same reading of
 * the chain our agents act on. Guard-1, which can repay for them, is offered
 * underneath and nothing more.
 */
export default function AlertsPage() {
  return (
    <AppShell>
      <PageHead
        crumbs={[{ href: "/diagnose", label: "Check a wallet" }]}
        title="Liquidation alerts"
        lede="A free Telegram message before your Venus loan can be liquidated. Nothing to sign; stop any time."
        agent={{ job: "health-factor", seed: "alerts-watch", state: "awake" }}
      />

      <div className="k-wrap ac-al">
        <div className="ac-al__main k-rise" style={{ ["--i" as string]: 3 }}>
          <AlertSignup />
        </div>

        <aside className="ac-al__side" aria-labelledby="ac-al-how">
          <h2 className="k-h3" id="ac-al-how">
            How it works
          </h2>
          <ul className="ac-steps">
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <Eye size={18} />
              </span>
              <span>Every five minutes we read the wallet&apos;s Venus position from BNB Smart Chain.</span>
            </li>
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <Bell size={18} />
              </span>
              <span>You get a message when its health factor drops below your level, a reminder if it stays there, and one line when it recovers.</span>
            </li>
            <li>
              <span className="ac-steps__i" aria-hidden="true">
                <Lock size={18} />
              </span>
              <span>Nothing to sign and nothing to connect: we only read what the chain shows anyone, and cannot move a thing.</span>
            </li>
          </ul>
          <p className="k-small">
            We keep the wallet, your level and your Telegram chat, only to send these messages. Send <span className="k-mono">/stop</span> to the bot at any time to end them.
          </p>

          <div className="ac-al__up" data-job="health-factor">
            <span className="ac-al__up-art" aria-hidden="true">
              <Agent job="health-factor" seed="344123" house size={96} state="ready" slot="alup" />
            </span>
            <div className="k-stack" style={{ ["--gap" as string]: "10px" }}>
              <p className="ac-al__up-t">Want it handled for you?</p>
              <p className="k-small">Guard-1 can repay the loan itself, on a wallet you own, within a daily cap you set, until you revoke it.</p>
              <div className="k-row" style={{ ["--gap" as string]: "8px" }}>
                <Link className="k-btn k-btn--sm" href="/leash?agent=guard-1">
                  Leash Guard-1 <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
                </Link>
                <Link className="k-btn k-btn--sm k-btn--ghost" href="/diagnose">
                  Check the whole wallet
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div className="k-wrap ac-help">
        <NeedHelp />
      </div>
    </AppShell>
  );
}
