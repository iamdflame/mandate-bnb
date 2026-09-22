import AppShell from "@/components/v2/shell/AppShell";
import { GridSkeleton, Skel } from "@/components/x/Skeleton";

/** Shaped like the marketplace, so a slow render never flashes an empty page. */
export default function Loading() {
  return (
    <AppShell>
      <section className="x-wrap x-mkt-head" aria-busy="true">
        <Skel w={180} h={36} />
        <div style={{ height: 12 }} />
        <Skel w={320} h={16} />
        <div style={{ height: 20 }} />
        <Skel h={58} r={10} />
      </section>
      <div className="x-wrap x-mkt">
        <aside className="x-rail" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Skel h={20} />
            </div>
          ))}
        </aside>
        <div className="x-mkt__main">
          <GridSkeleton n={6} />
        </div>
      </div>
    </AppShell>
  );
}
