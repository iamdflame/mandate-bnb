import Link from "next/link";
import Ledger from "@/components/Ledger";
import Ring from "@/components/Ring";
import { Certificate, Fineness, HallmarkBadge } from "@/components/Report";
import { getMostOverstated, getSnapshot } from "@/lib/data/repo";
import { CATEGORY_BLURB, type Category } from "@/lib/config";

export default function Home() {
  const snap = getSnapshot();
  const overstated = getMostOverstated(5);
  const exhibit = snap.exhibit ?? snap.agents[0] ?? null;

  return (
    <main>
      <Ledger
        registered={snap.funnel.registered}
        withFeedback={snap.funnel.withFeedback}
        withEndpoint={snap.funnel.withEndpoint}
        capturedAt={snap.capturedAt}
      />

      {/* ---------------------------------------------------------- thesis */}
      <section
        className="shell"
        style={{ paddingBlock: "clamp(5rem, 14vh, 11rem)", background: "var(--paper)" }}
      >
        <div className="grid12" style={{ rowGap: "3rem" }}>
          <div style={{ gridColumn: "2 / span 6" }}>
            <h2 className="display d2" style={{ maxWidth: "14ch" }}>
              A directory is worth what its worst entry is worth.
            </h2>
          </div>
          <div style={{ gridColumn: "9 / span 4", alignSelf: "end" }}>
            <p className="prose">
              An agent marketplace that lists everything lists mostly nothing. The
              registry will happily tell you an agent scores 12.09, has two
              endorsements and trades autonomously. The chain will tell you the
              same wallet has sent one transaction in its life and holds no BNB.
            </p>
            <p className="prose" style={{ marginTop: "1.2rem" }}>
              ASSAY publishes the second number. Every listing here has been
              tested against BNB Smart Chain, and every figure on the page links
              to the transaction that proves it.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- exhibit */}
      {exhibit ? (
        <section
          style={{
            background: "var(--paper-2)",
            borderTop: "1px solid var(--rule)",
            borderBottom: "1px solid var(--rule)",
          }}
        >
          <div className="shell" style={{ paddingBlock: "clamp(4rem, 10vh, 8rem)" }}>
            <div className="grid12" style={{ rowGap: "2rem", marginBottom: "3rem" }}>
              <div style={{ gridColumn: "span 5" }}>
                <div className="label">exhibit</div>
                <h2 className="display d3" style={{ marginTop: "0.4rem", maxWidth: "16ch" }}>
                  What the registry says, and what the chain says.
                </h2>
              </div>
              <div style={{ gridColumn: "8 / span 5", alignSelf: "end" }}>
                <p className="prose">
                  One agent, assayed in full. The claims are its own words, taken
                  from its on-chain registration. The findings are RPC calls
                  against BNB Smart Chain, made when this page was built.
                </p>
              </div>
            </div>
            <Certificate report={exhibit} />
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ ring */}
      <section className="shell" style={{ paddingBlock: "clamp(5rem, 12vh, 10rem)" }}>
        <div className="grid12" style={{ rowGap: "2rem", marginBottom: "2.5rem" }}>
          <div style={{ gridColumn: "span 6" }}>
            <div className="label">the reputation registry</div>
            <h2 className="display d2" style={{ marginTop: "0.4rem", maxWidth: "13ch" }}>
              Written by {snap.reputation.reviewers} wallets.
            </h2>
          </div>
          <div style={{ gridColumn: "8 / span 5", alignSelf: "end" }}>
            <p className="prose">
              ERC-8004 lets any address leave feedback on any agent for the cost
              of gas. We pulled {snap.reputation.recordsAnalysed.toLocaleString()} feedback
              records from BNB Smart Chain and traced them back to their authors.
              Independent reviewers produce a sparse graph. This is what is
              actually there.
            </p>
          </div>
        </div>
        <Ring
          nodes={snap.reputation.nodes}
          edges={snap.reputation.edges}
          recordsAnalysed={snap.reputation.recordsAnalysed}
          cleanRecords={snap.reputation.cleanRecords}
        />
      </section>

      {/* ------------------------------------------------------ categories */}
      <section
        style={{
          borderTop: "1px solid var(--rule)",
          background: "var(--paper)",
        }}
      >
        <div className="shell" style={{ paddingBlock: "clamp(4rem, 10vh, 8rem)" }}>
          <div className="grid12" style={{ marginBottom: "3rem" }}>
            <div style={{ gridColumn: "span 7" }}>
              <div className="label">the marketplace</div>
              <h2 className="display d2" style={{ marginTop: "0.4rem", maxWidth: "15ch" }}>
                Four functions. Each proved differently.
              </h2>
            </div>
          </div>

          <div className="scroll-x" style={{ marginInline: "calc(var(--gutter) * -1)" }}>
            <div
              style={{
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(min(78vw, 22rem), 1fr)",
                gap: "1px",
                background: "var(--rule)",
                paddingInline: "var(--gutter)",
              }}
            >
              {snap.categories.map((c) => (
                <CategoryCard key={c.id} {...c} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ overstated */}
      {overstated.length ? (
        <section
          className="shell"
          style={{
            paddingBlock: "clamp(4rem, 10vh, 8rem)",
            borderTop: "1px solid var(--rule)",
          }}
        >
          <div className="grid12" style={{ rowGap: "2rem", marginBottom: "2.5rem" }}>
            <div style={{ gridColumn: "span 6" }}>
              <div className="label">the gap</div>
              <h2 className="display d3" style={{ marginTop: "0.4rem", maxWidth: "18ch" }}>
                Where standing and evidence disagree most.
              </h2>
            </div>
            <div style={{ gridColumn: "8 / span 5", alignSelf: "end" }}>
              <p className="prose">
                Ranked by position, not by score: the registry's number and our
                fineness are different units, and setting 12.07 beside 105 as
                though they were comparable is exactly the sloppiness this
                exists to object to. A ranking no directory can produce, because
                producing it requires having checked.
              </p>
            </div>
          </div>

          <div className="scroll-x">
            <table
              style={{
                width: "100%",
                minWidth: 640,
                borderCollapse: "collapse",
                fontSize: 13.5,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                  <Th>agent</Th>
                  <Th align="right">registry rank</Th>
                  <Th align="right">assayed rank</Th>
                  <Th align="right">fineness</Th>
                  <Th align="right">mark</Th>
                </tr>
              </thead>
              <tbody>
                {overstated.map(({ report, registryRank, assayedRank, drop }) => (
                  <tr key={report.tokenId} style={{ borderBottom: "1px solid var(--ink-06)" }}>
                    <td style={{ padding: "0.85rem 0.75rem 0.85rem 0" }}>
                      <Link href={`/agent/${report.tokenId}`} className="link-underline">
                        {report.name ?? report.tokenId}
                      </Link>
                    </td>
                    <td
                      className="fig"
                      style={{ textAlign: "right", padding: "0.85rem 0.75rem", color: "var(--ink-45)" }}
                    >
                      {registryRank}
                    </td>
                    <td className="fig" style={{ textAlign: "right", padding: "0.85rem 0.75rem" }}>
                      {assayedRank}
                      {drop > 0 ? (
                        <span className="label" style={{ marginLeft: 6 }}>
                          ↓{drop}
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="fig"
                      style={{ textAlign: "right", padding: "0.85rem 0.75rem", color: "var(--ink-45)" }}
                    >
                      {report.fineness}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.85rem 0 0.85rem 0.75rem" }}>
                      <HallmarkBadge report={report} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ----------------------------------------------------------- bench */}
      <section
        style={{
          borderTop: "1px solid var(--rule)",
          background: "var(--paper-2)",
        }}
      >
        <div
          className="shell"
          style={{ paddingBlock: "clamp(5rem, 13vh, 10rem)" }}
        >
          <div className="grid12" style={{ rowGap: "2rem" }}>
            <div style={{ gridColumn: "span 7" }}>
              <div className="label">the bench</div>
              <h2 className="display d2" style={{ marginTop: "0.4rem", maxWidth: "13ch" }}>
                Assay anything on this chain.
              </h2>
              <p className="prose" style={{ marginTop: "1.5rem" }}>
                Paste any agent ID registered on BNB Smart Chain and watch the six
                tests run against it live. It does not have to be one of ours.
              </p>
              <Link
                href="/bench"
                className="link-underline"
                style={{
                  display: "inline-block",
                  marginTop: "2rem",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  letterSpacing: "0.06em",
                  borderColor: "var(--ink)",
                  paddingBottom: 2,
                }}
              >
                open the bench →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer
        className="shell"
        style={{
          paddingBlock: "3rem",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.5rem 3rem",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span className="fig" style={{ fontSize: 12, letterSpacing: "0.3em" }}>
          ASSAY
        </span>
        <span className="label" style={{ maxWidth: "52ch", lineHeight: 1.6 }}>
          Measured against BNB Smart Chain on{" "}
          {new Date(snap.capturedAt).toISOString().slice(0, 10)}. Registry data
          from 8004scan; chain data from public BSC RPC. Every figure is
          reproducible — the method is open and the evidence links out.
        </span>
      </footer>
    </main>
  );
}

function CategoryCard({
  id,
  label,
  agents,
  hallmarked,
}: {
  id: Category;
  label: string;
  agents: number;
  hallmarked: number;
}) {
  return (
    <Link
      href={`/category/${id}`}
      style={{
        background: "var(--paper)",
        padding: "clamp(1.5rem, 3vw, 2.5rem)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "clamp(15rem, 30vh, 20rem)",
        gap: "2rem",
      }}
    >
      <div>
        <h3 className="display" style={{ fontSize: "clamp(1.5rem, 2.4vw, 2.1rem)", maxWidth: "12ch" }}>
          {label}
        </h3>
        <p style={{ marginTop: "0.9rem", color: "var(--ink-45)", fontSize: 13.5, lineHeight: 1.5 }}>
          {CATEGORY_BLURB[id]}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem" }}>
        <div>
          <div className="fig" style={{ fontSize: "1.5rem", letterSpacing: "-0.03em" }}>
            {agents}
          </div>
          <div className="label">assayed</div>
        </div>
        <div>
          <div
            className="fig"
            style={{
              fontSize: "1.5rem",
              letterSpacing: "-0.03em",
              color: hallmarked ? "var(--gold-deep)" : "var(--ink-25)",
            }}
          >
            {hallmarked}
          </div>
          <div className="label">hallmarked</div>
        </div>
      </div>
    </Link>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="label"
      style={{
        textAlign: align,
        fontWeight: 400,
        padding: align === "right" ? "0 0.75rem 0.7rem" : "0 0.75rem 0.7rem 0",
      }}
    >
      {children}
    </th>
  );
}
