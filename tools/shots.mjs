// Screenshots for visual review at the widths the design brief names.
//   BASE=http://localhost:3312 OUT=/some/dir [ROUTES="name:/path,..."] [WIDTHS="1440,390"] node tools/shots.mjs
import { chromium } from 'playwright-core';

const B = process.env.BASE || 'http://localhost:3312';
const OUT = process.env.OUT;
if (!OUT) throw new Error('set OUT to a directory');
const SIZES = { 1440: 1000, 1280: 900, 1024: 900, 390: 844 };
const WIDTHS = (process.env.WIDTHS || '1440,1280,1024,390').split(',').map(Number);
const ROUTES = (process.env.ROUTES || [
  'home:/', 'agents:/agents', 'agent:/agents/342377', 'categories:/categories', 'jobs:/jobs',
  'activity:/activity', 'verify:/verify', 'desk:/desk', 'status:/status', 'list:/list',
].join(',')).split(',').filter(Boolean).map((x) => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; });
const FULL = process.env.FULL === '1';

const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
for (const [name, path] of ROUTES) {
  for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w, height: SIZES[w] ?? 900 } });
    try {
      await p.goto(B + path, { waitUntil: 'networkidle', timeout: 90000 });
    } catch {
      /* screenshot whatever rendered */
    }
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: FULL });
    await p.close();
  }
}
await b.close();
console.log(`shots: ${ROUTES.length} routes x ${WIDTHS.length} widths -> ${OUT}`);
