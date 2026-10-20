import "@/styles/account.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Search } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";

export const metadata: Metadata = { title: "Not found | MANDATE" };

/**
 * A wrong address, said plainly, with the places people usually meant.
 * Range-1 keeps a price ball between two marks; here the ball has rolled
 * out of its range, which is what a missing page is. The drawing is
 * decorative and says nothing about Range-1's real state.
 */
export default function NotFound() {
  return (
    <AppShell>
      <section className="ac-lost" aria-labelledby="ac-lost-h">
        <div className="ac-lost__pool" aria-hidden="true" />
        <div className="k-wrap ac-lost__in">
          <div className="ac-lost__scene" aria-hidden="true">
            <div className="ac-lost__floor" />
            <div className="ac-lost__who">
              <Agent job="rebalancing" seed="344119" house size={264} state="failed" omit={["ball"]} slot="lost" />
            </div>
            <span className="ac-lost__track" />
            <svg className="ac-lost__ball" viewBox="0 0 40 40" focusable="false">
              <defs>
                <radialGradient id="ac-lost-pearl" cx=".36" cy=".3" r=".75">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset=".45" stopColor="#e6f6f2" />
                  <stop offset="1" stopColor="#5fd3c4" />
                </radialGradient>
              </defs>
              <circle cx="20" cy="20" r="17" fill="url(#ac-lost-pearl)" />
              <circle cx="20" cy="20" r="17" fill="none" stroke="#3cc4b4" strokeOpacity=".5" strokeWidth="1.4" />
              <ellipse cx="14" cy="13" rx="5" ry="3.2" fill="#fff" transform="rotate(-30 14 13)" />
            </svg>
            <span className="ac-lost__shadow" />
          </div>

          <div className="ac-lost__copy">
            <p className="ac-code k-rise" style={{ ["--i" as string]: 0 }}>
              Error 404
            </p>
            <h1 className="k-display k-rise" id="ac-lost-h" style={{ ["--i" as string]: 1 }}>
              This page is out of range.
            </h1>
            <p className="k-lede k-rise" style={{ ["--i" as string]: 2 }}>
              Every agent registered on BNB Smart Chain has a page here, so a missing one is usually a mistyped number.
            </p>
            <form className="k-field ac-lost__find k-rise" style={{ ["--i" as string]: 3 }} action="/agents" method="get" role="search">
              <Search size={20} aria-hidden="true" />
              <label htmlFor="lost-q" className="k-sr">
                Agent name or number
              </label>
              <input id="lost-q" name="q" placeholder="Agent name or number" autoComplete="off" />
              <button type="submit" className="k-btn k-btn--primary">
                Find an agent <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
              </button>
            </form>
            <div className="k-row k-rise" style={{ ["--i" as string]: 4 }}>
              <Link href="/" className="k-btn k-btn--sm">
                Home
              </Link>
              <Link href="/diagnose" className="k-btn k-btn--sm k-btn--ghost">
                Check a wallet
              </Link>
              <Link href="/help" className="k-btn k-btn--sm k-btn--ghost">
                Help
              </Link>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
