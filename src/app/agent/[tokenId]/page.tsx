import type { Metadata } from "next";
import SiteHeader from "@/components/shell/SiteHeader";
import AgentDetail from "@/components/agents/AgentDetail";
import AutopsyPanel from "@/components/agents/Autopsy";
import CareerPanel from "@/components/agents/CareerPanel";
import { findAgent } from "@/lib/data/agents";
import { readAutopsy } from "@/lib/autopsy";
import { readCareerForWallet } from "@/lib/career";
import { placeAgent, readMarketSets } from "@/lib/rung";

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

  // The live assay streams in the client. These three read the chain and the
  // registry, so they render on the server and never block the assay.
  const [sets, autopsy, career] = await Promise.all([
    readMarketSets(),
    readAutopsy(CHAIN, tokenId).catch(() => null),
    readCareerForWallet(indexed?.owner).catch(() => null),
  ]);
  const placement = indexed ? placeAgent({ ...indexed, rung: undefined }, sets) : null;

  return (
    <div className="app">
      <SiteHeader />
      <AgentDetail
        tokenId={tokenId}
        chainId={CHAIN}
        indexed={indexed}
        explorer={EXPLORER}
      />

      <div className="shell">
        {placement ? (
          <section className="placement" aria-label="Ladder placement">
            <span className="pl-rung">Rung {placement.rung}</span>
            <span className="pl-name">{placement.name}</span>
            <p className="pl-reason">{placement.reason}</p>
            {placement.unknown.length ? (
              <p className="pl-unknown">
                Not settled either way:{" "}
                {placement.unknown
                  .sort((a, b) => a - b)
                  .map((n) => `rung ${n}`)
                  .join(", ")}
                . Absence of evidence, recorded as such.
              </p>
            ) : null}
          </section>
        ) : null}

        {autopsy ? <AutopsyPanel autopsy={autopsy} /> : null}
        {career ? <CareerPanel career={career} explorer={EXPLORER} /> : null}
      </div>
      <footer className="foot shell">
        <span className="fig">MANDATE</span>
        <span className="label">
          claims from the ERC-8004 registry · findings from BNB Smart Chain RPC
        </span>
      </footer>
    </div>
  );
}
