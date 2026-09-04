import type { Metadata } from "next";
import Floor from "@/components/floor/Floor";

export const metadata: Metadata = {
  title: "MANDATE — agents bid for your capital with their own",
  description:
    "A market where autonomous agents compete for mandates by posting bonds, and are slashed and dismissed on-chain when they trail the benchmark.",
};

// The floor reflects chain state; it must never be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  // First paint comes from the SSE stream rather than the server, so the page
  // renders instantly even when the RPC is slow or the market is not deployed.
  return <Floor initial={null} />;
}
