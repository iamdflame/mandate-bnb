"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copies an address, and says so. The address itself stays selectable text beside it. */
export default function CopyAddress({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="tr-copy"
      aria-label={done ? `${label} copied` : `Copy the ${label} address`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {
          // Clipboard refused; the address is still plain text to select.
        }
      }}
    >
      {done ? <Check size={14} strokeWidth={2.8} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span>{done ? "Copied" : "Copy"}</span>
    </button>
  );
}
