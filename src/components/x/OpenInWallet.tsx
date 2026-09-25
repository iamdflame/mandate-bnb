"use client";

import { useEffect, useState } from "react";

/**
 * On a phone with no wallet in the browser, the way in is the wallet app's own
 * browser. These open this very page there, so a visitor does not have to
 * copy an address into an app to carry on where they were.
 */
export default function OpenInWallet({ label = "Open this page in your wallet app" }: { label?: string }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => setHref(window.location.href), []);
  if (!href) return null;
  const bare = href.replace(/^https?:\/\//, "");
  return (
    <div className="x-openwallet">
      <p className="x-openwallet__t">{label}</p>
      <div className="x-openwallet__row">
        <a className="x-btn x-btn--sm" href={`https://metamask.app.link/dapp/${bare}`}>
          MetaMask
        </a>
        <a className="x-btn x-btn--sm" href={`https://link.trustwallet.com/open_url?coin_id=20000714&url=${encodeURIComponent(href)}`}>
          Trust Wallet
        </a>
      </div>
      <p className="x-openwallet__n">Any wallet with a built-in browser works: open mandatemarkets.com in it.</p>
    </div>
  );
}
