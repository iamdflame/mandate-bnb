"use client";

import { useEffect, useState } from "react";

/**
 * "12 min ago", kept true.
 *
 * Pages here are cached for a few minutes, so an age computed on the server
 * is already wrong by the time anyone reads it. This renders the server's
 * figure first (so the HTML is never empty) and then recomputes against the
 * reader's clock every thirty seconds. The exact time is in the title.
 */
export function relative(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export default function Ago({ iso, prefix }: { iso: string | null | undefined; prefix?: string }) {
  const [text, setText] = useState(() => relative(iso));
  useEffect(() => {
    setText(relative(iso));
    const t = setInterval(() => setText(relative(iso)), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso || !text) return null;
  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()} suppressHydrationWarning>
      {prefix ? `${prefix} ` : ""}
      {text}
    </time>
  );
}
