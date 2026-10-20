"use client";

import { useEffect, useState } from "react";
import { m, useReducedMotion } from "motion/react";

// Set after the first page has hydrated. The server never sets it, so it is false for every server render.
let arrived = false;

/**
 * Every route arrives the same way, a short fade, so moving between pages
 * feels like one place and not a reload. Opacity only: a transform or filter
 * here would become the containing block of every fixed element below it
 * (the phone sheet, the compare tray, the passkey prompt). Each page stages
 * its own entrance inside this.
 *
 * Only between pages, never on the first load: a page that waits for its
 * JavaScript to fade in waits to be seen at all (Lighthouse put the largest
 * paint at 5.5 s, exactly when hydration finished).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [fade] = useState(() => arrived);
  useEffect(() => {
    arrived = true;
  }, []);
  return (
    <m.div initial={fade && !reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </m.div>
  );
}
