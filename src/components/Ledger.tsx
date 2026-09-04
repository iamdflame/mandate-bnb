"use client";

/**
 * The opening act.
 *
 * A pinned scroll sequence in which the registry collapses. Every figure it
 * counts through is measured, not chosen for effect: 301,169 registered,
 * 473 carrying any feedback at all, 5 with an endpoint that answers.
 *
 * The field is drawn to canvas rather than the DOM. At this population no
 * amount of div-tuning is going to hold 60fps, and the marks need to be struck
 * individually — which is the entire point of the image.
 */

import { useEffect, useRef, useState } from "react";

export interface LedgerStage {
  at: number;
  value: number;
  label: string;
  note: string;
}

export default function Ledger({
  registered,
  withFeedback,
  withEndpoint,
  capturedAt,
}: {
  registered: number;
  withFeedback: number;
  withEndpoint: number;
  capturedAt: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);

  const stages: LedgerStage[] = [
    {
      at: 0,
      value: registered,
      label: "registered on BNB Smart Chain",
      note: "Every one of them carries an on-chain identity, a name, and a description of what it claims to do.",
    },
    {
      at: 0.42,
      value: withFeedback,
      label: "carry any feedback at all",
      note: "The reputation registry is open to every address at negligible cost. Almost nothing in it was ever written.",
    },
    {
      at: 0.72,
      value: withEndpoint,
      label: "have an endpoint that answers",
      note: "The rest resolve to nothing. They cannot be reached, hired, or asked to do anything.",
    },
  ];

  // Scroll progress, read on rAF rather than on every scroll event.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total <= 0 ? 0 : clamp01(-rect.top / total);
      setProgress(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The field.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#0e0e0c";
    const gold = css.getPropertyValue("--gold").trim() || "#c8a44b";

    // A representative field, not one mark per agent — 301,169 marks would be
    // sub-pixel. Density is chosen so the grid reads as a population.
    const cell = w < 420 ? 6 : 7;
    const cols = Math.floor(w / cell);
    const rows = Math.floor(h / cell);
    const count = cols * rows;
    if (count <= 0) return;

    // Survivors are deterministic so the same marks persist across redraws.
    const survivorsFeedback = Math.max(1, Math.round((withFeedback / registered) * count));
    const survivorsEndpoint = Math.max(1, Math.round((withEndpoint / registered) * count) || 1);

    const p = reduced ? 1 : progress;
    // Two collapses, staged against scroll.
    const keep =
      p < 0.42
        ? count - (count - survivorsFeedback) * ease(p / 0.42)
        : p < 0.72
          ? survivorsFeedback -
            (survivorsFeedback - survivorsEndpoint) * ease((p - 0.42) / 0.3)
          : survivorsEndpoint;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cell + cell / 2;
      const y = row * cell + cell / 2;

      // Deterministic shuffle so survival looks scattered, not banded.
      const rank = hash(i) % count;
      const alive = rank < keep;
      const isFinal = rank < survivorsEndpoint;

      if (alive && isFinal && p > 0.72) {
        // The survivors. Struck gold, ringed so they carry at any size.
        ctx.fillStyle = gold;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = gold;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (alive) {
        // A standing claim.
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(x, y, 1.25, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Struck through: a claim that did not survive the test.
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.13;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 1.9, y + 1.9);
        ctx.lineTo(x + 1.9, y - 1.9);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }, [progress, registered, withFeedback, withEndpoint]);

  const active = stages.reduce((acc, s, i) => (progress >= s.at ? i : acc), 0);
  const stage = stages[active];
  const shown = interpolate(stages, progress);

  return (
    <div ref={wrapRef} style={{ height: "270vh", position: "relative" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100svh",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >

        <header
          className="shell"
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingTop: "1.5rem",
            gap: "1rem",
          }}
        >
          <span className="fig" style={{ fontSize: 13, letterSpacing: "0.3em", fontWeight: 500 }}>
            ASSAY
          </span>
          <span className="label" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-block" }}>BNB Smart Chain</span>{" "}
            <span style={{ display: "inline-block" }}>
              · {new Date(capturedAt).toISOString().slice(0, 10)}
            </span>
          </span>
        </header>

        <div
          className="shell"
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            minHeight: 0,
          }}
        >
          <div className="hero-grid">
            <div style={{ minWidth: 0 }}>
              <div
                className="display tnum"
                style={{
                  fontSize: "clamp(3.25rem, 9.5vw, 11rem)",
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 0.84,
                  letterSpacing: "-0.045em",
                }}
              >
                {shown.toLocaleString("en-US")}
              </div>
              <p
                className="display"
                style={{
                  fontSize: "clamp(1.4rem, 3vw, 2.6rem)",
                  marginTop: "0.3em",
                  maxWidth: "16ch",
                  color: "var(--ink)",
                  transition: "opacity .5s var(--ease)",
                }}
              >
                {stage.label}
              </p>
              <p
                className="prose"
                style={{
                  marginTop: "1.1rem",
                  maxWidth: "42ch",
                  minHeight: "3.4em",
                  fontSize: 14,
                  transition: "opacity .5s var(--ease)",
                }}
              >
                {stage.note}
              </p>
            </div>

            {/* The population as a framed specimen rather than a background.
                Full-bleed, it became a halftone texture that fought the type;
                contained, it reads as the thing under examination. */}
            <figure
              className="hero-figure"
              style={{
                margin: 0,
                display: "grid",
                gridTemplateRows: "1fr auto",
                gap: "0.9rem",
              }}
            >
              <div
                style={{
                  position: "relative",
                  border: "1px solid var(--rule)",
                  background: "var(--paper-2)",
                  aspectRatio: "4 / 3",
                  minHeight: "9rem",
                }}
              >
                <canvas
                  ref={canvasRef}
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                  }}
                />
              </div>

              <ol
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "0.55rem",
                }}
              >
                {stages.map((s, i) => {
                  const reached = active >= i;
                  return (
                    <li
                      key={s.label}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "1rem",
                        borderTop: `1px solid ${reached ? "var(--ink)" : "var(--rule)"}`,
                        paddingTop: "0.4rem",
                        opacity: reached ? 1 : 0.35,
                        transition:
                          "opacity .5s var(--ease), border-color .5s var(--ease)",
                      }}
                    >
                      <span className="label" style={{ lineHeight: 1.35 }}>
                        {s.label}
                      </span>
                      <span
                        className="fig"
                        style={{
                          fontSize: "0.95rem",
                          whiteSpace: "nowrap",
                          color:
                            i === 2 && reached ? "var(--gold-deep)" : "var(--ink)",
                        }}
                      >
                        {s.value.toLocaleString("en-US")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </figure>
          </div>
        </div>

        <footer
          className="shell"
          style={{
            position: "relative",
            paddingBottom: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "2rem",
          }}
        >
          <p className="label" style={{ maxWidth: "34ch", lineHeight: 1.5 }}>
            An assay determines whether ore is actually precious metal. This one
            tests what an agent claims against what the chain proves.
          </p>
          <span className="label" aria-hidden style={{ whiteSpace: "nowrap" }}>
            scroll ↓
          </span>
        </footer>
      </div>
    </div>
  );
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** Deterministic scatter. */
function hash(i: number) {
  let x = (i + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/**
 * Counts between measured stages on a logarithmic path, because a linear
 * count from 301,169 to 5 spends its entire life in six figures and the
 * collapse never reads.
 */
function interpolate(stages: LedgerStage[], p: number) {
  let from = stages[0];
  let to = stages[0];
  for (let i = 0; i < stages.length; i++) {
    if (p >= stages[i].at) {
      from = stages[i];
      to = stages[i + 1] ?? stages[i];
    }
  }
  if (from === to) return from.value;
  const span = to.at - from.at;
  const t = span <= 0 ? 1 : clamp01((p - from.at) / span);
  const lo = Math.log(Math.max(to.value, 1));
  const hi = Math.log(Math.max(from.value, 1));
  return Math.round(Math.exp(hi + (lo - hi) * ease(t)));
}
