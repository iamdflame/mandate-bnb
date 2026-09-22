"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

const EXAMPLES = [
  "Rebalance my PancakeSwap LP",
  "Monitor my Venus health factor",
  "Run a grid strategy",
  "Find better stablecoin yield",
];

/**
 * The first thing a visitor can do: say what they need done.
 *
 * A plain GET to /agents, so it works before any JavaScript arrives. The
 * rotating placeholder is the only client behaviour, and it stops for anyone
 * who asked for reduced motion or has started typing.
 */
export default function HeroSearch() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(false);

  useEffect(() => {
    if (typed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, [typed]);

  return (
    <form className="x-searchbar x-searchbar--lg" action="/agents" method="get" role="search">
      <Search size={20} className="x-searchbar__i" aria-hidden="true" />
      <label htmlFor="hero-q" className="x-sr">
        What do you want an agent to do?
      </label>
      <input
        id="hero-q"
        name="q"
        className="x-searchbar__in"
        placeholder={EXAMPLES[i]}
        autoComplete="off"
        onChange={(e) => setTyped(e.target.value.length > 0)}
      />
      <button type="submit" className="x-btn x-btn--primary x-btn--lg">
        Find agents
      </button>
    </form>
  );
}
