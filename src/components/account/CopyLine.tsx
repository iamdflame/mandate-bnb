"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** One command a reader can run, as selectable text with a copy button. */
export default function CopyLine({ children, note }: { children: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* Clipboard denied: the command is selectable text either way. */
    }
  };
  return (
    <div className="ac-cmd">
      <div className="ac-cmd__line">
        <span className="ac-cmd__p" aria-hidden="true">
          $
        </span>
        <code className="ac-cmd__t">{children}</code>
        <button type="button" className="k-btn k-btn--sm k-btn--ghost ac-cmd__copy" onClick={copy} aria-label={`Copy: ${children}`}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {note ? <p className="k-small">{note}</p> : null}
    </div>
  );
}
