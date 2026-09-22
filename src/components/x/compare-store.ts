/**
 * The agents a person has picked to compare, kept in this browser.
 *
 * Nothing about a comparison needs a server: it is three ids the reader chose.
 * It lives in localStorage so it survives moving between pages, and every
 * change is broadcast so the tile toggles and the tray agree without a
 * context provider wrapped around the whole app.
 */

export interface Picked {
  tokenId: string;
  name: string;
}

export const MAX_COMPARE = 3;
const KEY = "mandate:compare";
const EVENT = "mandate:compare";

export function readPicked(): Picked[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Picked[];
    return Array.isArray(raw) ? raw.filter((p) => p && typeof p.tokenId === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function writePicked(next: Picked[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX_COMPARE)));
  } catch {
    /* private mode: the tray simply forgets on reload */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onPicked(fn: () => void): () => void {
  const handler = () => fn();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
