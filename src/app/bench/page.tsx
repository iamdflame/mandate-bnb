import type { Metadata } from "next";
import Link from "next/link";
import Bench from "@/components/Bench";
import { getSnapshot } from "@/lib/data/repo";

export const metadata: Metadata = {
  title: "The bench — ASSAY",
  description:
    "Paste any agent registered on BNB Smart Chain and watch six tests run against it live.",
};

export default function BenchPage() {
  const snap = getSnapshot();
  // Seed the suggestions with agents whose standing most overstates the evidence.
  const suggestions = snap.agents
    .filter((a) => (a.registryScore ?? 0) > 0)
    .slice(0, 4)
    .map((a) => ({ tokenId: a.tokenId, name: a.name ?? a.tokenId, fineness: a.fineness }));

  return (
    <main>
      <header
        className="shell"
        style={{
          paddingTop: "1.5rem",
          paddingBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          borderBottom: "1px solid var(--rule)",
          gap: "1rem",
        }}
      >
        <Link href="/" className="fig" style={{ fontSize: 13, letterSpacing: "0.3em" }}>
          ASSAY
        </Link>
        <span className="label">the bench</span>
      </header>

      <section className="shell" style={{ paddingBlock: "clamp(3rem, 8vh, 6rem)" }}>
        <div className="grid12" style={{ rowGap: "2rem", marginBottom: "3rem" }}>
          <div style={{ gridColumn: "span 7" }}>
            <h1 className="display d2" style={{ maxWidth: "13ch" }}>
              Assay anything on this chain.
            </h1>
          </div>
          <div style={{ gridColumn: "9 / span 4", alignSelf: "end" }}>
            <p className="prose">
              Six tests, run live against BNB Smart Chain. It does not have to be
              one of ours — any agent in the ERC-8004 identity registry can be
              put on the bench, including one you are being asked to trust
              somewhere else.
            </p>
          </div>
        </div>

        <Bench chainId={snap.chainId} suggestions={suggestions} />
      </section>
    </main>
  );
}
