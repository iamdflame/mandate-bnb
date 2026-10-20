import type { ReactNode } from "react";
import Agent, { type CharacterState } from "@/components/characters/Agent";

/** A state that tells you what to do next, with an agent keeping the place. Never a blank. */
export default function Empty({
  title,
  children,
  action,
  job = "rebalancing",
  pose = "dozing",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** Whose family keeps this empty place, when the page is about one job. */
  job?: string;
  pose?: CharacterState;
}) {
  return (
    <div className="k-empty x-empty" role="status">
      <Agent job={job} seed={`empty-${job}`} size={96} state={pose} slot="empty" />
      <p className="k-empty__t">{title}</p>
      {children ? <div className="k-empty__d">{children}</div> : null}
      {action ? <div className="k-row" style={{ justifyContent: "center" }}>{action}</div> : null}
    </div>
  );
}
