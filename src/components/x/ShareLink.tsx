"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A link with a copy button, for a builder to hand to the people who use their agent. */
export default function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* The clipboard is blocked here; the link is on screen to select. */
    }
  };
  return (
    <div className="k-well bd-share">
      <a className="bd-share__url k-mono" href={url}>
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button type="button" className="k-btn k-btn--sm" onClick={() => void copy()}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
