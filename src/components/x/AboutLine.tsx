"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** The wallet or position a visitor came from checking, from `?about=`, when it is one. */
export function readAbout(search: string): string | undefined {
  const raw = new URLSearchParams(search).get("about") ?? "";
  return /^0x[0-9a-fA-F]{40}$/.test(raw) || /^\d{1,12}$/.test(raw) ? raw : undefined;
}

/**
 * "For wallet 0x…, the one you just checked." Read in the browser, not on the
 * server: reading the query there made every agent page uncacheable, and they
 * went from cached for five minutes to built on every visit (17 Nov).
 */
export default function AboutLine() {
  const [about, setAbout] = useState<string>();
  useEffect(() => setAbout(readAbout(window.location.search)), []);
  if (!about) return null;
  const wallet = about.startsWith("0x");
  return (
    <p className="k-small mk-agent-about">
      For {wallet ? "wallet" : "position"} <span className="k-mono">{wallet ? `${about.slice(0, 6)}…${about.slice(-4)}` : `#${about}`}</span>, the one you just checked. It is filled in when you hire.{" "}
      <Link className="k-link" href={`/diagnose?q=${about}`}>
        Back to the check
      </Link>
    </p>
  );
}
