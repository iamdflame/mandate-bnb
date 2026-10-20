import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import TrustHead from "@/components/trust/TrustHead";
import BenchStage from "@/components/trust/BenchStage";
import { readAgentIndex } from "@/lib/data/agents";
import { CHAIN_ID } from "@/lib/config";

export const metadata: Metadata = {
  title: "Run a check yourself | Mandate",
  description:
    "Paste any agent registered on BNB Smart Chain and watch six tests run against it live. No wallet, no account, no permission from us.",
};

export const dynamic = "force-dynamic";

export default async function BenchPage() {
  const index = await readAgentIndex();

  /*
    Seeded with agents whose registry standing most overstates the evidence.

    Not a showcase, the suggestions are chosen precisely because their
    published score is the thing the bench is about to contradict, and a
    visitor who clicks one sees the argument happen rather than reading it.
  */
  const suggestions = index.agents
    .filter((a) => (a.registryScore ?? 0) > 0)
    .sort((a, b) => (b.registryScore ?? 0) - (a.registryScore ?? 0))
    .slice(0, 4)
    .map((a) => ({ tokenId: a.tokenId, name: a.name ?? a.tokenId, fineness: 0 }));

  return (
    <AppShell>
      <div className="tr">
        <TrustHead
          title="Put any agent on the bench."
          lede="Six checks, run live against BNB Smart Chain while you watch. It does not have to be one of ours. No wallet, no account, and no permission from us."
          art={
            <div className="tr-benchart" aria-hidden="true">
              <div className="tr-benchart__lamps">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} style={{ ["--a" as string]: `${-62 + i * 24.8}deg` }} />
                ))}
              </div>
              <Agent job="grid-trading" seed="bench-keeper" size={150} state="awake" slot="bart" />
              <div className="tr-benchart__plinth" />
            </div>
          }
        />
        <section className="tr-sec tr-sec--first" aria-label="The bench">
          <div className="k-wrap">
            <BenchStage chainId={CHAIN_ID} suggestions={suggestions} />
            <p className="k-small tr-sec__more">
              What each check asks and what it is worth is on{" "}
              <Link className="k-link" href="/assay">
                the method
              </Link>
              . A check that cannot find evidence says so; it is never counted as a pass.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
