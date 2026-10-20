"use client";

import { useEffect, useRef } from "react";
import { character, JOBS } from "./engine";
import { watchMotion } from "./clock";

export type CharacterJob = "rebalancing" | "grid-trading" | "yield-optimisation" | "health-factor";
export type CharacterState = "awake" | "ready" | "dozing" | "working" | "delivered" | "failed" | "graveyard" | "leashed";
export type CharacterView = "front" | "three-quarter" | "side" | "back";

/**
 * An agent, drawn. Every agent has its own face, seeded by its token id, in
 * its job's family and colour; Mandate's own four are the founders (`house`).
 * The pose is the agent's real state (see lib/view/state.ts), never a mood.
 *
 * A client component on purpose: the server still renders the SVG into the
 * HTML, but the hydration payload then carries only these props (a few bytes)
 * instead of the whole drawing a second time; that was 300 KB on the home page.
 * The engine is seeded and deterministic, so the browser draws the same SVG.
 * The motion is CSS (styles/characters.css) and stills under reduced motion. `slot` keeps the SVG's gradient ids unique
 * when the same agent appears twice on one page.
 */
export default function Agent({
  job,
  seed,
  state = "ready",
  size = 96,
  house = false,
  view = "front",
  slot = "",
  label,
  className,
  omit,
}: {
  job: string | null | undefined;
  seed: string;
  state?: CharacterState;
  size?: number;
  house?: boolean;
  view?: CharacterView;
  slot?: string;
  /** Spoken name; omit for a decorative drawing beside a visible name. */
  label?: string;
  className?: string;
  /** Parts a scene draws itself: "leash" (the line off a leashed agent), "ball". */
  omit?: ("leash" | "ball")[];
}) {
  const j = job && job in JOBS ? job : "rebalancing";
  const uid = `a${seed}${state.slice(0, 2)}${size}${view.slice(0, 1)}${slot}`.replace(/[^a-zA-Z0-9]/g, "");
  const svg = character({ job: j, seed, state, size, house, view, uid, omit });
  const ref = useRef<HTMLSpanElement>(null);
  // Under 40 px a blink or a breath cannot be seen, so the smallest stay still and cost nothing.
  useEffect(() => (ref.current && size >= 40 ? watchMotion(ref.current) : undefined), [size]);
  return (
    <span
      ref={ref}
      className={`k-char${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
