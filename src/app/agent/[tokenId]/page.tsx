import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Certificate } from "@/components/Report";
import { getAgentReport, getSnapshot } from "@/lib/data/repo";
import { CATEGORY_LABEL, addressUrl, type Category } from "@/lib/config";

export function generateStaticParams() {
  return getSnapshot().agents.map((a) => ({ tokenId: a.tokenId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const { tokenId } = await params;
  const report = getAgentReport(tokenId);
  if (!report) return { title: "Not assayed — ASSAY" };
  return {
    title: `${report.name ?? tokenId} — ${report.fineness} fine — ASSAY`,
    description: `Assayed against BNB Smart Chain: ${report.fineness}/1000 fineness against a registry score of ${report.registryScore ?? "none"}.`,
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId } = await params;
  const report = getAgentReport(tokenId);
  if (!report) notFound();

  const snap = getSnapshot();
  const peers = snap.agents
    .filter((a) => a.category === report.category && a.tokenId !== report.tokenId)
    .slice(0, 4);

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
          flexWrap: "wrap",
        }}
      >
        <Link href="/" className="fig" style={{ fontSize: 13, letterSpacing: "0.3em" }}>
          ASSAY
        </Link>
        <nav style={{ display: "flex", gap: "1.5rem" }}>
          {report.category ? (
            <Link href={`/category/${report.category}`} className="label link-underline">
              {CATEGORY_LABEL[report.category as Category]}
            </Link>
          ) : null}
          <Link href="/bench" className="label link-underline">
            the bench
          </Link>
        </nav>
      </header>

      <div className="shell" style={{ paddingBlock: "clamp(3rem, 8vh, 6rem)" }}>
        <Certificate report={report} />

        <section
          style={{
            marginTop: "clamp(3rem, 7vh, 5rem)",
            borderTop: "1px solid var(--ink)",
            paddingTop: "1.75rem",
          }}
        >
          <div className="grid12" style={{ rowGap: "1.5rem" }}>
            <div style={{ gridColumn: "span 4" }}>
              <div className="label">on chain</div>
              <ul style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "grid", gap: "0.5rem" }}>
                {report.agentWallet ? (
                  <li>
                    <a
                      href={addressUrl(report.agentWallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fig link-underline"
                      style={{ fontSize: 12, wordBreak: "break-all" }}
                    >
                      agent wallet ↗
                    </a>
                  </li>
                ) : null}
                {report.ownerAddress ? (
                  <li>
                    <a
                      href={addressUrl(report.ownerAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fig link-underline"
                      style={{ fontSize: 12, wordBreak: "break-all" }}
                    >
                      owner ↗
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
            <div style={{ gridColumn: "span 4" }}>
              <div className="label">classification</div>
              <p style={{ margin: "0.75rem 0 0", fontSize: 13.5, color: "var(--ink-70)" }}>
                {report.category
                  ? `Classified as ${CATEGORY_LABEL[report.category as Category]} from its own description, at ${(report.categoryConfidence * 100).toFixed(0)}% confidence.`
                  : "Its description matches none of the four market functions."}
              </p>
            </div>
            <div style={{ gridColumn: "span 4" }}>
              <div className="label">method</div>
              <p style={{ margin: "0.75rem 0 0", fontSize: 13.5, color: "var(--ink-70)" }}>
                Claims are read from the ERC-8004 registry. Findings are RPC calls
                against BNB Smart Chain, made at{" "}
                {new Date(report.assayedAt).toISOString().replace("T", " ").slice(0, 16)} UTC.
              </p>
            </div>
          </div>
        </section>

        {peers.length ? (
          <section style={{ marginTop: "clamp(3rem, 7vh, 5rem)" }}>
            <div className="label">others in this category</div>
            <div
              style={{
                marginTop: "1rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
                gap: "1px",
                background: "var(--rule)",
                border: "1px solid var(--rule)",
              }}
            >
              {peers.map((p) => (
                <Link
                  key={p.tokenId}
                  href={`/agent/${p.tokenId}`}
                  style={{
                    background: "var(--paper)",
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "1.5rem",
                    minHeight: "8rem",
                  }}
                >
                  <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                    {(p.name ?? p.tokenId).slice(0, 52)}
                  </span>
                  <span
                    className="fig"
                    style={{
                      fontSize: "1.2rem",
                      color: p.fineness >= 375 ? "var(--gold-deep)" : "var(--ink-45)",
                    }}
                  >
                    {p.fineness}
                    <span className="label" style={{ marginLeft: 6 }}>
                      fine
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
