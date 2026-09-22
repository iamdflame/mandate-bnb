/**
 * Every agent's picture, drawn from what it does.
 *
 * Agents on the registry either publish no image or publish something we
 * cannot vouch for, so a grid of them reads as a wall of blanks and stock
 * robots. This draws each one instead: the geometry comes from its job, and
 * the particulars come from a seed made of its token id and name, so the same
 * agent always gets the same picture and two agents in one category are
 * recognisably siblings without being identical.
 *
 *   rebalancing   concentric range bands and a price marker drifting in them
 *   grid          a price ladder with execution points where price crosses it
 *   yield         capital routed between venue nodes, one route live
 *   health        a radial health ring with the liquidation threshold marked
 *
 * Pure SVG, server-rendered, no images. Motion is a slow CSS transform that
 * stops under reduced motion.
 */

import type { Category } from "@/lib/config";

type Shape = "banner" | "square";

const HUE: Record<Category, string> = {
  rebalancing: "var(--c-cat-rebalance)",
  "grid-trading": "var(--c-cat-grid)",
  "yield-optimisation": "var(--c-cat-yield)",
  "health-factor": "var(--c-cat-health)",
};

/** A small deterministic PRNG. Same seed, same picture, on server and client. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 10) / 10;

function Backdrop({ w, h, id }: { w: number; h: number; id: string }) {
  return (
    <>
      <defs>
        <pattern id={`dots-${id}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.07)" />
        </pattern>
        <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(11,14,17,0)" />
          <stop offset="1" stopColor="rgba(11,14,17,0.55)" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#dots-${id})`} />
    </>
  );
}

function Rebalance({ w, h, rand, hue }: { w: number; h: number; rand: () => number; hue: string }) {
  const cx = w * (0.62 + rand() * 0.2);
  const cy = h * (0.55 + rand() * 0.25);
  const rings = 5 + Math.floor(rand() * 3);
  const band = 1 + Math.floor(rand() * (rings - 2));
  const step = Math.max(w, h) / (rings + 1.5);
  const tickX = cx - step * (band + 0.5) * (0.4 + rand() * 0.5);
  return (
    <g>
      {Array.from({ length: rings }, (_, i) => {
        const r = step * (i + 1);
        const live = i === band || i === band + 1;
        return (
          <circle
            key={i}
            cx={r2(cx)}
            cy={r2(cy)}
            r={r2(r)}
            fill="none"
            stroke={live ? hue : "rgba(255,255,255,0.09)"}
            strokeOpacity={live ? 0.75 : 1}
            strokeWidth={live ? 1.6 : 1}
            strokeDasharray={i % 2 ? "2 5" : undefined}
          />
        );
      })}
      {/* The position's range: the annulus it is supposed to sit inside. */}
      <path
        d={`M ${r2(cx - step * (band + 2))} ${r2(cy)} A ${r2(step * (band + 2))} ${r2(step * (band + 2))} 0 0 1 ${r2(cx + step * (band + 2))} ${r2(cy)}`}
        fill="none"
        stroke={hue}
        strokeOpacity="0.14"
        strokeWidth={r2(step * 0.9)}
      />
      <g className="x-art-drift">
        <line x1={r2(tickX)} y1="6" x2={r2(tickX)} y2={h - 6} stroke="var(--c-accent)" strokeWidth="1.4" strokeOpacity="0.9" />
        <circle cx={r2(tickX)} cy={r2(cy - step * (band + 1))} r="3.2" fill="var(--c-accent)" />
      </g>
    </g>
  );
}

function Grid({ w, h, rand, hue }: { w: number; h: number; rand: () => number; hue: string }) {
  const levels = 5 + Math.floor(rand() * 3);
  const gap = h / (levels + 1);
  const pts: [number, number][] = [];
  const n = 9 + Math.floor(rand() * 4);
  for (let i = 0; i <= n; i++) {
    const x = (w / n) * i;
    const y = h * 0.5 + Math.sin(i * (0.9 + rand() * 0.6) + rand() * 3) * h * 0.28 + (rand() - 0.5) * gap;
    pts.push([x, Math.max(8, Math.min(h - 8, y))]);
  }
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"} ${r2(x)} ${r2(y)}`).join(" ");
  // Execution points: where the price path crosses a ladder level.
  const hits: [number, number][] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    for (let l = 1; l <= levels; l++) {
      const ly = gap * l;
      if ((y0 - ly) * (y1 - ly) < 0) {
        const t = (ly - y0) / (y1 - y0);
        hits.push([x0 + t * (x1 - x0), ly]);
      }
    }
  }
  return (
    <g>
      {Array.from({ length: levels }, (_, i) => (
        <line key={i} x1="0" y1={r2(gap * (i + 1))} x2={w} y2={r2(gap * (i + 1))} stroke={hue} strokeOpacity={i % 2 ? 0.16 : 0.3} strokeWidth="1" strokeDasharray="3 4" />
      ))}
      <path d={path} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinejoin="round" />
      {hits.slice(0, 14).map(([x, y], i) => (
        <circle key={i} className="x-art-pulse" style={{ animationDelay: `${(i % 7) * 0.35}s` }} cx={r2(x)} cy={r2(y)} r="3" fill={i % 3 ? hue : "var(--c-accent)"} />
      ))}
    </g>
  );
}

function Yield({ w, h, rand, hue }: { w: number; h: number; rand: () => number; hue: string }) {
  const count = 4 + Math.floor(rand() * 3);
  const nodes = Array.from({ length: count }, (_, i) => {
    const x = (w / (count + 1)) * (i + 1) + (rand() - 0.5) * 18;
    const y = h * (0.25 + rand() * 0.55);
    return [x, y, 3 + rand() * 4] as [number, number, number];
  });
  const best = Math.floor(rand() * count);
  return (
    <g>
      {nodes.slice(1).map(([x, y], i) => {
        const [px, py] = nodes[i];
        const mx = (px + x) / 2;
        const d = `M ${r2(px)} ${r2(py)} C ${r2(mx)} ${r2(py)}, ${r2(mx)} ${r2(y)}, ${r2(x)} ${r2(y)}`;
        return <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.2" />;
      })}
      {/* The live route: capital moving toward the venue paying best. */}
      {nodes.map(([x, y], i) => {
        if (i === best) return null;
        const [bx, by] = nodes[best];
        const mx = (x + bx) / 2;
        const d = `M ${r2(x)} ${r2(y)} C ${r2(mx)} ${r2(y - 22)}, ${r2(mx)} ${r2(by + 22)}, ${r2(bx)} ${r2(by)}`;
        return i % 2 ? null : <path key={`r${i}`} className="x-art-flow" d={d} fill="none" stroke={hue} strokeOpacity="0.8" strokeWidth="1.6" strokeDasharray="4 6" />;
      })}
      {nodes.map(([x, y, r], i) => (
        <g key={`n${i}`}>
          <circle cx={r2(x)} cy={r2(y)} r={r2(r + 5)} fill={i === best ? hue : "rgba(255,255,255,0.05)"} fillOpacity={i === best ? 0.18 : 1} />
          <circle cx={r2(x)} cy={r2(y)} r={r2(r)} fill={i === best ? "var(--c-accent)" : "var(--c-elevated)"} stroke={i === best ? "none" : "rgba(255,255,255,0.25)"} />
        </g>
      ))}
    </g>
  );
}

function Health({ w, h, rand, hue }: { w: number; h: number; rand: () => number; hue: string }) {
  const cx = w * (0.7 + rand() * 0.12);
  const cy = h * 0.95;
  const R = Math.min(w, h * 1.7) * 0.5;
  const arc = (r: number, from: number, to: number) => {
    const a0 = Math.PI * (1 - from);
    const a1 = Math.PI * (1 - to);
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy - r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    return `M ${r2(x0)} ${r2(y0)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(x1)} ${r2(y1)}`;
  };
  const health = 0.45 + rand() * 0.45;
  const threshold = 0.18 + rand() * 0.1;
  const ta = Math.PI * (1 - threshold);
  return (
    <g>
      {[0.55, 0.72, 0.88, 1].map((f, i) => (
        <path key={i} d={arc(R * f, 0, 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray={i % 2 ? "2 5" : undefined} />
      ))}
      <path d={arc(R * 0.8, 0, 1)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
      <path d={arc(R * 0.8, 0, health)} fill="none" stroke={hue} strokeOpacity="0.85" strokeWidth="10" strokeLinecap="round" />
      {/* The line that matters: below it, the position can be liquidated. */}
      <line
        x1={r2(cx + R * 0.62 * Math.cos(ta))}
        y1={r2(cy - R * 0.62 * Math.sin(ta))}
        x2={r2(cx + R * 1.0 * Math.cos(ta))}
        y2={r2(cy - R * 1.0 * Math.sin(ta))}
        stroke="var(--c-err)"
        strokeWidth="1.6"
      />
      <g className="x-art-drift" style={{ transformOrigin: `${r2(cx)}px ${r2(cy)}px` }}>
        <circle
          cx={r2(cx + R * 0.8 * Math.cos(Math.PI * (1 - health)))}
          cy={r2(cy - R * 0.8 * Math.sin(Math.PI * (1 - health)))}
          r="4"
          fill="var(--c-accent)"
        />
      </g>
    </g>
  );
}

function Unfiled({ w, h, rand }: { w: number; h: number; rand: () => number }) {
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => (
        <rect
          key={i}
          x={r2(rand() * w * 0.9)}
          y={r2(rand() * h * 0.8)}
          width={r2(20 + rand() * 60)}
          height="1"
          fill="rgba(255,255,255,0.12)"
        />
      ))}
    </g>
  );
}

export default function AgentArtwork({
  category,
  seed,
  shape = "banner",
  title,
}: {
  category: Category | null;
  /** Anything stable per agent: the token id and name are what callers pass. */
  seed: string;
  shape?: Shape;
  /** Accessible name. The art is decorative when omitted. */
  title?: string;
}) {
  const [w, h] = shape === "banner" ? [320, 112] : [240, 240];
  const rand = rng(`${category ?? "none"}:${seed}`);
  const id = Math.floor(rand() * 1e9).toString(36);
  const hue = category ? HUE[category] : "rgba(255,255,255,0.3)";
  const props = { w, h, rand, hue };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className="x-art"
    >
      <Backdrop w={w} h={h} id={id} />
      {category === "rebalancing" ? <Rebalance {...props} /> : null}
      {category === "grid-trading" ? <Grid {...props} /> : null}
      {category === "yield-optimisation" ? <Yield {...props} /> : null}
      {category === "health-factor" ? <Health {...props} /> : null}
      {!category ? <Unfiled w={w} h={h} rand={rand} /> : null}
      <rect width={w} height={h} fill={`url(#fade-${id})`} />
    </svg>
  );
}
