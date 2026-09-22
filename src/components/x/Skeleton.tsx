/** Placeholders shaped like what is coming, so nothing flashes empty. */
export function Skel({ w = "100%", h = 14, r }: { w?: string | number; h?: number; r?: number }) {
  return <span className="x-skel" style={{ display: "block", width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

export function AgentSkeleton() {
  return (
    <div className="x-agent" aria-hidden="true">
      <div className="x-agent__art">
        <Skel h={112} r={0} />
      </div>
      <div className="x-agent__body">
        <Skel w="60%" h={18} />
        <Skel h={12} />
        <Skel w="80%" h={12} />
        <div className="x-agent__metrics">
          <Skel h={28} />
          <Skel h={28} />
          <Skel h={28} />
        </div>
        <Skel h={40} />
      </div>
    </div>
  );
}

export function GridSkeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="x-grid x-grid--4" role="status" aria-label="Loading agents">
      {Array.from({ length: n }, (_, i) => (
        <AgentSkeleton key={i} />
      ))}
    </div>
  );
}
