"use client";

import Link from "next/link";
import { Wallet } from "lucide-react";
import Agent from "@/components/characters/Agent";
import { useWallet } from "@/lib/chain/wallet";

/**
 * The one invitation at the top of My desk when no wallet is connected, so
 * a visitor meets a single clear next step instead of five prompts. Each
 * section below still says what it would show. Connected, it is gone.
 */
export default function DeskConnect() {
  const { address, available, connect } = useWallet();
  if (address) return null;
  return (
    <div className="ac-dconnect k-panel k-panel--raised">
      <div className="ac-dconnect__art" aria-hidden="true">
        <Agent job="health-factor" seed="desk-door" size={88} state="awake" slot="dconnect" />
      </div>
      <div className="ac-dconnect__copy">
        <p className="k-h3">Connect a wallet to open your desk.</p>
        <p className="k-small">We read it from the chain: nothing is stored on our side, and connecting reveals your address and nothing else.</p>
      </div>
      <div className="ac-dconnect__act">
        {available ? (
          <button type="button" className="k-btn k-btn--primary" onClick={() => void connect()}>
            <Wallet size={16} aria-hidden="true" /> Connect wallet
          </button>
        ) : (
          <a className="k-btn" href="https://www.bnbchain.org/en/wallets" target="_blank" rel="noreferrer">
            Get a wallet for BNB Chain
          </a>
        )}
        <Link className="k-btn k-btn--ghost" href="/leash">
          Or start with a leash
        </Link>
      </div>
    </div>
  );
}
