"use client";

import { LazyMotion } from "motion/react";

const features = () => import("./motion-features").then((m) => m.default);

/**
 * Motion's features arrive after the first paint. Components use `m.*`, which
 * renders plain elements straight away and starts animating once the features
 * have loaded, so the 40 KB engine is never on the critical path.
 */
export default function MotionRoot({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={features}>{children}</LazyMotion>;
}
