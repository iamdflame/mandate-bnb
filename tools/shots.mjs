// Screenshots for visual review at phone, tablet and desktop widths.
//   OUT=/some/dir node tools/shots.mjs   (needs the dev server on :3311)
import { chromium } from 'playwright-core';
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
const jobs = [
  ['home-390', '/', 390, 844, true],
  ['agents-390', '/agents', 390, 844, false],
  ['agents-1024', '/agents', 1024, 900, false],
  ['compare-1440', '/compare?ids=342377%2C269704%2C342379', 1440, 1000, false],
  ['categories-1440', '/categories', 1440, 1000, false],
  ['search-1440', '/agents?q=protect+a+loan', 1440, 1000, false],
  ['empty-1440', '/agents?settled=1&max=0.05&category=grid-trading', 1440, 1000, false],
];
for (const [name, path, w, h, full] of jobs) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:3311' + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await p.close();
}
await b.close();
console.log('shots done');
