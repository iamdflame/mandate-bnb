import type { ReactNode } from "react";

/**
 * A figure, what it is, and where it came from.
 *
 * The source goes in the title so hovering any number answers "says who, and
 * when". A missing figure renders as a dash with its reason rather than as a
 * zero, because a zero is a claim.
 */
export default function Metric({
  value,
  label,
  source,
  accent = false,
}: {
  value: ReactNode | null;
  label: string;
  source?: string;
  accent?: boolean;
}) {
  const none = value === null || value === undefined || value === "";
  return (
    <div className="x-metric" title={source}>
      <span className={`x-metric__v${accent && !none ? " x-metric__v--accent" : ""}${none ? " x-metric__v--none" : ""}`}>
        {none ? "Not published" : value}
      </span>
      <span className="x-metric__k">{label}</span>
    </div>
  );
}
