#!/usr/bin/env node
/**
 * The design system, enforced rather than asserted.
 *
 *   node src/scripts/check-doctrine.mjs
 *
 * The previous version of this file enforced the paper-and-gold system that
 * docs/frontendprompt.md replaced: it required the accent to be unlike
 * #F0B90B and banned the word "card" from class names. Those rules now
 * contradict the brief, so this checks the rules the new system depends on.
 * A document that claims them is worth nothing next to a build that fails
 * when one stops being true.
 *
 * Exits non-zero on any violation, naming the file, the line and the rule.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const fail = [];
const pass = [];
const note = (ok, rule, detail) => (ok ? pass : fail).push(`${rule}${detail ? ": " + detail : ""}`);

const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(name)) out.push(p);
  }
  return out;
};
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

/* ------------------------------------------------------------- tokens */

const tokens = read("src/app/tokens.css");
for (const t of ["--c-bg", "--c-surface", "--c-accent", "--c-text", "--f-sans", "--f-mono", "--r-md", "--d-card", "--w-max"]) {
  note(tokens.includes(`${t}:`), `tokens.css declares ${t}`);
}
note(/--c-bg:\s*#0b0d0e/i.test(tokens), "background is ink #0B0D0E, per the Seal brand (tools/brand)");
note(/--c-accent:\s*#13b98a/i.test(tokens), "accent is the Seal's signature green #13B98A, not BNB yellow");

/*
  Raw colours belong in tokens.css and nowhere else in the new system. A hex
  literal in a component is how a second green, slightly off, gets in.
*/
const system = ["src/app/market.css", "src/app/theme.css", ...walk("src/components/x")];
for (const f of system) {
  const body = stripComments(read(f));
  body.split("\n").forEach((line, i) => {
    const hex = line.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g);
    if (hex && !/url\(#|href=|id=|`#|"#main"|#\{/.test(line)) {
      fail.push(`raw colour outside tokens.css: ${f}:${i + 1} ${hex.join(" ")}`);
    }
  });
}
if (!fail.some((x) => x.startsWith("raw colour"))) pass.push("no raw colours outside tokens.css in the marketplace system");

/* --------------------------------------------------------- tap targets */

const market = read("src/app/market.css");
note(/\.x-btn\s*\{[^}]*min-height:\s*44px/.test(market), ".x-btn has a 44px tap floor");

/* ------------------------------------------------------------- motion */

note(/prefers-reduced-motion/.test(tokens), "tokens.css zeroes durations under reduced motion");
note(/prefers-reduced-motion/.test(market), "market.css stops animation under reduced motion");

/* ------------------------------------------------------------ copy */

/*
  The user's standing rule: no em dashes in anything a person reads. Comments
  may use them; rendered strings and JSX text may not.
*/
const surfaces = [...walk("src/components/x"), ...walk("src/app").filter((f) => f.endsWith(".tsx"))];
for (const f of surfaces) {
  const body = stripComments(read(f));
  body.split("\n").forEach((line, i) => {
    if (line.includes("—")) fail.push(`em dash in rendered copy: ${f}:${i + 1}`);
  });
}
if (!fail.some((x) => x.startsWith("em dash"))) pass.push("no em dashes in rendered copy");

/* -------------------------------------------------------- hallmarks */

// A mark is only struck on an agent that earned it; below 375 nothing shows.
const hallmark = read("src/components/mark/Hallmark.tsx");
note(!hallmark || /375/.test(hallmark), "Hallmark never strikes below 375");

/* ------------------------------------------------------------ report */

for (const p of pass) console.log(`  ok   ${p}`);
for (const f of fail) console.log(`  FAIL ${f}`);
console.log(fail.length ? `\n${fail.length} violation(s)` : `\nall ${pass.length} rules hold`);
process.exit(fail.length ? 1 : 0);
