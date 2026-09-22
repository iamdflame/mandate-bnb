"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import WalletButton from "./WalletButton";

/*
  Four links, then everything else.

  Eight were competing for one line, which meant none of them read as the
  spine of the product. These four are the places a person actually goes, in
  the order the product works: pick a job, look at who can do it, watch the
  leash, watch the money. The rest are real pages that nobody needs on their
  first visit, so they sit behind a disclosure rather than a footer, because
  footer-only navigation is how a page becomes unfindable.
*/
const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/agents", label: "Agents" },
  { href: "/desk", label: "Desk" },
  { href: "/activity", label: "Activity" },
] as const;

const MORE = [
  { href: "/diagnose", label: "Check a position" },
  { href: "/proof", label: "Proof" },
  { href: "/graveyard", label: "Graveyard" },
  { href: "/list-your-agent", label: "List an agent" },
  { href: "/status", label: "Status" },
  { href: "/verify", label: "How we check" },
  { href: "/evidence", label: "Evidence" },
  { href: "/judges", label: "Judges" },
] as const;

/**
 * The header.
 *
 * Four primary links sit on the line at every width that can hold them, and
 * the secondary set lives behind a disclosure. Below the large breakpoint
 * both collapse into one Menu rather than wrapping inside their own labels,
 * and the duplicate hire button gives up its room first. Phones used to get
 * no navigation at all: the links were simply hidden under 860 px.
 *
 * Both disclosures close on route change, on a click outside, and on Escape,
 * which returns focus to the control that opened them.
 */
export default function AppHeader() {
  const path = usePathname() ?? "/";
  const menu = useRef<HTMLDetailsElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);

  useEffect(() => {
    for (const el of [menu.current, more.current]) if (el) el.open = false;
  }, [path]);
  useEffect(() => {
    const panels = () => [menu.current, more.current].filter(Boolean) as HTMLDetailsElement[];
    const onDown = (e: MouseEvent) => {
      for (const el of panels()) if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      for (const el of panels()) {
        if (el.open) {
          el.open = false;
          el.querySelector("summary")?.focus();
        }
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <header className="m-header">
      <div className="m-wrap m-header__in">
        <Link href="/" aria-label="Mandate, home">
          <Logo />
        </Link>

        <nav className="m-nav" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)}>
              {n.label}
            </Link>
          ))}
          <details className="m-menu m-menu--more" ref={more}>
            <summary className="m-more" aria-label="More pages">
              <span aria-hidden="true">···</span>
            </summary>
            <nav className="m-menu__panel" aria-label="More">
              {MORE.map((n) => (
                <Link key={n.href} href={n.href} aria-current={current(n.href)}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </details>
        </nav>

        <div className="m-header__right">
          <SearchButton />
          <Link className="m-btn m-btn--sm m-header__hire" href="/agents?hireable=1">
            Hire an agent
          </Link>
          <WalletButton />
          <details className="m-menu" ref={menu}>
            <summary className="m-btn m-btn--sm m-btn--quiet">Menu</summary>
            <nav className="m-menu__panel" aria-label="Main">
              {/* Search is in the header on wide screens and in here on a phone, where the header line has no room for it. */}
              <button type="button" className="m-menu__search" onClick={() => window.dispatchEvent(new Event("mandate:search"))}>
                Search
              </button>
              {[...NAV, ...MORE].map((n) => (
                <Link key={n.href} href={n.href} aria-current={current(n.href)}>
                  {n.label}
                </Link>
              ))}
              <Link className="m-btn m-btn--sm m-btn--primary" href="/agents?hireable=1">
                Hire an agent
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

/**
 * Search, as a control rather than a shortcut nobody is told about.
 *
 * The command palette has always been there on Command-K and on slash. A
 * person who does not know that has no way to find it, so this is the same
 * dialog behind a button that says what it does and prints the shortcut next
 * to it.
 */
function SearchButton() {
  return (
    <button
      type="button"
      className="m-btn m-btn--sm m-btn--quiet m-search"
      onClick={() => window.dispatchEvent(new Event("mandate:search"))}
    >
      Search
      <kbd className="m-kbd" aria-hidden="true">
        /
      </kbd>
    </button>
  );
}
