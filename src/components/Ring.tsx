"use client";

/**
 * The ring.
 *
 * A force-directed view of the reviewer graph, simulated live from the real
 * co-review edges. Node radius is feedback volume; an edge exists where two
 * wallets review substantially the same agents, and its opacity is the Jaccard
 * similarity of their agent sets.
 *
 * The shape is the argument. Independent reviewers produce a sparse, ragged
 * graph. What the registry actually contains is a nearly complete one.
 */

import { useEffect, useMemo, useRef, useState } from "react";

export interface RingNode {
  address: string;
  feedbacks: number;
  agents: number;
  flagged: boolean;
  reasons: string[];
}
export interface RingEdge {
  a: string;
  b: string;
  similarity: number;
  shared: number;
}

interface Body extends RingNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export default function Ring({
  nodes,
  edges,
  recordsAnalysed,
  cleanRecords,
}: {
  nodes: RingNode[];
  edges: RingEdge[];
  recordsAnalysed: number;
  cleanRecords: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<RingNode | null>(null);
  const bodiesRef = useRef<Body[]>([]);

  const maxFeedbacks = useMemo(
    () => Math.max(1, ...nodes.map((n) => n.feedbacks)),
    [nodes],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stop = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const w = () => canvas.clientWidth;
    const h = () => canvas.clientHeight;

    // Seed on a circle so the first frames are legible rather than a knot.
    bodiesRef.current = nodes.map((n, i) => {
      const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const rad = Math.min(w(), h()) * 0.33;
      return {
        ...n,
        x: w() / 2 + Math.cos(a) * rad,
        y: h() / 2 + Math.sin(a) * rad,
        vx: 0,
        vy: 0,
        r: 3 + (n.feedbacks / maxFeedbacks) * 13,
      };
    });

    const index = new Map(bodiesRef.current.map((b) => [b.address, b]));
    const links = edges
      .map((e) => ({ a: index.get(e.a), b: index.get(e.b), s: e.similarity }))
      .filter((l): l is { a: Body; b: Body; s: number } => Boolean(l.a && l.b));

    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue("--ink").trim() || "#0e0e0c";
    const gold = css.getPropertyValue("--gold").trim() || "#c8a44b";

    const step = () => {
      const bodies = bodiesRef.current;
      const cx = w() / 2;
      const cy = h() / 2;

      // Repulsion.
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            d2 = 4;
          }
          const d = Math.sqrt(d2);
          const force = 1500 / d2;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Springs along co-review edges. Stronger similarity pulls tighter.
      for (const l of links) {
        const dx = l.b.x - l.a.x;
        const dy = l.b.y - l.a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const rest = 150 - l.s * 90;
        const k = 0.0016 * (0.4 + l.s);
        const f = (d - rest) * k;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        l.a.vx += fx;
        l.a.vy += fy;
        l.b.vx -= fx;
        l.b.vy -= fy;
      }

      // Gravity toward centre, damping, integrate.
      for (const b of bodies) {
        b.vx += (cx - b.x) * 0.0042;
        b.vy += (cy - b.y) * 0.0042;
        b.vx *= 0.86;
        b.vy *= 0.86;
        b.x += b.vx;
        b.y += b.vy;
        const pad = b.r + 4;
        b.x = Math.min(Math.max(b.x, pad), w() - pad);
        b.y = Math.min(Math.max(b.y, pad), h() - pad);
      }
    };

    // Physics alone drifts the graph off-frame: unconnected nodes repel to the
    // edges and drag the clique with them. A fit transform recomputed each
    // frame guarantees the whole graph is always framed, whatever the layout
    // settles into, and is smoothed so it never visibly snaps.
    const view = { scale: 1, tx: 0, ty: 0, init: false };

    const fit = () => {
      const bodies = bodiesRef.current;
      if (!bodies.length) return;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const b of bodies) {
        minX = Math.min(minX, b.x - b.r);
        minY = Math.min(minY, b.y - b.r);
        maxX = Math.max(maxX, b.x + b.r);
        maxY = Math.max(maxY, b.y + b.r);
      }
      const pad = 26;
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const target = Math.min((w() - pad * 2) / bw, (h() - pad * 2) / bh, 2.6);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const tx = w() / 2 - cx * target;
      const ty = h() / 2 - cy * target;
      if (!view.init) {
        view.scale = target;
        view.tx = tx;
        view.ty = ty;
        view.init = true;
      } else {
        const k = 0.08;
        view.scale += (target - view.scale) * k;
        view.tx += (tx - view.tx) * k;
        view.ty += (ty - view.ty) * k;
      }
    };

    const draw = () => {
      const bodies = bodiesRef.current;
      ctx.save();
      ctx.setTransform(dprNow(), 0, 0, dprNow(), 0, 0);
      ctx.clearRect(0, 0, w(), h());
      ctx.translate(view.tx, view.ty);
      ctx.scale(view.scale, view.scale);

      for (const l of links) {
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.06 + l.s * 0.34;
        ctx.lineWidth = (0.6 + l.s * 1.1) / view.scale;
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      }

      for (const b of bodies) {
        ctx.globalAlpha = 1;
        if (b.flagged) {
          ctx.fillStyle = ink;
          ctx.globalAlpha = 0.82;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Unflagged: an outline, so "clean" reads as absence of fill.
          ctx.strokeStyle = gold;
          ctx.lineWidth = 1.4 / view.scale;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const dprNow = () => Math.min(window.devicePixelRatio || 1, 2);

    const loop = () => {
      if (stop) return;
      if (!reduced) step();
      fit();
      draw();
      raf = requestAnimationFrame(loop);
    };

    // Settle before first paint so it never appears as a knot.
    for (let i = 0; i < 260; i++) step();
    fit();
    loop();

    const onMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Undo the fit transform before hit-testing.
      const mx = (ev.clientX - rect.left - view.tx) / view.scale;
      const my = (ev.clientY - rect.top - view.ty) / view.scale;
      let found: Body | null = null;
      for (const b of bodiesRef.current) {
        const dx = mx - b.x;
        const dy = my - b.y;
        if (dx * dx + dy * dy <= (b.r + 5) * (b.r + 5)) found = b;
      }
      setHover(found);
      canvas.style.cursor = found ? "crosshair" : "default";
    };
    const onLeave = () => setHover(null);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);

    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, [nodes, edges, maxFeedbacks]);

  const flagged = nodes.filter((n) => n.flagged).length;
  const survivalPct = recordsAnalysed
    ? ((cleanRecords / recordsAnalysed) * 100).toFixed(1)
    : "0";

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          height: "clamp(360px, 62vh, 620px)",
          border: "1px solid var(--rule)",
          background: "var(--paper-2)",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            pointerEvents: "none",
            maxWidth: "28ch",
          }}
        >
          <div className="label">the reviewer graph</div>
          <div className="fig" style={{ fontSize: 12, color: "var(--ink-70)", marginTop: 6 }}>
            {nodes.length} wallets · {edges.length} co-review edges
          </div>
        </div>

        {hover ? (
          <div
            style={{
              position: "absolute",
              right: 16,
              bottom: 16,
              maxWidth: "38ch",
              background: "var(--paper)",
              border: "1px solid var(--rule)",
              padding: "0.9rem 1rem",
              pointerEvents: "none",
            }}
          >
            <div className="fig" style={{ fontSize: 12, wordBreak: "break-all" }}>
              {hover.address}
            </div>
            <div className="fig" style={{ fontSize: 11, color: "var(--ink-45)", marginTop: 6 }}>
              {hover.feedbacks} records across {hover.agents} agents
            </div>
            {hover.reasons.slice(0, 3).map((r) => (
              <div
                key={r}
                style={{ fontSize: 11.5, color: "var(--ink-70)", marginTop: 6, lineHeight: 1.45 }}
              >
                — {r}
              </div>
            ))}
            {!hover.flagged ? (
              <div style={{ fontSize: 11.5, color: "var(--gold-deep)", marginTop: 6 }}>
                No coordination signal.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem 2.5rem",
          marginTop: "1rem",
          alignItems: "baseline",
        }}
      >
        <Stat value={recordsAnalysed.toLocaleString()} label="records analysed" />
        <Stat value={String(nodes.length)} label="distinct wallets behind them" />
        <Stat value={String(flagged)} label="flagged as coordinated" />
        <Stat value={`${survivalPct}%`} label="records surviving cleaning" accent />
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="fig"
        style={{
          fontSize: "clamp(1.4rem, 2.6vw, 2.1rem)",
          color: accent ? "var(--gold-deep)" : "var(--ink)",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
