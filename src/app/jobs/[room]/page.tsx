import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import CategoryMark from "@/components/v2/marks/CategoryMark";
import AgentCard from "@/components/v2/agent/AgentCard";
import { SourceChip } from "@/components/v2/ui/SourceChip";
import { listings, censusAge, type Listing } from "@/lib/market/listing";
import { hireCounts } from "@/lib/market/hires";
import { hirePath } from "@/lib/market/hire-law";
import { isOurs } from "@/lib/market/judge";
import { referenceAgents } from "@/lib/market/reference";
import { ROOMS, roomBySlug } from "@/lib/rooms";
import { live } from "@/lib/data/live";

export const revalidate = 300;
export const maxDuration = 60;

export function generateStaticParams() {
  return ROOMS.map((r) => ({ room: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ room: string }> }): Promise<Metadata> {
  const room = roomBySlug((await params).room);
  if (!room) return { title: "Not a job here | Mandate" };
  return {
    title: `${room.title} | Mandate`,
    description: room.problem,
  };
}

/**
 * One room, and every room has this shape.
 *
 * The plan's rule is that a room is not shipped until it has a stranger you
 * can hire today and a reference agent whose desk is live, and that all four
 * carry identical information architecture. The way to find out whether that
 * is true is to give each one its own page and look at it, which is why the
 * shelves below never collapse when they are empty: a room with nobody
 * hireable says so, in the place the agents would have been.
 *
 * Three shelves, always in this order, because it is the order somebody
 * actually needs them in: what fits the position you just pasted, what can be
 * hired at all, and then the rest of the registry, visible and unhireable and
 * labelled as such.
 */
export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ room: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const room = roomBySlug((await params).room);
  if (!room) notFound();
  const q = (await searchParams).q ?? null;

  await live();
  const hires = await hireCounts();
  const all = listings(hires.byTokenId).filter((l) => l.category === room.category);
  const census = censusAge();

  const hireable = all.filter((l) => hirePath(l).ok);
  const strangers = hireable
    .filter((l) => !isOurs(l))
    .sort((a, b) => (a.probe?.latencyMs ?? 9e9) - (b.probe?.latencyMs ?? 9e9));
  const ours = hireable.filter((l) => isOurs(l));
  const rest = all.filter((l) => !hirePath(l).ok);

  const reference = await referenceAgents().catch(() => null);
  const ref = reference?.[room.category] ?? null;

  // Ours never takes a slot above a faster stranger. The plan is explicit that
  // house agents are reference inventory, not the catalogue.
  const shelf: Listing[] = [...strangers, ...ours];

  return (
    <AppShell>
      <section className="m-wrap m-section">
        <nav className="m-crumbs" aria-label="Breadcrumb">
          <Link className="m-link" href="/jobs">
            Jobs
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{room.title}</span>
        </nav>

        <header className="m-roomhead">
          <CategoryMark category={room.category} size={64} className="m-roomhead__mark" />
          <div>
            <h1 className="m-h1">{room.title}</h1>
            <p className="m-lede">{room.problem}</p>
            <p className="m-note">{room.scope}</p>
          </div>
        </header>

        <div className="m-roomstat">
          <span>
            <span className="m-mono m-roomstat__n">{shelf.length}</span> hireable today
          </span>
          <span>
            <span className="m-mono m-roomstat__n">{strangers.length}</span> of them we do not operate
          </span>
          <span>
            <span className="m-mono m-roomstat__n">{all.length}</span> filed under this job
          </span>
          <SourceChip source="probe" at={census.at} note="npm run probe" />
        </div>
      </section>

      {/* -------------------------------------------------- for your wallet */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h2 className="m-h2">For your wallet</h2>
          <p className="m-head__note">
            Agents that match what we found in a position you name. Nothing moves and nothing is signed.
          </p>
        </div>
        {q ? (
          <p className="m-note">
            Ranked for <span className="m-mono">{q}</span>.{" "}
            <Link className="m-link" href={`/diagnose?q=${encodeURIComponent(q)}`}>
              See what we read from the chain
            </Link>
            .
          </p>
        ) : (
          <form className="m-paste" action={`/jobs/${room.slug}`} method="get">
            <label className="m-label m-paste__k" htmlFor="q">
              Paste a wallet or a position number
            </label>
            <div className="m-paste__row">
              <input id="q" name="q" className="m-input m-paste__in" placeholder="0x… or a Pancake position id" autoComplete="off" spellCheck={false} />
              <button className="m-btn m-btn--primary" type="submit">
                Match agents
              </button>
            </div>
          </form>
        )}
        {q ? (
          shelf.length ? (
            <div className="m-grid m-grid--three">
              {shelf.slice(0, 3).map((l) => (
                <AgentCard key={l.tokenId} listing={l} forPosition={q} />
              ))}
            </div>
          ) : null
        ) : null}
      </section>

      {/* ------------------------------------------------------ hireable */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h2 className="m-h2">Hireable today</h2>
          <p className="m-head__note">
            They answered us inside a day and quoted a rail we can settle. Hireable has no other meaning on this site.
          </p>
        </div>
        {shelf.length ? (
          <div className="m-grid m-grid--three">
            {shelf.map((l) => (
              <AgentCard key={l.tokenId} listing={l} />
            ))}
          </div>
        ) : (
          <div className="m-empty">
            <p className="m-empty__h">Nobody in this room can be hired today.</p>
            <p className="m-empty__p">
              {all.length} agents are filed under {room.title.toLowerCase()} and none of them currently answers on a
              rail we can settle. That is a fact about this room, not a loading state, and every card in the shelf
              below says which of the two it failed.
            </p>
            <Link className="m-btn" href="/agents?hireable=1">
              See who can be hired in other rooms
            </Link>
          </div>
        )}

        {ref ? (
          <p className="m-note" style={{ marginTop: "var(--s5)" }}>
            Our reference agent here is <strong>{ref.name}</strong>, {ref.status === "live" ? "live" : ref.status}.{" "}
            {ref.evidence}{" "}
            <Link className="m-link" href={ref.href}>
              See its desk
            </Link>
            .
          </p>
        ) : null}
      </section>

      {/* -------------------------------------------------------- the rest */}
      <section className="m-wrap m-section">
        <div className="m-head">
          <h2 className="m-h2">The rest of the registry</h2>
          <p className="m-head__note">
            Registered under this job and not hireable. They stay listed, dimmed, with the reason. Hiding them would
            make the numbers above look better than they are.
          </p>
        </div>
        {rest.length ? (
          <div className="m-grid">
            {rest.slice(0, 24).map((l) => (
              <AgentCard key={l.tokenId} listing={l} variant="row" />
            ))}
          </div>
        ) : (
          <div className="m-empty">
            <p className="m-empty__h">Every agent in this room is hireable.</p>
            <p className="m-empty__p">That is unusual, and it is more likely that few are filed here than that all of them work.</p>
          </div>
        )}
        {rest.length > 24 ? (
          <p className="m-note" style={{ marginTop: "var(--s4)" }}>
            <Link className="m-link" href={`/agents?category=${room.category}`}>
              All {all.length} filed under this job
            </Link>
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
