import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox","--use-gl=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const [path, name] of [["/office/yield-optimisation","office.png"],["/floor","floor.png"]]) {
  await p.goto("https://mandate-coral.vercel.app" + path, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: name });
}
await b.close(); console.log("shot");
