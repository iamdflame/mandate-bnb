/**
 * Design fixtures: real production readings, replayed locally.
 *
 * The market's hire law needs the census and escrow quotes, which live only
 * in the production database, so a local dev server with no DATABASE_URL
 * shows an empty market and every page is designed against nothing. Setting
 * MANDATE_FIXTURES to a folder of JSON captured from the public API
 * (the same shapes /api/v1/market returns) lets the views below read those
 * instead. It is inert in a production build and on Vercel, whatever is set.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export function fixtureDir(): string | null {
  const dir = process.env.MANDATE_FIXTURES;
  if (!dir || process.env.VERCEL || process.env.NODE_ENV === "production") return null;
  return dir;
}

export function fixture<T>(file: string): T | null {
  const dir = fixtureDir();
  if (!dir) return null;
  try {
    return JSON.parse(readFileSync(join(dir, file), "utf8")) as T;
  } catch {
    return null;
  }
}
