import AppShell from "@/components/v2/shell/AppShell";

/** Shaped like an agent's page: its stage, its name and price, the hire panel. */
export default function Loading() {
  return (
    <AppShell>
      <section className="k-wrap mk-load" aria-busy="true" aria-label="Loading the agent">
        <div className="mk-load__agent">
          <span className="k-skel" style={{ aspectRatio: "1", width: "100%", maxWidth: 420, borderRadius: 32 }} />
          <div className="k-stack" style={{ ["--gap" as string]: "14px" }}>
            <span className="k-skel" style={{ width: 160, height: 22 }} />
            <span className="k-skel" style={{ width: "80%", height: 56 }} />
            <span className="k-skel" style={{ width: "100%", height: 18 }} />
            <span className="k-skel" style={{ width: "70%", height: 18 }} />
            <span className="k-skel" style={{ width: 200, height: 48, marginTop: 12 }} />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
