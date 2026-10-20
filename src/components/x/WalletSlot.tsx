"use client";

import dynamic from "next/dynamic";

/**
 * The wallet button, loaded just after the page instead of with it: it brings
 * viem and the passkey code (about 100 KB), which no page needs to paint.
 * Until it arrives, the same button as the disconnected state stands in, so
 * nothing moves when it does.
 */
const WalletSlot = dynamic(() => import("@/components/v2/shell/WalletButton"), {
  ssr: false,
  loading: () => (
    <span className="x-conn">
      <button className="k-btn k-btn--sm k-btn--primary" type="button" aria-busy="true">
        Connect wallet
      </button>
    </span>
  ),
});

export default WalletSlot;
