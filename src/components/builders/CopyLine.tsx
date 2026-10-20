"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** One line to run, with a copy button. The line stays selectable text if the clipboard is blocked. */
export default function CopyLine({ text, prompt = "$", label }: { text: string; prompt?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* Selectable either way. */
    }
  };
  return (
    <div className="bd-line">
      <code className="bd-line__t">
        {prompt ? (
          <span className="bd-line__p" aria-hidden="true">
            {prompt}
          </span>
        ) : null}
        {text}
      </code>
      <button type="button" className="bd-line__b" onClick={() => void copy()} aria-label={label ?? "Copy"}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
