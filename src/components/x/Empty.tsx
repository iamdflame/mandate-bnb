import type { ReactNode } from "react";

/** A state that tells you what to do next. Never a blank. */
export default function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="x-empty" role="status">
      <p className="x-empty__h">{title}</p>
      {children ? <div className="x-empty__p">{children}</div> : null}
      {action}
    </div>
  );
}
