"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A colour's swatch that copies its hex when pressed. */
export default function CopyHex({ hex, name, token }: { hex: string; name: string; token: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* The hex is printed beside it. */
    }
  };
  return (
    <button type="button" className="bd-swatch__chip" style={{ background: token }} onClick={() => void copy()} aria-label={`Copy ${name}, ${hex}`}>
      <span className="bd-swatch__copy">
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
