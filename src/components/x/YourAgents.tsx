"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useWallet } from "@/lib/chain/wallet";
import Permissions from "@/components/v2/portfolio/Permissions";

/**
 * The top of My Desk: the jobs you opened and the agents holding permissions
 * over your wallet, read live from the chain for your address.
 *
 * Nothing is stored against you here, so without a wallet there is nothing to
 * show, and the page says that in one line with the one button that changes
 * it. Connected, the job controls are the real ones: cancel while a job is
 * waiting, accept a bid, withdraw what the contract owes you.
 */
export default function YourAgents() {
  const { address, available, connect } = useWallet();

  // Not connected: one line, so the agents below are the first thing on the page.
  if (!address) {
    return (
      <div className="ac-gate">
        <span className="ac-gate__i" aria-hidden="true">
          <Wallet size={16} />
        </span>
        <p className="k-small">Connect a wallet to see which agents hold a permission over it. Our own agents at work are further down this page.</p>
        {available ? (
          <button type="button" className="k-btn k-btn--sm" onClick={() => void connect()}>
            Connect wallet
          </button>
        ) : (
          <Link href="/agents" className="k-btn k-btn--sm">
            Browse agents
          </Link>
        )}
      </div>
    );
  }

  return (
    // Its jobs with capital have their own section above; this is only what agents may do.
    <div className="ac-yours">
      <Permissions embedded />
    </div>
  );
}
