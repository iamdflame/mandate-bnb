"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";
import { MAX_COMPARE, onPicked, readPicked, writePicked } from "./compare-store";

/** Adds this agent to the comparison, up to three. */
export default function CompareToggle({ tokenId, name, variant = "icon" }: { tokenId: string; name: string; variant?: "icon" | "label" }) {
  const [on, setOn] = useState(false);
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => {
      const picked = readPicked();
      const mine = picked.some((p) => p.tokenId === tokenId);
      setOn(mine);
      setFull(!mine && picked.length >= MAX_COMPARE);
      // The tile outlines itself when it is part of the comparison.
      ref.current?.closest<HTMLElement>(".x-agent")?.setAttribute("data-compared", mine ? "1" : "0");
    };
    sync();
    return onPicked(sync);
  }, [tokenId]);

  const toggle = () => {
    const picked = readPicked();
    if (picked.some((p) => p.tokenId === tokenId)) writePicked(picked.filter((p) => p.tokenId !== tokenId));
    else if (picked.length < MAX_COMPARE) writePicked([...picked, { tokenId, name }]);
    else window.dispatchEvent(new CustomEvent("mandate:compare-full"));
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`x-cmp${variant === "icon" ? " x-cmp--icon" : ""}${on ? " x-cmp--on" : ""}`}
      aria-pressed={on}
      onClick={toggle}
      title={full ? `You can compare up to ${MAX_COMPARE}. Remove one from the tray first.` : on ? "Remove from comparison" : "Add to comparison"}
    >
      {on ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={15} strokeWidth={2.5} aria-hidden="true" />}
      <span className={variant === "icon" ? "x-sr" : undefined}>{on ? "Comparing" : "Compare"}</span>
    </button>
  );
}
