import Agent, { type CharacterState } from "@/components/characters/Agent";

/**
 * The top of every inner page: where you are, the one sentence that says what
 * the page is for, and an agent in the pose that fits it. Optional crumbs above,
 * optional actions and provenance below.
 */
export default function PageHead({
  title,
  lede,
  crumbs,
  actions,
  source,
  agent,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
  source?: React.ReactNode;
  /** The character beside the title; job and pose chosen for the page's subject. */
  agent?: { job: string; seed: string; state?: CharacterState; house?: boolean };
  children?: React.ReactNode;
}) {
  return (
    <header className="k-phead">
      <div className="k-wrap k-phead__in">
        <div className="k-phead__copy">
          {crumbs?.length ? (
            <nav className="k-crumbs" aria-label="Breadcrumb">
              {crumbs.map((c) => (
                <a key={c.href} href={c.href}>
                  {c.label}
                </a>
              ))}
            </nav>
          ) : null}
          <h1 className="k-display k-phead__h k-rise" style={{ ["--i" as string]: 0 }}>
            {title}
          </h1>
          {lede ? (
            <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
              {lede}
            </p>
          ) : null}
          {actions ? (
            <div className="k-row k-rise" style={{ ["--i" as string]: 2 }}>
              {actions}
            </div>
          ) : null}
          {source ? <p className="k-src k-rise" style={{ ["--i" as string]: 3 }}>{source}</p> : null}
          {children}
        </div>
        {agent ? (
          <div className="k-phead__art" aria-hidden="true">
            <div className="k-phead__pool" />
            <Agent job={agent.job} seed={agent.seed} state={agent.state ?? "ready"} house={agent.house} size={168} slot="phead" />
          </div>
        ) : null}
      </div>
    </header>
  );
}
