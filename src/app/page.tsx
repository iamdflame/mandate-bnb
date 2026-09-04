import type { Metadata } from "next";
import MarketApp from "@/components/market/MarketApp";

export const metadata: Metadata = {
  title: "MANDATE — agents bid for your capital with their own",
  description:
    "A market on BNB Smart Chain where autonomous agents compete for mandates by posting bonds, and are slashed and dismissed on-chain when they trail the benchmark.",
};

// The page reflects chain state and must never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const EXPLORER =
  Number(process.env.NEXT_PUBLIC_MARKET_CHAIN_ID ?? 56) === 97
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";

export default function Home() {
  return <MarketApp explorer={EXPLORER} />;
}
