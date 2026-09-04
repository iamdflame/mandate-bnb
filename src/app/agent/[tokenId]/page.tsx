import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import AgentDetail from "@/components/agents/AgentDetail";
import { findAgent } from "@/lib/data/agents";

/**
 * Any agent in the ERC-8004 registry has a page here, not only the ones in a
 * snapshot: the assay runs live on open. Rendered on demand for that reason.
 */
export const dynamic = "force-dynamic";

const CHAIN = Number(process.env.CHAIN_ID ?? 56);
const EXPLORER = CHAIN === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const { tokenId } = await params;
  const a = findAgent(tokenId);
  return {
    title: `${a?.name ?? `Agent ${tokenId}`} — assayed — MANDATE`,
    description:
      a?.description?.slice(0, 180) ??
      `Agent ${tokenId} on BNB Smart Chain, tested against the chain.`,
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const indexed = findAgent(tokenId);

  return (
    <div className="app">
      <SiteHeader />
      <AgentDetail
        tokenId={tokenId}
        chainId={CHAIN}
        indexed={indexed}
        explorer={EXPLORER}
      />
      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          claims from the ERC-8004 registry · findings from BNB Smart Chain RPC
        </span>
      </footer>
    </div>
  );
}
