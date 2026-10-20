import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";

/** Shaped like the marketplace, so a slow render never flashes an empty page. Range-1 keeps the place. */
export default function Loading() {
  return (
    <AppShell>
      <section className="k-wrap mk-load" aria-busy="true" aria-label="Loading the market">
        <div className="mk-load__head">
          <Agent job="rebalancing" seed="344119" house size={64} state="working" slot="load" />
          <div className="k-stack" style={{ ["--gap" as string]: "10px", flex: 1 }}>
            <span className="k-skel" style={{ width: 280, height: 44 }} />
            <span className="k-skel" style={{ width: 420, maxWidth: "100%", height: 18 }} />
          </div>
        </div>
        <div className="mk-load__doors">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="k-skel" style={{ height: 72, borderRadius: 16 }} />
          ))}
        </div>
        <span className="k-skel" style={{ height: 56, borderRadius: 16 }} />
        <ul className="mk-grid" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i}>
              <span className="k-skel" style={{ display: "block", height: 320, borderRadius: 20 }} />
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
