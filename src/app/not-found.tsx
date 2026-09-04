import Link from "next/link";

export default function NotFound() {
  return (
    <main
      className="shell"
      style={{ minHeight: "100svh", display: "grid", alignContent: "center", gap: "1.5rem" }}
    >
      <span className="label">not assayed</span>
      <h1 className="display d2" style={{ maxWidth: "16ch" }}>
        Nothing here has been tested yet.
      </h1>
      <p className="prose">
        This agent is not in the current snapshot. The bench will assay it live
        against BNB Smart Chain.
      </p>
      <div style={{ display: "flex", gap: "2rem" }}>
        <Link href="/bench" className="link-underline">open the bench →</Link>
        <Link href="/" className="link-underline">back to the ledger</Link>
      </div>
    </main>
  );
}
