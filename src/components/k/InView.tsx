"use client";

import { useEffect, useRef } from "react";

/**
 * Marks its element `data-in="1"` the first time it scrolls into view, so CSS
 * can play a section's one entrance there and not on load. Without script,
 * or under reduced motion, the CSS shows the finished state.
 */
export default function InView({ as: Tag = "div", className, children, threshold = 0.25, ...rest }: { as?: "div" | "section" | "ol" | "ul"; className?: string; children: React.ReactNode; threshold?: number } & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.in = "0";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            el.dataset.in = "1";
            io.disconnect();
          }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  const Comp = Tag as "div";
  return (
    <Comp ref={ref as React.Ref<HTMLDivElement>} className={className} {...rest}>
      {children}
    </Comp>
  );
}
