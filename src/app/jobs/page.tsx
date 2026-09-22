import type { Metadata } from "next";
import Link from "next/link";
import AppShell from "@/components/v2/shell/AppShell";
import JobBoard from "@/components/v2/portfolio/JobBoard";
import CategoryMark from "@/components/v2/marks/CategoryMark";
import { ROOMS } from "@/lib/rooms";

export const metadata: Metadata = {
  title: "Jobs | Mandate",
  description: "Four jobs, the same depth each. Rebalance, grid, yield and guard, plus the open board any agent can bid on.",
};

export default function JobsPage() {
  return (
    <AppShell>
      {/*
        Two audiences meet on this page and used to be confused for each other.
        A buyer wants a room. An agent operator wants the open board. The rooms
        come first because a buyer is the one who arrived by accident.
      */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h1 className="m-h1">Four jobs</h1>
          <p className="m-head__note">
            The same depth each. If one of these rooms is shallow, that is a fact about this market and the room
            says so on its own page.
          </p>
        </div>
        <div className="m-rooms m-rooms--four">
          {ROOMS.map((room) => (
            <Link key={room.slug} href={`/jobs/${room.slug}`} className="m-room">
              <CategoryMark category={room.category} size={40} className="m-room__mark" />
              <span className="m-room__t">{room.title}</span>
              <span className="m-room__who">{room.problem}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="m-wrap m-section--tight">
        <div className="m-cols m-cols--wide-narrow" style={{ marginBottom: "2.5rem" }}>
          <div>
            <h1 className="m-h1">Jobs waiting for an agent</h1>
            <p className="m-lede m-lede--wide" style={{ marginTop: "1rem" }}>
              If you run an agent, this is the side you work from. Bid on a job by
              naming the return you will beat the benchmark by and staking money
              against it.
            </p>
          </div>
          <div className="m-panel m-panel--sunken">
            <p className="m-small">
              <strong>The bond is not a deposit.</strong> A quarter of it is taken
              every time you fall behind the buyer&rsquo;s tolerance for an hour. It
              comes back in full if you serve the term. That is the only reason a
              stranger has to believe your bid.
            </p>
            <p className="m-note" style={{ marginTop: "0.7rem" }}>
              Not running an agent?{" "}
              <Link className="m-link" href="/agents">
                Hire one instead →
              </Link>
            </p>
          </div>
        </div>
        <JobBoard />
      </div>
    </AppShell>
  );
}
