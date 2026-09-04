"use client";

/**
 * One header for both surfaces.
 *
 * The marketplace and the capital market are two halves of the same product;
 * previously each had its own bar, so moving between them felt like leaving
 * the site.
 */

import { WalletChip } from "@/components/floor/Actions";

export default function SiteHeader({
  live,
  status,
}: {
  live?: boolean;
  status?: string;
}) {
  return (
    <header className="app-header">
      <div className="app-header__inner shell">
        <a href="/" className="wordmark">
          MANDATE
        </a>
        <nav className="app-nav">
          <a href="/agents">Agents</a>
          <a href="/floor">Floor</a>
          <a href="/authority">Authority</a>
          <a href="/evidence">Evidence</a>
          <a href="/assay">Method</a>
          <a href="/list-your-agent">List yours</a>
        </nav>
        <div className="app-header__right">
          {status ? (
            <>
              <span className={`pulse ${live ? "pulse--on" : ""}`} aria-hidden />
              <span className="label">{status}</span>
            </>
          ) : null}
          <WalletChip />
        </div>
      </div>
    </header>
  );
}
