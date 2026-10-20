"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the current tab of a horizontally scrolling sub-navigation in view on
 * a phone, so the place you are in is never scrolled off the edge.
 */
export default function ShowCurrent() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = ref.current?.parentElement;
    const on = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = Math.max(0, on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
  }, []);
  return <span ref={ref} hidden />;
}
