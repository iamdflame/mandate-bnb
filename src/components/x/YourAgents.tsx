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

  if (!address) {
    return (
      <div className="x-connect">
        <span className="x-connect__i" aria-hidden="true">
          <Wallet size={20} />
        </span>
        <div>
          <p className="x-connect__t">Connect your wallet to see your agents</p>
          <p className="x-connect__p">
            The jobs you opened and every permission an agent holds over your wallet, read from the chain for your address. Nothing is stored on our side.
          </p>
        </div>
        {available ? (
          <button type="button" className="x-btn x-btn--primary" onClick={() => void connect()}>
            Connect wallet
          </button>
        ) : (
          <Link href="/agents" className="x-btn">
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
