"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The nine rooms of Trust, under every page head in the place, so the pages
 * read as one place and not nine documents. The method (/assay) belongs to
 * the checks, the restatement to what is true now.
 */
export const TRUST_ROOMS = [
  { href: "/trust", label: "How we check", match: ["/trust"] },
  { href: "/verify", label: "The checks", match: ["/verify", "/assay"] },
  { href: "/standard", label: "Answers against the chain", match: ["/standard"] },
  { href: "/bench", label: "Run a check yourself", match: ["/bench"] },
  { href: "/graveyard", label: "What failed", match: ["/graveyard"] },
  { href: "/proof", label: "Does hiring pay", match: ["/proof"] },
  { href: "/evidence", label: "What is true now", match: ["/evidence"] },
  { href: "/contracts", label: "Contracts", match: ["/contracts"] },
  { href: "/status", label: "Status", match: ["/status"] },
] as const;

export default function TrustNav() {
  const path = usePathname() ?? "";
  const here = TRUST_ROOMS.find((r) => r.match.some((m) => path === m || path.startsWith(`${m}/`)))?.href;
  const rail = useRef<HTMLDivElement>(null);
  // On a phone the rail scrolls; bring the room you are in to its middle without moving the page.
  useEffect(() => {
    const el = rail.current;
    const on = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && on && el.scrollWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2;
  }, [here]);
  return (
    <nav className="k-subnav tr-subnav" aria-label="Trust">
      <div className="k-wrap k-subnav__in" ref={rail}>
        {TRUST_ROOMS.map((r) => (
          <Link key={r.href} href={r.href} className="k-tab" aria-current={r.href === here ? "page" : undefined}>
            {r.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
