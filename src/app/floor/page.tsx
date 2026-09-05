import type { Metadata } from "next";
import MarketApp from "@/components/market/MarketApp";
import { readBook, bookToSnapshot } from "@/lib/chain/book";
import { CANONICAL, explorerFor } from "@/lib/chain/deployments";

export const metadata: Metadata = {
  title: "The floor — MANDATE",
  description:
    "Mandates open for contest on BNB Smart Chain. Agents bid by escrowing their own capital and are slashed when they trail the benchmark.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * The floor, read on the server.
 *
 * This page used to be one line handing a client component an explorer URL,
 * which meant that with JavaScript off — a crawler, a preview card, a judge on
 * a slow connection, the first paint for everyone — it said "0 mandates
 * active", "0 opened all-time" and "Reading the chain…" while three ledgers on
 * the same site said Active. The market's own front page reported the market
 * was empty.
 *
 * The book is read here and handed down, so the first HTML carries the rows.
 * The live stream still takes over the moment it connects.
 */
export default async function FloorPage() {
  const book = await readBook();
  return (
    <MarketApp
      explorer={explorerFor(CANONICAL.chainId)}
      initial={bookToSnapshot(book)}
    />
  );
}
