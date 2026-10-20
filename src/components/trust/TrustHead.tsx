import TrustNav from "./TrustNav";

/**
 * The top of every page in Trust: a title that makes the page's claim, one
 * sentence under it, something to look at beside it (a drawn scene, a
 * character, a live figure), and the Trust rooms underneath. Unlike the
 * shared PageHead, the art stays on a phone, set small above the title, so
 * no page in this place opens on a wall of text.
 */
export default function TrustHead({
  title,
  lede,
  crumbs,
  actions,
  source,
  art,
  artWide = false,
  children,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: React.ReactNode;
  source?: React.ReactNode;
  /** The scene beside the title. Decorative unless it says otherwise. */
  art?: React.ReactNode;
  /** The art takes the larger share of the row (a scene, not a portrait). */
  artWide?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      <header className={`tr-head${artWide ? " tr-head--wide" : ""}`}>
        <div className="tr-head__pool" aria-hidden="true" />
        <div className="k-wrap tr-head__in">
          <div className="tr-head__copy">
            {crumbs?.length ? (
              <nav className="k-crumbs k-rise" aria-label="Breadcrumb" style={{ ["--i" as string]: 0 }}>
                {crumbs.map((c) => (
                  <a key={c.href} href={c.href}>
                    {c.label}
                  </a>
                ))}
              </nav>
            ) : null}
            <h1 className="k-display tr-head__h k-rise" style={{ ["--i" as string]: 1 }}>
              {title}
            </h1>
            {lede ? (
              <p className="k-lede k-rise" style={{ ["--i" as string]: 2 }}>
                {lede}
              </p>
            ) : null}
            {children ? (
              <div className="tr-head__more k-rise" style={{ ["--i" as string]: 3 }}>
                {children}
              </div>
            ) : null}
            {actions ? (
              <div className="k-row k-rise" style={{ ["--i" as string]: 4 }}>
                {actions}
              </div>
            ) : null}
            {source ? (
              <p className="k-src k-rise" style={{ ["--i" as string]: 5 }}>
                {source}
              </p>
            ) : null}
          </div>
          {art ? <div className="tr-head__art">{art}</div> : null}
        </div>
      </header>
      <TrustNav />
    </>
  );
}
