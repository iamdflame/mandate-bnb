"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Menu, Search, X } from "lucide-react";
import Brand from "./Brand";
import WalletButton from "@/components/x/WalletSlot";
import NetworkBadge from "./NetworkBadge";

/*
  Six places, named the way a visitor thinks of them. Every older address
  still answers (next.config.ts), and the deeper pages each live under one
  of these, so nothing needs a "More" menu.
*/
export const PLACES = [
  { href: "/agents", label: "Agents", note: "Hire an agent for one of four jobs", match: ["/agents", "/categories", "/compare", "/hire"] },
  { href: "/diagnose", label: "Check a wallet", note: "Paste any wallet: what is drifting, at risk or idle", match: ["/diagnose", "/alerts", "/pool-gaps"] },
  { href: "/leash", label: "On your wallet", note: "An agent on a leash you can revoke", match: ["/leash"] },
  { href: "/activity", label: "Live", note: "Payments, deliveries and checks as they land", match: ["/activity", "/jobs", "/receipts", "/mandate", "/ledger"] },
  { href: "/trust", label: "Trust", note: "How every agent is checked, and what failed", match: ["/trust", "/verify", "/standard", "/assay", "/bench", "/evidence", "/proof", "/graveyard", "/contracts", "/status"] },
  { href: "/build", label: "Builders", note: "List, check and build an agent; the API", match: ["/build", "/check", "/list", "/api", "/brand", "/quest"] },
] as const;

const SECONDARY = [
  { href: "/desk", label: "My desk" },
  { href: "/quest", label: "Set and Earn" },
  { href: "/help", label: "Help" },
  { href: "/status", label: "Status" },
] as const;

export default function Navbar() {
  const path = usePathname() ?? "/";
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const active = PLACES.find((p) => p.match.some((m) => path === m || path.startsWith(`${m}/`)))?.href;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // The sheet closes on navigation and on Escape, holds focus while open, and locks the page behind it.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const first = sheet.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
      if (e.key === "Tab" && sheet.current) {
        const f = [...sheet.current.querySelectorAll<HTMLElement>("a, button, summary")].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const [a, z] = [f[0], f[f.length - 1]];
        if (e.shiftKey && document.activeElement === a) (e.preventDefault(), z.focus());
        else if (!e.shiftKey && document.activeElement === z) (e.preventDefault(), a.focus());
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const search = () => window.dispatchEvent(new Event("mandate:search"));

  return (
    <header className="k-nav" data-scrolled={scrolled ? "1" : "0"} data-open={open ? "1" : "0"}>
      <div className="k-wrap k-wrap--wide k-nav__in">
        <Brand />

        <nav className="k-nav__places" aria-label="Main">
          {PLACES.map((p) => (
            <Link key={p.href} href={p.href} className="k-nav__place" aria-current={active === p.href ? "page" : undefined}>
              {active === p.href ? (
                <m.span
                  layoutId="k-nav-active"
                  className="k-nav__pill"
                  transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.45 }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="k-nav__t">{p.label}</span>
            </Link>
          ))}
        </nav>

        <div className="k-nav__right">
          <button type="button" className="k-nav__search" onClick={search} aria-label="Search agents and pages">
            <Search size={16} aria-hidden="true" />
            <span className="k-nav__search-t">Search</span>
            <kbd className="k-kbd">⌘K</kbd>
          </button>
          <Link href="/desk" className="k-nav__desk" aria-current={path.startsWith("/desk") ? "page" : undefined}>
            My desk
          </Link>
          <span className="k-nav__wallet">
            <WalletButton />
          </span>
          <button
            ref={opener}
            type="button"
            className="k-nav__menu"
            aria-expanded={open}
            aria-controls="k-sheet"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <m.div
            id="k-sheet"
            ref={sheet}
            className="k-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={reduce ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <nav className="k-sheet__places" aria-label="Main">
              {PLACES.map((p, i) => (
                <m.div
                  key={p.href}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 + i * 0.035, duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href={p.href} className="k-sheet__place" aria-current={active === p.href ? "page" : undefined}>
                    <span className="k-sheet__t">{p.label}</span>
                    <span className="k-sheet__n">{p.note}</span>
                  </Link>
                </m.div>
              ))}
            </nav>
            <div className="k-sheet__wallet">
              <WalletButton />
              <NetworkBadge />
            </div>
            <nav className="k-sheet__more" aria-label="More">
              {SECONDARY.map((s) => (
                <Link key={s.href} href={s.href} className="k-chip">
                  {s.label}
                </Link>
              ))}
            </nav>
          </m.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
