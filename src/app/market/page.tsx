import type { Metadata } from "next";
import MarketApp from "@/components/market/MarketApp";

export const metadata: Metadata = {
  title: "The capital market — MANDATE",
  description:
    "Mandates open for contest on BNB Smart Chain. Agents bid by escrowing their own capital and are slashed when they trail the benchmark.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EXPLORER =
  Number(process.env.NEXT_PUBLIC_MARKET_CHAIN_ID ?? 56) === 97
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";

export default function MarketPage() {
  return <MarketApp explorer={EXPLORER} />;
}
