"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Every route arrives the same way, a short fade, so moving between pages
 * feels like one place and not a reload. Opacity only: a transform or filter
 * here would become the containing block of every fixed element below it
 * (the phone sheet, the compare tray, the passkey prompt). Each page stages
 * its own entrance inside this.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
