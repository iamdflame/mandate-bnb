// @ts-nocheck
/*
  The Mandate characters: one family per job, the agent's real state drives the pose.
  Soft rendered volume, drawn to the brand's tokens. Generated SVG strings; see Agent.tsx
  for the React wrapper and src/styles/characters.css for the motion. Vendored from the
  character sheet (.apex design work); edit here.
*/
// Mandate characters, soft rendered volume.
// One family per job; the agent's real state drives the pose. Self-contained ES module, no dependencies.
//
//   import { character, css, anchors } from './characters.js';
//   el.innerHTML = character({ job: 'rebalancing', seed: '344119', state: 'awake', size: 96 });
//   // put `css` in the page once (it carries the keyframes and the reduced-motion still).
//
// Construction: every character is one soft silicone body (a single closed volume), two polished
// enamel eyes, and one enamel signature feature. Light: key from the top left, a rim in the job
// colour from behind (bottom right), a broad matte sheen on the body, sharp speculars on enamel only,
// a soft cast shadow and a faint coloured floor spill. Animated groups never carry a transform
// attribute, so CSS owns them; positioning lives on inner groups.

const INK = '#0b0d0e', PAPER = '#fafaf8', MUTED = '#a2a8af';
const S1 = '#111417', S2 = '#161a1e', S3 = '#1b2025';
const SIG = '#13b98a', SIG_L = '#2dd4a4', SIG_D = '#0b7a5c';

export const JOBS = {
  'rebalancing':        { key: 'range', name: 'Range-1', label: 'Rebalancing',   main: '#3cc4b4', light: '#86e3d6', ground: '#0c1a1b' },
  'grid-trading':       { key: 'grid',  name: 'Grid-1',  label: 'Grid trading',  main: '#e8a33a', light: '#f4cf86', ground: '#1b150c' },
  'yield-optimisation': { key: 'yield', name: 'Yield-1', label: 'Yield',         main: '#6fcf6a', light: '#b0e8a6', ground: '#0f190f' },
  'health-factor':      { key: 'guard', name: 'Guard-1', label: 'Health factor', main: '#ef7a6a', light: '#f6b0a3', ground: '#1c1011' },
};
export const STATES = ['awake', 'ready', 'dozing', 'working', 'delivered', 'failed', 'graveyard', 'leashed'];
export const VIEWS = ['front', 'three-quarter', 'side', 'back'];

// ---------- small helpers ----------
const n = (v) => +(+v).toFixed(2);
const hx = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
function hash(str) { let h = 2166136261 >>> 0; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }
function rng(seed) { let a = hash(seed) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- body geometry ----------
// A closed soft volume from four cubic segments; k values move it between pebble, block, seed and dome.
const SHAPES = {
  range: { h: 47, rx: 38, wf: .56, kT: .8, kST: .78, kSB: .9, kB: .9, ff: .44, side: .7 },
  grid:  { h: 72, rx: 24.5, wf: .5, kT: .9, kST: .9, kSB: .93, kB: .93, ff: .29, side: .84 },
  yield: { h: 57, rx: 30, wf: .62, kT: .5, kST: .74, kSB: .88, kB: .88, ff: .5, side: .9 },
  guard: { h: 62, rx: 33, wf: .48, kT: .58, kST: .6, kSB: .97, kB: .95, ff: .4, side: .8 },
};
const GROUND = 102;

function bodyOf(key, T, view) {
  const s = SHAPES[key];
  const vw = view === 'three-quarter' ? .93 : view === 'side' ? s.side : 1;
  const h = s.h * T.h, rx = s.rx * T.w * vw, top = GROUND - h, bottom = GROUND, cx = 60;
  const waist = top + h * s.wf;
  const B = { key, cx, top, bottom, h, rx, waist, kT: s.kT, kST: s.kST, kSB: s.kSB, kB: s.kB, view };
  B.path = blobPath(B);
  B.faceY = top + h * s.ff;
  B.shift = view === 'three-quarter' ? rx * .3 : view === 'side' ? rx * .64 : 0;
  B.fx = cx + B.shift;
  B.collarY = Math.min(B.faceY + (key === 'range' ? 12.5 : 16), bottom - 11);
  return B;
}
function blobPath({ cx, top, bottom, rx, waist, kT, kST, kSB, kB }) {
  const L = cx - rx, R = cx + rx, a = waist - (waist - top) * kST, b = waist + (bottom - waist) * kSB;
  return `M${n(cx)} ${n(top)}C${n(cx + rx * kT)} ${n(top)} ${n(R)} ${n(a)} ${n(R)} ${n(waist)}C${n(R)} ${n(b)} ${n(cx + rx * kB)} ${n(bottom)} ${n(cx)} ${n(bottom)}C${n(cx - rx * kB)} ${n(bottom)} ${n(L)} ${n(b)} ${n(L)} ${n(waist)}C${n(L)} ${n(a)} ${n(cx - rx * kT)} ${n(top)} ${n(cx)} ${n(top)}Z`;
}
// y of the body's upper outline at x (the head surface), sampled from the top cubic.
function topY(B, x) {
  const d = Math.min(Math.abs(x - B.cx), B.rx * .999);
  const P = [[0, B.top], [B.rx * B.kT, B.top], [B.rx, B.waist - (B.waist - B.top) * B.kST], [B.rx, B.waist]];
  let best = B.top, bd = 1e9;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const X = w.reduce((s, k, j) => s + k * P[j][0], 0), Y = w.reduce((s, k, j) => s + k * P[j][1], 0);
    if (Math.abs(X - d) < bd) { bd = Math.abs(X - d); best = Y; }
  }
  return best;
}
// half width of the body at height y (for collars and bands).
function halfW(B, y) {
  const up = y < B.waist;
  const P = up ? [[0, B.top], [B.rx * B.kT, B.top], [B.rx, B.waist - (B.waist - B.top) * B.kST], [B.rx, B.waist]]
               : [[B.rx, B.waist], [B.rx, B.waist + (B.bottom - B.waist) * B.kSB], [B.rx * B.kB, B.bottom], [0, B.bottom]];
  let best = B.rx, bd = 1e9;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, u = 1 - t, w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    const X = w.reduce((s, k, j) => s + k * P[j][0], 0), Y = w.reduce((s, k, j) => s + k * P[j][1], 0);
    if (Math.abs(Y - y) < bd) { bd = Math.abs(Y - y); best = X; }
  }
  return best;
}

// ---------- seeded traits ----------
const EYES = ['oval', 'round', 'capsule', 'wide', 'lidded'];
const ACCS = ['spectacles', 'monocle', 'scarf', 'bowtie', 'headband', 'pin'];
const PATS = ['speckles', 'belly', 'band', 'cap', 'stripes', 'freckles'];
const HOUSE_DELAY = { range: 0, grid: -.8, yield: -1.7, guard: -2.4 };

function traits(job, seed, house, key) {
  const r = rng((house ? 'house|' : '') + job + '|' + seed);
  if (house) return { w: 1, h: 1, eye: 'oval', gap: 1, es: 1, tone: 0, acc: 'none', pat: 'none', fh: 1, rungs: 3, leaves: 2, delay: HOUSE_DELAY[key], r };
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  const t = {
    w: .86 + r() * .24, h: .86 + r() * .2, eye: pick(EYES), gap: .8 + r() * .34, es: .86 + r() * .28,
    tone: -.32 + r() * .64, acc: pick(ACCS), pat: pick(PATS), fh: .82 + r() * .3,
    rungs: r() < .5 ? 3 : 4, leaves: r() < .55 ? 2 : 3, delay: -n(r() * 4), r,
  };
  return t;
}

// ---------- the seal (the brand mark), r = base + amp·cos(24t) ----------
function sealPath(cx, cy, R) {
  let d = '';
  for (let i = 0; i <= 144; i++) {
    const t = (i / 144) * Math.PI * 2, r = R * (.976 + .024 * Math.cos(24 * t));
    d += (i ? 'L' : 'M') + n(cx + r * Math.cos(t)) + ' ' + n(cy + r * Math.sin(t));
  }
  return d + 'Z';
}
function seal(cx, cy, R, gid, small) {
  const k = R / 46;
  const pts = [[-19, 16], [-19, -14], [0, 6], [19, -14], [19, 16]].map(([x, y]) => `${n(cx + x * k)},${n(cy + y * k)}`).join(' ');
  return `<path d="${sealPath(cx, cy, R)}" fill="url(#${gid})"/>` +
    (small ? '' : `<path d="${sealPath(cx, cy, R * .86)}" fill="none" stroke="${SIG_L}" stroke-opacity=".35" stroke-width="${n(k * 2.2)}"/>`) +
    `<polyline points="${pts}" fill="none" stroke="#06140F" stroke-width="${n(8.5 * k)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${n(cx - R * .38)}" cy="${n(cy - R * .44)}" r="${n(R * .16)}" fill="#fff" opacity=".55"/>`;
}

// ---------- the character ----------
let COUNT = 0;

export function character(opts = {}) {
  const job = JOBS[opts.job] ? opts.job : 'rebalancing';
  const J = JOBS[job];
  const key = J.key;
  const state = STATES.includes(opts.state) ? opts.state : 'ready';
  const view = VIEWS.includes(opts.view) ? opts.view : 'front';
  const size = opts.size ?? 120;
  const house = !!opts.house;
  const seed = String(opts.seed ?? '0');
  const omit = new Set(opts.omit || []);
  const id = opts.uid || `mc${(++COUNT).toString(36)}${(hash(job + seed + state + view) % 1679616).toString(36)}`;
  const T = traits(job, seed, house, key);
  const small = size < 60;
  const grave = state === 'graveyard';
  const failed = state === 'failed';
  const B = bodyOf(key, T, view);
  const face = view !== 'back';

  // palette: job tokens plus tints and shades of them
  let main = J.main, light = J.light;
  if (T.tone > 0) main = mix(main, light, T.tone * .55); else main = mix(main, INK, -T.tone * .42);
  if (failed) { main = mix(main, MUTED, .22); light = mix(light, MUTED, .15); }
  if (grave) { main = mix(mix(main, MUTED, .72), PAPER, .12); light = mix(light, PAPER, .55); }
  const P = {
    main, light,
    hi: mix(light, PAPER, .4), mid: mix(light, main, .55),
    deep: mix(main, INK, .5), deeper: mix(main, INK, .74), shade: mix(main, INK, .3),
    ink: grave ? '#3a4148' : '#0a0c0e',
  };

  const defs = [];
  const g = (s) => `${id}${s}`;
  // body: key light top left, falling to a shade of the job colour bottom right
  defs.push(`<radialGradient id="${g('b')}" cx=".34" cy=".24" r=".95" fx=".3" fy=".18"><stop offset="0" stop-color="${mix(P.light, P.hi, .35)}"/><stop offset=".3" stop-color="${mix(P.light, P.main, .62)}"/><stop offset=".64" stop-color="${P.main}"/><stop offset="1" stop-color="${P.deep}"/></radialGradient>`);
  // rim light from behind in the job colour
  defs.push(`<linearGradient id="${g('r')}" x1=".1" y1=".05" x2=".85" y2="1"><stop offset=".45" stop-color="${P.light}" stop-opacity="0"/><stop offset=".8" stop-color="${P.light}" stop-opacity=".55"/><stop offset="1" stop-color="${mix(P.light, PAPER, .3)}" stop-opacity=".95"/></linearGradient>`);
  // bottom occlusion inside the body
  defs.push(`<linearGradient id="${g('o')}" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="${INK}" stop-opacity="0"/><stop offset="1" stop-color="${INK}" stop-opacity=".38"/></linearGradient>`);
  // matte sheen
  defs.push(`<radialGradient id="${g('s')}"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".55" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
  // enamel eyes
  defs.push(`<radialGradient id="${g('e')}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${grave ? '#5a626a' : '#3a434c'}"/><stop offset=".55" stop-color="${P.ink}"/><stop offset="1" stop-color="#040506"/></radialGradient>`);
  // enamel feature (vertical)
  defs.push(`<linearGradient id="${g('n')}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${mix(P.hi, PAPER, .3)}"/><stop offset=".42" stop-color="${P.light}"/><stop offset="1" stop-color="${P.shade}"/></linearGradient>`);
  // pearl (the price ball, the gauge face)
  defs.push(`<radialGradient id="${g('p')}" cx=".36" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="${mix(PAPER, P.light, .22)}"/><stop offset="1" stop-color="${mix(P.light, P.main, .55)}"/></radialGradient>`);
  // the green seal
  defs.push(`<linearGradient id="${g('g')}" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${SIG_L}"/><stop offset=".55" stop-color="${SIG}"/><stop offset="1" stop-color="${SIG_D}"/></linearGradient>`);
  // shadows
  defs.push(`<radialGradient id="${g('h')}"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset=".6" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`);
  defs.push(`<radialGradient id="${g('f')}"><stop offset="0" stop-color="${P.main}" stop-opacity=".2"/><stop offset="1" stop-color="${P.main}" stop-opacity="0"/></radialGradient>`);
  defs.push(`<clipPath id="${g('c')}"><path d="${B.path}"/></clipPath>`);

  const cx = B.cx, bot = B.bottom;
  const delay = T.delay;
  const O = (x, y) => `style="transform-origin:${n(x)}px ${n(y)}px"`;

  // ---------- ground ----------
  let ground = '';
  if (grave) {
    const pw = B.rx + 8;
    defs.push(`<linearGradient id="${g('pl')}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3036"/><stop offset=".18" stop-color="${S3}"/><stop offset="1" stop-color="${S1}"/></linearGradient>`);
    ground = `<ellipse cx="${cx}" cy="113" rx="${n(pw + 6)}" ry="3.5" fill="url(#${g('h')})"/>` +
      `<rect x="${n(cx - pw)}" y="${bot - 1}" width="${n(pw * 2)}" height="12" rx="2.5" fill="url(#${g('pl')})"/>` +
      `<rect x="${n(cx - pw)}" y="${bot - 1}" width="${n(pw * 2)}" height="1.4" rx=".7" fill="#3a4148"/>` +
      (small ? '' : `<rect x="${n(cx - 7)}" y="${bot + 5}" width="14" height="1.2" rx=".6" fill="#3a4148"/>`);
  } else {
    const shCls = state === 'awake' || state === 'leashed' ? 'a-shbob' : state === 'delivered' ? 'a-shhop' : state === 'working' && key === 'grid' ? 'a-shstep' : '';
    ground = `<ellipse cx="${cx}" cy="${bot + 2}" rx="${n(B.rx * 1.55)}" ry="9" fill="url(#${g('f')})"/>` +
      `<g class="${shCls}" ${O(cx, bot)}><ellipse cx="${cx}" cy="${bot + 1.2}" rx="${n(B.rx * 1.05)}" ry="4.6" fill="url(#${g('h')})"/>` +
      `<ellipse cx="${cx}" cy="${bot + .4}" rx="${n(B.rx * .72)}" ry="1.8" fill="#000" opacity=".45"/></g>`;
  }

  // ---------- body ----------
  const sheen = `<ellipse cx="${n(cx - B.rx * .38 + B.shift * .2)}" cy="${n(B.top + B.h * .2)}" rx="${n(B.rx * .42)}" ry="${n(B.h * .16)}" fill="url(#${g('s')})" transform="rotate(-22 ${n(cx - B.rx * .38)} ${n(B.top + B.h * .2)})"/>`;
  let body = `<path d="${B.path}" fill="url(#${g('b')})"/>`;
  let inside = pattern(T, B, P, small, face) +
    `<rect x="0" y="0" width="120" height="120" fill="url(#${g('o')})"/>` +
    `<path d="${B.path}" fill="none" stroke="url(#${g('r')})" stroke-width="${small ? 4 : 5.5}"/>`;
  body += `<g clip-path="url(#${g('c')})">${inside}</g>` + sheen +
    `<path d="${B.path}" fill="none" stroke="url(#${g('r')})" stroke-width=".9" opacity=".9"/>`;
  if (grave) body += `<path d="${B.path}" fill="none" stroke="${MUTED}" stroke-opacity=".28" stroke-width=".8"/>`;

  // ---------- features ----------
  const F = features(key, B, T, P, state, small, g, defs, omit, O);

  // ---------- face ----------
  const fc = face ? faceOf(B, T, P, state, small, g, key, opts) : { eyes: '', rest: '' };
  const acc = face && !small && !grave ? accessory(T, B, P, state, g) : '';

  // house mark: a small green seal pin on the chest (ours), not when leashed (the tag is the seal then)
  let pin = '';
  if (house && face && !small && state !== 'leashed' && !grave) {
    const px = key === 'grid' ? B.fx - B.rx * .6 : B.fx - (view === 'front' ? B.rx * .5 : B.rx * .2), py = key === 'grid' ? B.top + 6.5 : Math.min(B.collarY + 3, bot - 8);
    const pr = key === 'range' ? 3.8 : key === 'grid' ? 3.6 : 4.4;
    if (!(key === 'guard' && view === 'front' && false)) pin = `<ellipse cx="${n(px + .6)}" cy="${n(py + 1.2)}" rx="${n(pr)}" ry="${n(pr * .8)}" fill="${INK}" opacity=".3"/>` + seal(px, py, pr, g('g'), true);
  }

  // ---------- state overlays ----------
  let over = '', outside = '', leash = '';
  if (state === 'dozing') {
    const zx = B.fx + B.rx * (key === 'range' ? .78 : .5) + 2, zy = B.top - (key === 'range' ? 20 : 4);
    const z = (x, y, s) => `<path d="M${n(x)} ${n(y)}h${n(5 * s)}l${n(-5 * s)} ${n(6 * s)}h${n(5 * s)}" fill="none" stroke="${MUTED}" stroke-width="${small ? 2.2 : 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
    outside += `<g class="a-z">${z(zx, zy - 2, small ? 1.4 : 1)}</g>` + (small ? '' : `<g class="a-z2">${z(zx + 7, zy - 11, .7)}</g>`);
  }
  if (state === 'delivered') {
    const sx = cx, sy = (key === 'range' ? B.top - 26 : key === 'yield' ? B.top - 31 : B.top - 8);
    const ray = (a, r1, r2) => { const c = Math.cos(a), s = Math.sin(a); return `M${n(sx + c * r1)} ${n(sy + s * r1)}L${n(sx + c * r2)} ${n(sy + s * r2)}`; };
    const rays = [-2.5, -1.95, -1.2, -.64].map((a) => ray(a, 9, 14)).join('');
    const rays2 = [-2.5, -1.95, -1.2, -.64].map((a) => ray(a + Math.PI * 0, 16.5, 17.5)).join('');
    outside += `<g class="a-spark" ${O(sx, sy)}><path d="${rays}" stroke="${SIG_L}" stroke-width="${small ? 2.6 : 1.8}" stroke-linecap="round"/>${small ? '' : `<path d="${rays2}" stroke="${SIG_L}" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`}</g>`;
  }
  if (failed) {
    const mx = cx + B.rx * (key === 'range' ? .95 : .78), my = (key === 'range' ? topY(B, cx + B.rx * .95) - 3 : B.top + 3);
    const r = small ? 7 : 5.6;
    over += `<g class="a-pulse" ${O(mx, my)}><circle cx="${n(mx)}" cy="${n(my)}" r="${n(r + 1.4)}" fill="${INK}"/><circle cx="${n(mx)}" cy="${n(my)}" r="${n(r)}" fill="#ef7a6a"/>` +
      `<rect x="${n(mx - .9)}" y="${n(my - r * .6)}" width="1.8" height="${n(r * .7)}" rx=".9" fill="${PAPER}"/><circle cx="${n(mx)}" cy="${n(my + r * .42)}" r="1" fill="${PAPER}"/></g>`;
  }
  if (state === 'leashed' && face) {
    const a = anchorsOf(B, view);
    const cy0 = B.collarY, hw = halfW(B, cy0);
    const collar = `M${n(cx - hw - 2)} ${n(cy0 - 3.5)}Q${n(B.fx)} ${n(cy0 + 5)} ${n(cx + hw + 2)} ${n(cy0 - 3.5)}`;
    over += `<g clip-path="url(#${g('c')})"><path d="${collar}" fill="none" stroke="${S3}" stroke-width="${small ? 4 : 2.8}"/><path d="${collar}" fill="none" stroke="${SIG_L}" stroke-opacity=".35" stroke-width=".5" transform="translate(0 -.9)"/></g>`;
    const tr = small ? 7 : 5.8;
    over += `<g class="a-swing" ${O(a.ring[0], a.ring[1])}><circle cx="${n(a.ring[0])}" cy="${n(a.ring[1])}" r="1.7" fill="none" stroke="#cfd3d6" stroke-width="1.1"/>` +
      `<ellipse cx="${n(a.tag[0] + .8)}" cy="${n(a.tag[1] + 1.4)}" rx="${n(tr)}" ry="${n(tr * .8)}" fill="${INK}" opacity=".35"/>${seal(a.tag[0], a.tag[1], tr, g('g'), small)}</g>`;
    if (!omit.has('leash')) {
      const [x0, y0] = a.ring, x1 = small ? 103 : 113, y1 = y0 - 14;
      const d = `M${n(x0)} ${n(y0)}C${n(x0 + 14)} ${n(y0 + 14)} ${n(x1 - 22)} ${n(y1 + 12)} ${x1} ${n(y1)}`;
      leash = `<path d="${d}" fill="none" stroke="${SIG_D}" stroke-width="${small ? 3.6 : 2.8}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${SIG}" stroke-width="${small ? 2.4 : 1.8}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${SIG_L}" stroke-opacity=".7" stroke-width=".6" transform="translate(-.3 -.6)"/>`;
    }
  }

  // ---------- motion ----------
  const moveCls = {
    awake: 'a-bob', ready: 'a-breathe', dozing: 'a-doze', delivered: 'a-hop', failed: 'a-tremble',
    graveyard: '', leashed: 'a-bob2',
    working: key === 'range' ? 'a-rtilt' : key === 'grid' ? 'a-gstep' : key === 'yield' ? 'a-ywalk' : 'a-brace',
  }[state];
  const lean = state === 'leashed' ? `transform="rotate(2.5 ${cx} ${bot})"` : failed ? `transform="rotate(-2 ${cx} ${bot})"` : '';

  const aria = esc(opts.title || `${house ? J.name : 'Agent ' + seed}, ${J.label.toLowerCase()}, ${state}`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" class="mc mc-${key} mc-${state}${small ? ' mc-sm' : ''}" viewBox="${small ? '18 22 84 84' : '8 10 104 104'}" width="${size}" height="${size}" role="img" aria-label="${aria}" style="--mc-d:${delay}s">` +
    `<defs>${defs.join('')}</defs>` +
    ground + (F.stage || '') +
    `<g class="${moveCls}" ${O(cx, bot)}><g ${lean}>` +
    (grave ? `<g opacity=".62">` : '<g>') +
    F.back + body + F.mid + fc.eyes + fc.rest + acc + pin + F.front + over +
    `</g></g></g>` + leash + outside + `</svg>`;
  return svg;
}

// the viewBox a character is drawn in, as [x, y, side]
export const frame = (size = 120) => (size < 60 ? [18, 22, 84] : [8, 10, 104]);

// where the collar ring and the seal tag sit, in viewBox units (for scenes that draw their own leash)
function anchorsOf(B, view) {
  const ringX = B.fx + (view === 'front' ? -B.rx * .12 : 0), ringY = B.collarY + 2.6;
  const tag = [ringX, ringY + 6];
  return { ring: [ringX, ringY], tag, top: B.top, bottom: B.bottom, cx: B.cx, rx: B.rx };
}
export function anchors(opts = {}) {
  const job = JOBS[opts.job] ? opts.job : 'rebalancing';
  const key = JOBS[job].key;
  const T = traits(job, String(opts.seed ?? '0'), !!opts.house, key);
  const B = bodyOf(key, T, opts.view || 'front');
  const a = anchorsOf(B, opts.view || 'front');
  // leashed characters lean 2.5deg about the ground point
  const rot = (p) => { const r = 2.5 * Math.PI / 180, dx = p[0] - B.cx, dy = p[1] - B.bottom; return [B.cx + dx * Math.cos(r) - dy * Math.sin(r), B.bottom + dx * Math.sin(r) + dy * Math.cos(r)]; };
  return { ...a, ring: rot(a.ring), tag: rot(a.tag) };
}

// ---------- face ----------
function faceOf(B, T, P, state, small, g, key, opts = {}) {
  const view = B.view;
  const boost = small ? 1.32 : 1;
  let rx = 4, ry = 5.5;
  const shape = T.eye;
  if (shape === 'round') { rx = 4.7; ry = 4.7; } else if (shape === 'capsule') { rx = 3.3; ry = 6.2; } else if (shape === 'wide') { rx = 5.2; ry = 4.1; }
  rx *= T.es * boost; ry *= T.es * boost;
  let gap = 22 * T.gap * (small ? 1.08 : 1);
  if (key === 'grid') gap = Math.min(gap, B.rx * 1.05);
  const ey = B.faceY;
  const vs = view === 'three-quarter' ? .8 : 1;
  gap *= vs;
  let eyes;
  if (view === 'side') eyes = [{ x: B.fx + B.rx * .08, sx: .62, near: true }];
  else eyes = [{ x: B.fx - gap / 2, sx: view === 'three-quarter' ? .74 : 1 }, { x: B.fx + gap / 2, sx: 1, near: true }];
  const WL = { range: [0, -1.4], grid: [.4, -1.2], yield: [1.3, -1], guard: [1.5, .3] };
  const lk = opts.look || (state === 'leashed' ? [1.6, 0] : state === 'working' ? WL[key] : view === 'side' ? [1, 0] : [0, 0]);
  const look = lk[0], lookY = lk[1];
  const ink = P.ink;
  const sw = small ? 2.4 : 1.7;
  const line = (d) => `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

  const open = (e, opt = {}) => {
    const x = e.x + look, sx = e.sx, y = ey + lookY;
    const rY = ry * (opt.sq ?? 1), flat = Math.min(opt.flat ?? (shape === 'lidded' ? .3 : 0), .6);
    let shapeSvg;
    if (flat > 0) {
      // a level lid: the top of the eye cut by a straight line, the rest of the ellipse below it
      const y0 = -rY + 2 * rY * flat, w0 = rx * Math.sqrt(Math.max(0, 1 - (y0 / rY) ** 2));
      shapeSvg = `<path d="M${n(-w0)} ${n(y0)}L${n(w0)} ${n(y0)}A${n(rx)} ${n(rY)} 0 ${y0 < 0 ? 1 : 0} 1 ${n(-w0)} ${n(y0)}Z" fill="url(#${g('e')})"/>`;
    } else shapeSvg = `<ellipse rx="${n(rx)}" ry="${n(rY)}" fill="url(#${g('e')})"/>`;
    const top = -rY + 2 * rY * flat;
    const cl = Math.max(top + rx * .42, -rY * .4);
    return `<g transform="translate(${n(x)} ${n(y)}) scale(${sx} 1)">${shapeSvg}` +
      `<circle cx="${n(-rx * .32 + look * .25)}" cy="${n(cl + lookY * .25)}" r="${n(rx * (small ? .4 : .3))}" fill="${PAPER}"/>` +
      (small ? '' : `<circle cx="${n(rx * .36)}" cy="${n(rY * .42)}" r="${n(rx * .12)}" fill="${PAPER}" opacity=".4"/>`) + `</g>`;
  };
  const closedArc = (e, up) => { const x = e.x, w = rx * 1.05 * e.sx; return line(up ? `M${n(x - w)} ${n(ey + 1.2)}Q${n(x)} ${n(ey - ry * 1.15)} ${n(x + w)} ${n(ey + 1.2)}` : `M${n(x - w)} ${n(ey)}Q${n(x)} ${n(ey + ry * .85)} ${n(x + w)} ${n(ey)}`); };
  const flatLine = (e) => { const w = rx * .95 * e.sx; return line(`M${n(e.x - w)} ${n(ey + 1)}L${n(e.x + w)} ${n(ey + 1)}`); };

  let eyesSvg = '', rest = '';
  const mx = (view === 'side' ? B.fx + B.rx * .26 : B.fx + (view === 'three-quarter' ? 1.5 : 0)) + look * .5;
  const my = ey + ry + 4.2 * (small ? 1.2 : 1);
  const mouthCol = P.deeper;
  const msw = small ? 2.2 : 1.5;
  const mouth = (d, fill) => fill ? `<path d="${d}" fill="${mouthCol}"/>` : `<path d="${d}" fill="none" stroke="${mouthCol}" stroke-width="${msw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ms = view === 'side' ? .6 : 1;

  switch (state) {
    case 'awake':
      eyesSvg = eyes.map((e) => open(e, { sq: 1.05, flat: shape === 'lidded' ? .22 : 0 })).join('');
      const brows = small ? '' : eyes.map((e) => { const w = rx * 1.1 * e.sx, y = ey - ry * 1.05 - 3.4; return `<path d="M${n(e.x - w)} ${n(y + 1)}Q${n(e.x)} ${n(y - 1.2)} ${n(e.x + w)} ${n(y + 1)}" fill="none" stroke="${P.deeper}" stroke-opacity=".75" stroke-width="1.3" stroke-linecap="round"/>`; }).join('');
      rest = mouth(`M${n(mx - 2.6 * ms)} ${n(my)}Q${n(mx)} ${n(my + 2)} ${n(mx + 2.6 * ms)} ${n(my)}`) + brows;
      break;
    case 'ready':
      eyesSvg = eyes.map((e) => open(e, { sq: .94, flat: shape === 'lidded' ? .32 : .2 })).join('');
      rest = mouth(`M${n(mx - 2 * ms)} ${n(my)}Q${n(mx)} ${n(my + 1.1)} ${n(mx + 2 * ms)} ${n(my)}`);
      break;
    case 'working':
      eyesSvg = eyes.map((e) => open(e, { sq: .96, flat: shape === 'lidded' ? .26 : .12 })).join('');
      rest = mouth(`M${n(mx - 2 * ms)} ${n(my + .4)}L${n(mx + 2.2 * ms)} ${n(my - .2)}`);
      break;
    case 'dozing':
      eyesSvg = eyes.map((e) => closedArc(e, false)).join('');
      rest = `<ellipse cx="${n(mx)}" cy="${n(my + .8)}" rx="${n(1.4 * ms * (small ? 1.3 : 1))}" ry="${n(1.7 * (small ? 1.3 : 1))}" fill="${mouthCol}"/>`;
      break;
    case 'delivered':
      eyesSvg = eyes.map((e) => closedArc(e, true)).join('');
      rest = mouth(`M${n(mx - 4.2 * ms)} ${n(my - .6)}Q${n(mx)} ${n(my + 5.6)} ${n(mx + 4.2 * ms)} ${n(my - .6)}Z`, true);
      break;
    case 'failed': {
      // one eye open and worried, the other squinting
      const [a, b] = eyes;
      eyesSvg = open(a, { sq: 1, flat: 0 });
      if (b) {
        const w = rx * 1.05 * b.sx;
        eyesSvg += line(`M${n(b.x - w)} ${n(ey - 1.2)}L${n(b.x + w * .9)} ${n(ey + .8)}`) + `<g transform="translate(0 1.6)">${open(b, { sq: .32, flat: 0 })}</g>`;
      }
      if (!small) {
        const brow = (x, dir, s) => line(`M${n(x - 4 * s)} ${n(ey - ry - 3.2 + (dir > 0 ? 1.8 : -.2))}L${n(x + 4 * s)} ${n(ey - ry - 3.2 + (dir > 0 ? -.2 : 1.8))}`);
        rest += brow(a.x, 1, a.sx);
        if (b) rest += brow(b.x, -1, b.sx);
      }
      rest += mouth(`M${n(mx - 3.4 * ms)} ${n(my + 1)}q${n(1.1 * ms)} -1.6 ${n(2.25 * ms)} 0q${n(1.1 * ms)} 1.6 ${n(2.25 * ms)} 0q${n(1.1 * ms)} -1.6 ${n(2.25 * ms)} 0`);
      break;
    }
    case 'graveyard':
      eyesSvg = eyes.map(flatLine).join('');
      rest = '';
      break;
    case 'leashed':
      eyesSvg = eyes.map((e) => open(e, { sq: 1, flat: shape === 'lidded' ? .24 : 0 })).join('');
      rest = mouth(`M${n(mx - 2.4 * ms)} ${n(my)}Q${n(mx + .3)} ${n(my + 2)} ${n(mx + 2.8 * ms)} ${n(my - .3)}`);
      break;
  }
  const blink = ['awake', 'ready', 'working', 'leashed'].includes(state);
  const eyesWrap = blink ? `<g class="a-blink" style="transform-origin:${n(B.fx)}px ${n(ey)}px">${eyesSvg}</g>` : eyesSvg;
  return { eyes: eyesWrap, rest };
}

// ---------- patterns (clipped to the body) ----------
function pattern(T, B, P, small, face) {
  if (small || T.pat === 'none') return '';
  const r = rng('pat' + T.w + T.h);
  const { cx, top, h, rx } = B;
  switch (T.pat) {
    case 'speckles': {
      let s = '';
      for (let i = 0; i < 16; i++) {
        const x = cx - rx + r() * rx * 2, y = top + 4 + r() * (h - 8);
        if (face && Math.abs(y - B.faceY) < 9 && Math.abs(x - B.fx) < 16) continue;
        s += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(.7 + r() * .9)}" fill="${P.hi}" opacity="${n(.22 + r() * .2)}"/>`;
      }
      return s;
    }
    case 'belly': return `<ellipse cx="${n(B.fx)}" cy="${n(B.bottom - h * .2)}" rx="${n(rx * .6)}" ry="${n(h * .3)}" fill="${P.hi}" opacity=".2"/>`;
    case 'band': { const y = Math.min(B.faceY + 12, B.bottom - 14); return `<rect x="0" y="${n(y)}" width="120" height="5" fill="${P.deeper}" opacity=".38"/><rect x="0" y="${n(y + 5)}" width="120" height=".8" fill="${P.hi}" opacity=".2"/>`; }
    case 'cap': return `<ellipse cx="${n(cx + B.shift * .4)}" cy="${n(top - h * .08)}" rx="${n(rx * 1.25)}" ry="${n(h * .3)}" fill="${P.deeper}" opacity=".42"/>`;
    case 'stripes': {
      let s = '';
      for (let x = -40; x < 140; x += 7) s += `<path d="M${x} ${n(B.bottom)}L${x + 40} ${n(top)}" stroke="${P.hi}" stroke-opacity=".12" stroke-width="2.2"/>`;
      return s;
    }
    case 'freckles': {
      if (!face) return '';
      let s = '';
      const gap = 22 * T.gap;
      for (const sgn of [-1, 1]) {
        const x0 = B.fx + sgn * (gap / 2 + 2.5), y0 = B.faceY + 8;
        for (let i = 0; i < 3; i++) s += `<circle cx="${n(x0 + (i - 1) * 2.2 * sgn)}" cy="${n(y0 + (i === 1 ? -.9 : 0))}" r=".75" fill="${P.deeper}" opacity=".55"/>`;
      }
      return s;
    }
  }
  return '';
}

// ---------- accessories (one per agent) ----------
function accessory(T, B, P, state, g) {
  if (T.acc === 'none') return '';
  const metal = '#d9dcdf', dark = S2;
  const gap = 22 * T.gap * (B.view === 'three-quarter' ? .8 : 1);
  const ey = B.faceY;
  const look = state === 'leashed' ? 1.6 : 0;
  const eR = 5.8 * T.es + 2.4;
  const L = B.fx - gap / 2 + look, R = B.fx + gap / 2 + look;
  switch (T.acc) {
    case 'spectacles': {
      if (B.view === 'side') return `<circle cx="${n(B.fx + B.rx * .08)}" cy="${n(ey)}" r="${n(eR)}" fill="#fff" fill-opacity=".06" stroke="${metal}" stroke-width="1.1" transform="scale(1 1)"/>`;
      const sx = B.view === 'three-quarter' ? .74 : 1;
      return `<g fill="#fff" fill-opacity=".07" stroke="${metal}" stroke-width="1.1"><ellipse cx="${n(L)}" cy="${n(ey)}" rx="${n(eR * sx)}" ry="${n(eR)}"/><ellipse cx="${n(R)}" cy="${n(ey)}" rx="${n(eR)}" ry="${n(eR)}"/></g>` +
        `<path d="M${n(L + eR * sx)} ${n(ey - 1)}Q${n((L + R) / 2)} ${n(ey - 3.4)} ${n(R - eR)} ${n(ey - 1)}" fill="none" stroke="${metal}" stroke-width="1.1"/>` +
        `<path d="M${n(R - eR * .55)} ${n(ey - eR * .5)}l2 -1.4" stroke="#fff" stroke-opacity=".7" stroke-width=".8" stroke-linecap="round"/>`;
    }
    case 'monocle': {
      const x = B.view === 'side' ? B.fx + B.rx * .08 : R;
      const yb = Math.min(B.bottom - 10, ey + 22);
      return `<circle cx="${n(x)}" cy="${n(ey)}" r="${n(eR)}" fill="#fff" fill-opacity=".07" stroke="${metal}" stroke-width="1.3"/>` +
        `<path d="M${n(x + eR * .7)} ${n(ey + eR * .7)}C${n(x + eR + 3)} ${n(ey + 10)} ${n(x + 2)} ${n(yb - 4)} ${n(x + 6)} ${n(yb)}" fill="none" stroke="${metal}" stroke-width=".7" stroke-dasharray="1.2 1"/>` +
        `<path d="M${n(x - eR * .45)} ${n(ey - eR * .55)}l2.2 -1.2" stroke="#fff" stroke-opacity=".75" stroke-width=".8" stroke-linecap="round"/>`;
    }
    case 'scarf': {
      if (state === 'leashed') return '';
      const y = B.collarY - 1, hw = halfW(B, y);
      const d = `M${n(B.cx - hw - 2)} ${n(y - 3)}Q${n(B.fx)} ${n(y + 5)} ${n(B.cx + hw + 2)} ${n(y - 3)}`;
      const tx = B.fx - B.rx * .42, ty = y + 1.6;
      return `<g clip-path="url(#${g('c')})"><path d="${d}" fill="none" stroke="${dark}" stroke-width="6"/><path d="${d}" fill="none" stroke="${P.light}" stroke-opacity=".5" stroke-width="1" transform="translate(0 -.4)"/></g>` +
        `<path d="M${n(tx)} ${n(ty)}l-3.6 13 l5.4 .9 l1.4 -13.4z" fill="${dark}"/><path d="M${n(tx - 1.6)} ${n(ty + 6)}l4.4 .6" stroke="${P.light}" stroke-opacity=".5" stroke-width="1"/>`;
    }
    case 'bowtie': {
      if (state === 'leashed') return '';
      const x = B.fx, y = B.collarY + 1.5;
      return `<path d="M${n(x)} ${n(y)}l-7 -4.2q-1.2 4.2 0 8.4zM${n(x)} ${n(y)}l7 -4.2q1.2 4.2 0 8.4z" fill="${dark}" stroke="${P.light}" stroke-opacity=".45" stroke-width=".7" stroke-linejoin="round"/><rect x="${n(x - 2)}" y="${n(y - 2.4)}" width="4" height="4.8" rx="1.4" fill="${S3}" stroke="${P.light}" stroke-opacity=".6" stroke-width=".6"/>`;
    }
    case 'headband': {
      const y = ey - 5.8 * T.es - 5.4;
      if (y < B.top + 2.5) return '';
      const hw = halfW(B, y);
      const d = `M${n(B.cx - hw - 2)} ${n(y + 1.5)}Q${n(B.fx)} ${n(y - 1.6)} ${n(B.cx + hw + 2)} ${n(y + 1.5)}`;
      return `<g clip-path="url(#${g('c')})"><path d="${d}" fill="none" stroke="${dark}" stroke-width="4.2"/><path d="${d}" fill="none" stroke="${P.hi}" stroke-opacity=".55" stroke-width=".9"/></g>`;
    }
    case 'pin': {
      const x = B.fx + (B.view === 'front' ? B.rx * .48 : B.rx * .1), y = Math.min(B.collarY + 4, B.bottom - 8);
      return `<circle cx="${n(x + .5)}" cy="${n(y + 1)}" r="3.6" fill="${INK}" opacity=".3"/><path d="M${n(x)} ${n(y - 3.6)}L${n(x + 3.6)} ${n(y)}L${n(x)} ${n(y + 3.6)}L${n(x - 3.6)} ${n(y)}Z" fill="${S3}" stroke="${P.hi}" stroke-width=".9" stroke-linejoin="round"/><path d="M${n(x)} ${n(y - 1.6)}L${n(x + 1.6)} ${n(y)}L${n(x)} ${n(y + 1.6)}L${n(x - 1.6)} ${n(y)}Z" fill="${P.hi}"/>`;
    }
  }
  return '';
}

// ---------- signature features ----------
function features(key, B, T, P, state, small, g, defs, omit, O) {
  const out = { back: '', mid: '', front: '', stage: '' };
  const working = state === 'working';
  const { cx, view } = B;
  const enamel = `url(#${g('n')})`;
  const pearl = `url(#${g('p')})`;

  if (key === 'range') {
    // two range marks standing on the head, the price ball kept between them
    const off = B.rx * .6 * (view === 'side' ? 0 : 1) * (view === 'three-quarter' ? .86 : 1);
    const mid = cx + B.shift * .55;
    const bw = small ? 6.2 : 4.6, foot = small ? 5.5 : 5.6;
    const bh = (small ? 20 : 21) * T.fh;
    const bracket = (x, dir, far) => {
      const hy = topY(B, x) + 1.6, y0 = hy - bh;
      const ft = view === 'side' ? 1.4 : foot;
      const d = `M${n(x + dir * ft)} ${n(y0)}L${n(x)} ${n(y0)}L${n(x)} ${n(hy)}L${n(x + dir * ft)} ${n(hy)}`;
      const gid = g('bk' + (dir > 0 ? 'l' : 'r'));
      defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${n(x - 3)}" y1="${n(y0)}" x2="${n(x + 3)}" y2="${n(hy + 2)}"><stop offset="0" stop-color="${mix(P.hi, PAPER, .35)}"/><stop offset=".45" stop-color="${P.light}"/><stop offset="1" stop-color="${P.shade}"/></linearGradient>`);
      return `<ellipse cx="${n(x + dir * 2.8)}" cy="${n(hy + 1.8)}" rx="6" ry="1.7" fill="${INK}" opacity=".32"/>` +
        `<path d="${d}" fill="none" stroke="url(#${gid})" stroke-width="${bw}" stroke-linecap="round" stroke-linejoin="round" ${far ? 'opacity=".8"' : ''}/>` +
        (small ? '' : `<path d="M${n(x - bw * .22)} ${n(y0 + 2.4)}L${n(x - bw * .22)} ${n(hy - 3)}" stroke="#fff" stroke-opacity=".6" stroke-width=".9" stroke-linecap="round"/>`);
    };
    let marks;
    if (view === 'side') marks = '';
    else marks = bracket(mid - off, 1, view === 'three-quarter') + bracket(mid + off, -1, false);
    // the ball
    let ball = '';
    if (!omit.has('ball')) {
      const br = small ? 7.4 : 6.6;
      const by = topY(B, mid) - br + 1.2;
      const dropY = n(topY(B, mid + 13) - topY(B, mid));
      const inner = `<ellipse cx="${n(mid + 1.4)}" cy="${n(by + br - .6)}" rx="${n(br * .8)}" ry="1.6" fill="${INK}" opacity=".35"/>` +
        `<circle cx="${n(mid)}" cy="${n(by)}" r="${n(br)}" fill="${pearl}"/>` +
        `<circle cx="${n(mid)}" cy="${n(by)}" r="${n(br)}" fill="none" stroke="${P.main}" stroke-opacity=".5" stroke-width=".8"/>` +
        `<ellipse cx="${n(mid - br * .34)}" cy="${n(by - br * .4)}" rx="${n(br * .3)}" ry="${n(br * .2)}" fill="#fff" transform="rotate(-30 ${n(mid - br * .34)} ${n(by - br * .4)})"/>`;
      ball = working ? `<g class="a-rball" style="--by:${dropY}px">${inner}</g>` : inner;
      if (state === 'dozing' || state === 'graveyard') ball = `<g transform="translate(0 0)">${inner}</g>`;
    }
    if (view === 'side') out.front = bracket(mid - 6, 1, true) + ball + bracket(mid + 5, -1, false);
    else out.front = marks + ball;
  }

  if (key === 'grid') {
    // a ladder inlaid on the front; working: it climbs a ladder behind it, one rung per step
    const n0 = T.rungs, top = B.collarY + (small ? 4 : 5), bottom = B.bottom - (small ? 9 : 8);
    const sp = (bottom - top) / (n0 - 1 || 1);
    const hw = Math.min(halfW(B, (top + bottom) / 2) * .62, 15) * (view === 'three-quarter' ? .84 : 1);
    const lx = B.fx + (view === 'three-quarter' ? -1 : 0);
    if (view !== 'side' && view !== 'back') {
      const railW = small ? 0 : 1.6;
      let inlay = '';
      if (!small) inlay += `<path d="M${n(lx - hw)} ${n(top - 3)}V${n(bottom + 3)}M${n(lx + hw)} ${n(top - 3)}V${n(bottom + 3)}" stroke="${P.deeper}" stroke-opacity=".55" stroke-width="${railW + 1}" stroke-linecap="round"/>` +
        `<path d="M${n(lx - hw + .9)} ${n(top - 2)}V${n(bottom + 3)}M${n(lx + hw + .9)} ${n(top - 2)}V${n(bottom + 3)}" stroke="${P.hi}" stroke-opacity=".25" stroke-width=".6"/>`;
      const rungs = small ? 3 : n0;
      const sp2 = (bottom - top) / (rungs - 1);
      const rh = small ? 4.6 : 3.4;
      for (let i = 0; i < rungs; i++) {
        const y = top + i * sp2;
        inlay += `<rect x="${n(lx - hw - (small ? 2 : 1.4))}" y="${n(y - rh / 2)}" width="${n(hw * 2 + (small ? 4 : 2.8))}" height="${rh}" rx="${n(rh / 2)}" fill="${enamel}"/>`;
        if (!small) inlay += `<rect x="${n(lx - hw)}" y="${n(y - rh / 2 + .5)}" width="${n(hw * 1.2)}" height=".7" rx=".35" fill="#fff" opacity=".55"/>`;
      }
      // the level it trades at: a lit rung
      if (!small && state !== 'graveyard' && state !== 'dozing') {
        const baseIdx = working ? rungs - 1 : Math.floor((rungs - 1) / 2);
        const y = top + baseIdx * sp2;
        const mark = `<rect x="${n(lx - hw - 1.4)}" y="${n(y - rh / 2 - .5)}" width="${n(hw * 2 + 2.8)}" height="${rh + 1}" rx="${n((rh + 1) / 2)}" fill="${P.hi}"/><rect x="${n(lx - hw)}" y="${n(y - rh / 2)}" width="${n(hw * 1.3)}" height=".8" rx=".4" fill="#fff" opacity=".8"/><path d="M${n(lx + hw + 3.2)} ${n(y)}l3 -2.4v4.8z" fill="${P.hi}"/>`;
        inlay += working ? `<g class="a-gmark" style="--sp:${n(-sp2)}px">${mark}</g>` : mark;
      }
      out.mid = inlay;
    } else if (view === 'side') {
      let s = '';
      const ex = cx + B.rx - 1.2;
      for (let i = 0; i < n0; i++) { const y = top + i * sp; s += `<rect x="${n(ex - 1)}" y="${n(y - 1.7)}" width="3.6" height="3.4" rx="1.4" fill="${enamel}"/>`; }
      out.mid = s;
    }
    if (working) {
      // the ladder it climbs, standing behind it
      const lw = B.rx + 4.5, y0 = B.top - 22, y1 = B.bottom + 1;
      let lad = `<path d="M${n(cx - lw)} ${n(y0)}V${n(y1)}M${n(cx + lw)} ${n(y0)}V${n(y1)}" stroke="${P.deep}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M${n(cx - lw - .7)} ${n(y0 + 1)}V${n(y1)}M${n(cx + lw - .7)} ${n(y0 + 1)}V${n(y1)}" stroke="${P.light}" stroke-opacity=".45" stroke-width=".8"/>`;
      for (let y = B.bottom - 6; y > y0 + 2; y -= 6) lad += `<rect x="${n(cx - lw)}" y="${n(y - 1)}" width="${n(lw * 2)}" height="2" rx="1" fill="${P.shade}" opacity=".9"/>`;
      out.stage = `<g opacity=".95">${lad}</g>`;
    }
  }

  if (key === 'yield') {
    // a sprout grows from the crown; working: it carries a coin to a better spot
    const bx = cx + B.shift * .5, by = B.top + 2.2;
    const s = (small ? 1.25 : 1) * T.fh;
    const tipY = by - 13 * s;
    const leaf = (x, y, len, ang, w) => {
      const d = `M0 0C${n(len * .25)} ${n(-len * w)} ${n(len * .75)} ${n(-len * w)} ${n(len)} 0C${n(len * .75)} ${n(len * w * .7)} ${n(len * .25)} ${n(len * w * .7)} 0 0Z`;
      return `<g transform="translate(${n(x)} ${n(y)}) rotate(${ang})"><path d="${d}" fill="${enamel}"/>` + (small ? '' : `<path d="M1.5 0Q${n(len * .5)} ${n(-len * .06)} ${n(len * .86)} 0" fill="none" stroke="${P.shade}" stroke-opacity=".6" stroke-width=".7"/><path d="M${n(len * .2)} ${n(-len * w * .55)}Q${n(len * .45)} ${n(-len * w * .78)} ${n(len * .65)} ${n(-len * w * .62)}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".7" stroke-linecap="round"/>`) + `</g>`;
    };
    const stem = `<path d="M${n(bx)} ${n(by + 2)}C${n(bx - 1)} ${n(by - 4 * s)} ${n(bx + 1.6)} ${n(by - 8 * s)} ${n(bx)} ${n(tipY)}" fill="none" stroke="${P.shade}" stroke-width="${small ? 3 : 2.2}" stroke-linecap="round"/>`;
    const flip = view === 'back' ? -1 : 1;
    let leaves = leaf(bx, tipY + 1, 13 * s, flip > 0 ? -38 : -142, .36) + leaf(bx, tipY + 3, 10 * s, flip > 0 ? -150 : -30, .36);
    if (T.leaves === 3 && !small) leaves += leaf(bx, tipY + .5, 7 * s, -92, .38);
    const sprout = `<ellipse cx="${n(bx)}" cy="${n(by + 1.5)}" rx="4" ry="1.4" fill="${INK}" opacity=".3"/>` + stem + leaves;
    let front = working ? `<g class="a-ysprout" ${O(bx, by + 2)}>${sprout}</g>` : sprout;
    if (working) {
      const kx = cx + 15, ky = topY(B, kx) - 5.2;
      defs.push(`<linearGradient id="${g('k')}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#fbe8bf"/><stop offset=".45" stop-color="#f4cf86"/><stop offset="1" stop-color="#b07a24"/></linearGradient>`);
      const coin = `<ellipse cx="${n(kx + .6)}" cy="${n(ky + 5)}" rx="4.6" ry="1.2" fill="${INK}" opacity=".3"/><circle cx="${n(kx)}" cy="${n(ky)}" r="5.6" fill="url(#${g('k')})"/><circle cx="${n(kx)}" cy="${n(ky)}" r="3.9" fill="none" stroke="#b07a24" stroke-opacity=".7" stroke-width=".8"/><path d="M${n(kx)} ${n(ky - 2)}V${n(ky + 2)}" stroke="#b07a24" stroke-width="1.1" stroke-linecap="round"/><circle cx="${n(kx - 2)}" cy="${n(ky - 2.4)}" r="1" fill="#fff" opacity=".85"/>`;
      front += `<g class="a-ycoin" style="--cy:${n(B.bottom - ky - 2.5)}px">${coin}</g>`;
      // the better spot it is heading for
      out.stage = `<g class="a-yspot" ${O(108, B.bottom + 1)}><ellipse cx="108" cy="${B.bottom + 1}" rx="7" ry="2" fill="none" stroke="${P.light}" stroke-width="1" stroke-dasharray="2 1.6" opacity=".8"/></g>`;
    }
    out.front = front;
  }

  if (key === 'guard') {
    // a shield with a health gauge on it; working: the needle drops toward the red line, it raises the shield, the needle jumps back
    const sc = small ? 1.3 : 1;
    let sx = view === 'front' ? cx + B.rx * .62 : view === 'three-quarter' ? cx + B.rx * .5 : view === 'side' ? cx + B.rx * .86 : cx - B.rx * .7;
    const sy = B.bottom - 19 * sc;
    const sxScale = view === 'side' ? .5 : view === 'three-quarter' ? .86 : 1;
    const shieldD = `M-12 -11Q-12 -14.5 -8.6 -14.5L8.6 -14.5Q12 -14.5 12 -11L12 -1C12 7.5 6 12.6 0 15C-6 12.6 -12 7.5 -12 -1Z`;
    defs.push(`<linearGradient id="${g('sr')}" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="${P.hi}"/><stop offset=".5" stop-color="${P.main}"/><stop offset="1" stop-color="${P.deep}"/></linearGradient>`);
    let inner = `<ellipse cx="-2" cy="16" rx="11" ry="2.4" fill="${INK}" opacity=".3"/>` +
      `<path d="${shieldD}" fill="url(#${g('sr')})"/>`;
    if (view === 'back') {
      inner += `<path d="${shieldD}" fill="none" stroke="${P.deeper}" stroke-opacity=".4" stroke-width="1"/>`;
    } else {
      inner += `<path d="${shieldD}" fill="${pearl}" transform="scale(.8) translate(0 .6)"/>`;
      // gauge: a dial with a red line at the low end
      const R = 7.4, pyv = 3.2;
      const arc = (a0, a1, r) => { const p = (a) => [n(Math.cos(a) * r), n(pyv + Math.sin(a) * r)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`; };
      const D = Math.PI / 180;
      inner += `<path d="${arc(-180 * D, -150 * D, R)}" fill="none" stroke="#e4553f" stroke-width="${small ? 2.6 : 2.2}" stroke-linecap="round"/>`;
      if (!small) {
        inner += `<path d="${arc(-140 * D, 0, R)}" fill="none" stroke="${P.deeper}" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>`;
        for (const a of [-120, -90, -60, -30]) { const c = Math.cos(a * D), s2 = Math.sin(a * D); inner += `<path d="M${n(c * (R - 2.6))} ${n(pyv + s2 * (R - 2.6))}L${n(c * (R - 1))} ${n(pyv + s2 * (R - 1))}" stroke="${P.deeper}" stroke-opacity=".6" stroke-width=".8" stroke-linecap="round"/>`; }
      }
      const restA = state === 'failed' ? -62 : state === 'graveyard' ? -86 : 38;
      const needle = `<g transform="rotate(${restA} 0 ${pyv})"><path d="M-1.1 ${pyv}L0 ${n(pyv - R + .6)}L1.1 ${pyv}Z" fill="${P.ink}" stroke="${P.ink}" stroke-width=".8" stroke-linejoin="round"/></g>`;
      inner += working ? `<g class="a-gneedle" style="transform-origin:0px ${pyv}px">${needle}</g>` : needle;
      inner += `<circle cx="0" cy="${pyv}" r="${small ? 2 : 1.7}" fill="${P.ink}"/>`;
      if (!small) inner += `<path d="M-9.2 -10.6Q-9 -12.6 -6.6 -12.6L-1 -12.6" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1" stroke-linecap="round"/>`;
    }
    const placed = `<g transform="translate(${n(sx)} ${n(sy)}) scale(${n(sc * sxScale)} ${sc})">${inner}</g>`;
    const wrapped = working ? `<g class="a-gshield" ${O(sx, sy + 14)}>${placed}</g>` : placed;
    if (view === 'back') out.back = wrapped; else out.front = wrapped;
  }
  return out;
}

// ---------- motion ----------
