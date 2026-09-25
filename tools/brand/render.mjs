// Renders the brand kit's PNGs from tools/brand/out with the system's Chrome.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const out = new URL('./out/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' });

async function svgPng(file, w, h, name) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const svg = readFileSync(out + file, 'utf8').replace('<svg ', `<svg style="width:${w}px;height:${h}px;display:block" `);
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({ path: out + name, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
}
async function page(file, w, h, name, dsf) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  await p.goto('file://' + out + file);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out + name });
  await p.close();
}

await svgPng('mandate-mark.svg', 1024, 1024, 'mandate-mark-1024.png');
await svgPng('mandate-mark.svg', 512, 512, 'mandate-mark-512.png');
for (const s of [16, 32, 48, 180, 192, 512]) await svgPng('favicon.svg', s, s, `favicon-${s}.png`);
for (const f of ['mandate-logo-on-dark.svg', 'mandate-logo-on-light.svg']) {
  const [, , vw, vh] = readFileSync(out + f, 'utf8').match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  await svgPng(f, Math.round((vw / vh) * 240), 240, f.replace('.svg', '.png'));
}
await page('compose-avatar.html', 800, 800, 'avatar@800.png', 1);
await page('compose-x-header.html', 1500, 500, 'x-header@2x.png', 2);
await page('compose-og.html', 1200, 630, 'og@2x.png', 2);
await b.close();
console.log('rendered');
