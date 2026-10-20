import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Search } from "lucide-react";

/**
 * The one lookup behind /check and /list: an agent in, a verdict out. Both
 * pages open with it, with a tab to the other carrying the same agent, so a
 * builder moves between BNB Chain's checks and our listing without typing
 * the id again. The art beside it is the ladder the result is drawn on.
 */
export default function Lookup({
  tab,
  carry,
  title,
  lede,
  action,
  name,
  value,
  placeholder,
  label,
  numeric = false,
  button,
  ways,
  note,
  art,
  compact = false,
}: {
  tab: "check" | "list";
  /** The token id to carry to the other tab, when there is one. */
  carry?: string | null;
  title: ReactNode;
  lede: ReactNode;
  action: "/check" | "/list";
  name: "q" | "id";
  value: string;
  placeholder: string;
  label: string;
  numeric?: boolean;
  button: string;
  ways?: ReactNode;
  note: ReactNode;
  art?: ReactNode;
  /** A result follows: a shorter head, so the verdict is on the first screen. */
  compact?: boolean;
}) {
  const checkHref = carry ? `/check?q=${carry}` : "/check";
  const listHref = carry ? `/list?id=${carry}` : "/list";
  return (
    <header className={`bd-look${art ? "" : " bd-look--bare"}${compact ? " bd-look--compact" : ""}`}>
      <div className="bd-look__pool" aria-hidden="true" />
      <div className="k-wrap bd-look__in">
        <div className="bd-look__copy">
          <nav className="k-tabs bd-look__tabs k-rise" aria-label="Check or list your agent" style={{ ["--i" as string]: 0 }}>
            <Link href={checkHref} className="k-tab" aria-current={tab === "check" ? "page" : undefined}>
              Set and Earn&apos;s checks
            </Link>
            <Link href={listHref} className="k-tab" aria-current={tab === "list" ? "page" : undefined}>
              Where it stands here
            </Link>
          </nav>
          <h1 className="k-display bd-look__h k-rise" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          <p className="k-lede k-rise" style={{ ["--i" as string]: 2 }}>
            {lede}
          </p>
          <form className="k-field bd-look__field k-rise" action={action} method="get" role="search" style={{ ["--i" as string]: 3 }}>
            <Search size={20} aria-hidden="true" />
            <label htmlFor={`look-${name}`} className="k-sr">
              {label}
            </label>
            <input
              id={`look-${name}`}
              name={name}
              defaultValue={value}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              inputMode={numeric ? "numeric" : undefined}
            />
            <button type="submit" className="k-btn k-btn--primary">
              {button} <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
            </button>
          </form>
          {ways ? (
            <div className="bd-look__ways k-rise" style={{ ["--i" as string]: 4 }}>
              {ways}
            </div>
          ) : null}
          <p className="k-small bd-look__note k-rise" style={{ ["--i" as string]: 5 }}>
            {note}
          </p>
        </div>
        {art ? <div className="bd-look__art">{art}</div> : null}
      </div>
    </header>
  );
}
