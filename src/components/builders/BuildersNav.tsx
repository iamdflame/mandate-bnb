import Link from "next/link";
import { Code2, Gift, Hammer, ScanSearch, Stamp } from "lucide-react";
import ShowCurrent from "./ShowCurrent";

export type BuildersPlace = "build" | "check" | "quest" | "api" | "brand";

const PLACES: { key: BuildersPlace; href: string; label: string; Icon: typeof Hammer }[] = [
  { key: "build", href: "/build", label: "Build an agent", Icon: Hammer },
  { key: "check", href: "/check", label: "Check or list your agent", Icon: ScanSearch },
  { key: "quest", href: "/quest", label: "Set and Earn", Icon: Gift },
  { key: "api", href: "/api", label: "API and MCP", Icon: Code2 },
  { key: "brand", href: "/brand", label: "Brand kit", Icon: Stamp },
];

/**
 * The Builders place's own navigation, under the main bar on every builder
 * page: building, checking (one lookup with two tabs, /check and /list), the
 * campaign, the API and MCP, and the brand kit. `current` is null on pages
 * that belong here but are not one of the five, such as /judges.
 */
export default function BuildersNav({ current }: { current: BuildersPlace | null }) {
  return (
    <nav className="k-subnav bd-subnav" aria-label="Builders">
      <div className="k-wrap k-subnav__in">
        {PLACES.map(({ key, href, label, Icon }) => (
          <Link key={key} href={href} className="k-tab bd-subnav__tab" aria-current={current === key ? "page" : undefined}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
        <ShowCurrent />
      </div>
    </nav>
  );
}
