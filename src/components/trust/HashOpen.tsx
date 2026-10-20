"use client";

import { useEffect } from "react";

/**
 * Opens the folded record a link points into. Rows and sections in Trust fold
 * into <details>, and a hash like /graveyard#g-abc must still land on its row:
 * this opens every <details> around the target, then scrolls to it.
 */
export default function HashOpen() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      let n: HTMLElement | null = el;
      while (n) {
        if (n instanceof HTMLDetailsElement) n.open = true;
        n = n.parentElement;
      }
      if (el instanceof HTMLDetailsElement) el.open = true;
      el.setAttribute("data-target", "1");
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
