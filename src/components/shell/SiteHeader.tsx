"use client";

import OfficeMark from "@/components/mark/OfficeMark";
import { MANDATE_TOKEN_ID } from "@/lib/config";
import { WalletChip } from "@/components/floor/Actions";

const NAV = [
  { href: "/start", label: "Start" },
  { href: "/agents", label: "Register" },
  { href: "/floor", label: "Floor" },
  { href: "/authority", label: "Authority" },
  { href: "/evidence", label: "Evidence" },
  { href: "/assay", label: "Method" },
  { href: "/api", label: "API" },
  { href: "/list-your-agent", label: "List yours" },
  // Our own entry, at whatever rung it earns.
  { href: `/agent/${MANDATE_TOKEN_ID}`, label: "Us" },
];

/**
 * One bar across the whole product.
 *
 * The office mark is struck once, small, on the left, and the wordmark sits
 * beside it at cap height. Nothing else in the header is allowed to compete
 * with the register underneath it.
 */
export default function SiteHeader({
  live,
  status,
  current,
}: {
  live?: boolean;
  status?: string;
  current?: string;
}) {
  return (
    <header className="app-header">
      <div className="app-header__inner shell">
        <a href="/" className="wordmark" aria-label="MANDATE — home">
          <OfficeMark size={20} />
          <span className="wordmark__name" style={{ fontSize: 20 }}>
            MANDATE
          </span>
        </a>

        <nav className="app-nav" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} aria-current={current === n.href ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="app-header__right">
          {status ? (
            <>
              <span className={`pulse ${live ? "pulse--on" : ""}`} aria-hidden />
              <span className="mark-label">{status}</span>
            </>
          ) : null}
          <WalletChip />
        </div>
      </div>
    </header>
  );
}
