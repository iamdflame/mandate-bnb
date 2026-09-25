"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import { useWallet } from "@/lib/chain/wallet";
import Dashboard from "@/components/v2/portfolio/Dashboard";
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
      <div className="x-connect x-connect--slim">
        <span className="x-connect__i" aria-hidden="true">
          <Wallet size={16} />
        </span>
        <p className="x-connect__p">
          Not connected, so below is MANDATE's own account at work. Connect a wallet to see the jobs you opened and the agents with permissions over it.
        </p>
        {available ? (
          <button type="button" className="x-btn x-btn--sm x-btn--primary" onClick={() => void connect()}>
            Connect wallet
          </button>
        ) : (
          <Link href="/agents" className="x-btn x-btn--sm">
            Browse agents
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="x-yours">
      <Dashboard />
      <Permissions />
    </div>
  );
}
