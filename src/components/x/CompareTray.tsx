"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { MAX_COMPARE, onPicked, readPicked, writePicked, type Picked } from "./compare-store";

/**
 * The bar that appears once something is picked.
 *
 * It sits over the bottom of the page and names what is in the comparison, so
 * a person browsing never loses track of what they chose three screens ago.
 */
export default function CompareTray() {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    const sync = () => setPicked(readPicked());
    sync();
    const off = onPicked(sync);
    const full = () => {
      setWarn(true);
      setTimeout(() => setWarn(false), 2600);
    };
    window.addEventListener("mandate:compare-full", full);
    return () => {
      off();
      window.removeEventListener("mandate:compare-full", full);
    };
  }, []);

  if (!picked.length) return null;

  return (
    <div className="x-tray" role="region" aria-label="Agents selected to compare">
      <div className="x-wrap x-tray__in">
        <span className="x-tray__n">
          <strong>{picked.length}</strong> of {MAX_COMPARE} selected
        </span>
        <ul className="x-tray__list">
          {picked.map((p) => (
            <li key={p.tokenId}>
              <span className="x-tray__name">{p.name}</span>
              <button
                type="button"
                className="x-tray__rm"
                aria-label={`Remove ${p.name}`}
                onClick={() => writePicked(readPicked().filter((x) => x.tokenId !== p.tokenId))}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {warn ? <span className="x-tray__warn">Up to {MAX_COMPARE}. Remove one first.</span> : null}
        <div className="x-tray__act">
          <button type="button" className="x-btn x-btn--ghost x-btn--sm" onClick={() => writePicked([])}>
            Clear
          </button>
          {picked.length >= 2 ? (
            <Link className="x-btn x-btn--primary x-btn--sm" href={`/compare?ids=${picked.map((p) => p.tokenId).join(",")}`}>
              Compare {picked.length}
            </Link>
          ) : (
            <span className="x-tray__hint">Pick one more to compare</span>
          )}
        </div>
      </div>
    </div>
  );
}
