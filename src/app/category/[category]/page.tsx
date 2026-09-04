import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HallmarkBadge } from "@/components/Report";
import { getByCategory, getSnapshot } from "@/lib/data/repo";
import {
  CATEGORIES,
  CATEGORY_BLURB,
  CATEGORY_EVIDENCE,
  CATEGORY_LABEL,
  PROTOCOL_LABEL,
  type Category,
} from "@/lib/config";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return { title: "Not found — ASSAY" };
  return {
    title: `${CATEGORY_LABEL[category]} — ASSAY`,
    description: CATEGORY_BLURB[category],
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!isCategory(category)) notFound();

  const agents = getByCategory(category);
  const snap = getSnapshot();
  const hallmarked = agents.filter((a) => a.fineness >= 375).length;
  const evidence = CATEGORY_EVIDENCE[category];

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
        <Link href="/bench" className="label link-underline">
          the bench
        </Link>
      </header>

      <section className="shell" style={{ paddingBlock: "clamp(3rem, 8vh, 6rem)" }}>
        <div className="grid12" style={{ rowGap: "2rem" }}>
          <div style={{ gridColumn: "span 7" }}>
            <div className="label">category</div>
            <h1 className="display d2" style={{ marginTop: "0.3rem", maxWidth: "12ch" }}>
              {CATEGORY_LABEL[category]}
            </h1>
            <p className="lede" style={{ marginTop: "1.25rem" }}>
              {CATEGORY_BLURB[category]}
            </p>
          </div>
          <div style={{ gridColumn: "9 / span 4", alignSelf: "end" }}>
            <div className="label">how this category is proved</div>
            <p className="prose" style={{ marginTop: "0.6rem", fontSize: 13.5 }}>
              An agent claiming this function must have interacted with the
              contracts that perform it. We check its wallet against:
            </p>
            <ul
              style={{
                listStyle: "none",
                margin: "0.9rem 0 0",
                padding: 0,
                display: "grid",
                gap: "0.35rem",
              }}
            >
              {evidence.map((addr) => (
                <li key={addr} className="fig" style={{ fontSize: 12, color: "var(--ink-70)" }}>
                  {PROTOCOL_LABEL[addr] ?? addr}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "3rem",
            marginTop: "clamp(2.5rem, 6vh, 4rem)",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--ink)",
            flexWrap: "wrap",
          }}
        >
          <Figure value={String(agents.length)} label="assayed in this category" />
          <Figure
            value={String(hallmarked)}
            label="carrying a hallmark"
            accent={hallmarked > 0}
          />
          <Figure
            value={String(snap.funnel.registered.toLocaleString())}
            label="registered on this chain in total"
          />
        </div>

        {agents.length === 0 ? (
          <p className="prose" style={{ marginTop: "3rem" }}>
            Nothing in the current snapshot classifies into this category. The
            registry ships no category data at all — every agent here is
            classified from its own description — so an empty category means no
            agent has described itself this way, not that the check failed.
          </p>
        ) : (
          <div className="scroll-x" style={{ marginTop: "clamp(2rem, 5vh, 3rem)" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                  <th className="label" style={{ textAlign: "left", fontWeight: 400, padding: "0 0.75rem 0.7rem 0" }}>
                    agent
                  </th>
                  <th className="label" style={{ textAlign: "right", fontWeight: 400, padding: "0 0.75rem 0.7rem" }}>
                    registry
                  </th>
                  <th className="label" style={{ textAlign: "right", fontWeight: 400, padding: "0 0.75rem 0.7rem" }}>
                    fineness
                  </th>
                  <th className="label" style={{ textAlign: "right", fontWeight: 400, padding: "0 0 0.7rem 0.75rem" }}>
                    mark
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.tokenId} style={{ borderBottom: "1px solid var(--ink-06)" }}>
                    <td style={{ padding: "0.9rem 0.75rem 0.9rem 0" }}>
                      <Link href={`/agent/${a.tokenId}`} className="link-underline">
                        {(a.name ?? a.tokenId).slice(0, 60)}
                      </Link>
                    </td>
                    <td
                      className="fig"
                      style={{ textAlign: "right", padding: "0.9rem 0.75rem", color: "var(--ink-45)" }}
                    >
                      {a.registryScore ?? "—"}
                    </td>
                    <td
                      className="fig"
                      style={{
                        textAlign: "right",
                        padding: "0.9rem 0.75rem",
                        color: a.fineness >= 375 ? "var(--gold-deep)" : "var(--ink)",
                      }}
                    >
                      {a.fineness}
                    </td>
                    <td style={{ textAlign: "right", padding: "0.9rem 0 0.9rem 0.75rem" }}>
                      <HallmarkBadge report={a} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav
          style={{
            marginTop: "clamp(3rem, 8vh, 5rem)",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--rule)",
            display: "flex",
            gap: "1.5rem 2.5rem",
            flexWrap: "wrap",
          }}
        >
          {CATEGORIES.filter((c) => c !== category).map((c) => (
            <Link key={c} href={`/category/${c}`} className="link-underline" style={{ fontSize: 13.5 }}>
              {CATEGORY_LABEL[c]} →
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}

function Figure({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="fig"
        style={{
          fontSize: "clamp(1.5rem, 3vw, 2.4rem)",
          letterSpacing: "-0.03em",
          color: accent ? "var(--gold-deep)" : "var(--ink)",
        }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

const isCategory = (v: string): v is Category =>
  (CATEGORIES as readonly string[]).includes(v);
