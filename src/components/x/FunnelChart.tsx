import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Stage } from "@/lib/market/funnel";
import { logHeights } from "@/lib/market/funnel";
import Ago from "./Ago";

/**
 * The signature picture: every registered agent narrowing to the ones you can
 * hire today. Heights are logarithmic so the bottom of the funnel is visible
 * next to the top, and each stage opens the list it counts.
 */
export default function FunnelChart({ stages }: { stages: Stage[] }) {
  const heights = logHeights(stages);
  return (
    <ol className="x-funnel" aria-label="From registered agents to hireable agents">
      {stages.map((s, i) => {
        const hgt = heights[i];
        const last = i === stages.length - 1;
        const body = (
          <>
            <span className="x-funnel__n x-mono">{s.n === null ? "unknown" : s.n.toLocaleString("en-GB")}</span>
            <span className="x-funnel__track" aria-hidden="true">
              <span className="x-funnel__bar" style={{ height: `${Math.round((hgt ?? 0) * 100)}%` }} />
            </span>
            <span className="x-funnel__k">{s.label}</span>
          </>
        );
        return (
          <li key={s.key} className={`x-funnel__stage${last ? " x-funnel__stage--end" : ""}`} title={s.source}>
            {s.href ? (
              <Link href={s.href} className="x-funnel__link">
                {body}
              </Link>
            ) : (
              <span className="x-funnel__link">{body}</span>
            )}
            <span className="x-funnel__src">{s.at ? <Ago iso={s.at} /> : "time unknown"}</span>
            {!last ? <ChevronRight size={16} className="x-funnel__arrow" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
