import type { ReactNode } from "react";
import Agent, { type CharacterState } from "@/components/characters/Agent";

/**
 * A small empty or waiting state inside an account section: a decorative
 * character (a neutral seed, never a real agent's state), one line that says
 * what is true, and the next action. For a whole-page empty, use x/Empty.
 */
export default function None({
  children,
  action,
  job = "yield-optimisation",
  pose = "dozing",
  seed = "desk-none",
}: {
  children: ReactNode;
  action?: ReactNode;
  job?: string;
  pose?: CharacterState;
  seed?: string;
}) {
  return (
    <div className="ac-none" role="status">
      <Agent job={job} seed={seed} size={56} state={pose} slot={`none${seed}`} />
      <div className="ac-none__t">{children}</div>
      {action ? <div className="ac-none__a">{action}</div> : null}
    </div>
  );
}

/** Rows still being read: shimmering placeholders in the row's own shape. */
export function Reading({ label, rows = 2 }: { label: string; rows?: number }) {
  return (
    <div className="ac-reading" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ac-reading__row">
          <span className="k-skel ac-reading__face" />
          <span className="ac-reading__lines">
            <span className="k-skel" style={{ width: `${46 - i * 8}%` }} />
            <span className="k-skel" style={{ width: `${30 + i * 6}%` }} />
          </span>
        </div>
      ))}
      <span className="k-sr">{label}</span>
    </div>
  );
}
