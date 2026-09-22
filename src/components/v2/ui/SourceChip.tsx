/**
 * Where a number came from, next to the number.
 *
 * This is the rule that makes the rest of the product believable, and it is
 * the one a marketplace usually skips: a figure on a page is worth nothing if
 * a reader cannot tell whether it was read from the chain a second ago, taken
 * from somebody else's indexer last Tuesday, or asserted by us. Four sources
 * exist here and they are not equally good, so they are named rather than
 * blended.
 *
 * A figure without one of these is a bug, not a style choice.
 */

import type { ReactNode } from "react";

export type Source = "chain" | "probe" | "scan" | "house" | "db";

const LABEL: Record<Source, string> = {
  chain: "chain",
  probe: "our probe",
  scan: "8004scan",
  house: "our record",
  db: "our index",
};

const MEANS: Record<Source, string> = {
  chain: "Read from BNB Smart Chain at the block shown. Nobody's opinion, including ours.",
  probe: "We called the endpoint ourselves and recorded what came back.",
  scan: "Someone else's indexer. Useful for fields the chain does not hold, and it can lag.",
  house: "Our own record of something we did. Check it against the transaction.",
  db: "Our index, built from the chain and refreshed on a clock.",
};

export function ageOf(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

export function SourceChip({
  source,
  block,
  at,
  note,
}: {
  source: Source;
  /** Block the figure was read at, when there is one. */
  block?: number | string | null;
  /** When it was read, so the chip can say how stale it is. */
  at?: string | null;
  /** Anything else a reader needs, such as the command to reproduce it. */
  note?: string;
}) {
  const age = ageOf(at);
  const blockText = block === null || block === undefined ? null : `block ${Number(block).toLocaleString("en-GB")}`;
  // The title is the hover and the focus affordance both. A chip is
  // focusable so the source is reachable without a pointer.
  const title = [MEANS[source], blockText, age ? `read ${age} ago` : null, note].filter(Boolean).join(" ");

  return (
    <span className="m-src" tabIndex={0} title={title}>
      <span className="m-src__k">{LABEL[source]}</span>
      {blockText ? <span className="m-src__b">{blockText}</span> : null}
      {age ? <span className="m-src__a">{age}</span> : null}
    </span>
  );
}

/** A block number and how long ago it was, in one mono string a machine can read too. */
export function BlockAge({ block, at }: { block?: number | string | null; at?: string | null }) {
  const age = ageOf(at);
  if (block === null || block === undefined) return age ? <span className="m-mono m-note">{age} ago</span> : null;
  return (
    <span className="m-mono m-note">
      block {Number(block).toLocaleString("en-GB")}
      {age ? (
        <>
          {" · "}
          <time dateTime={at ?? undefined}>{age}</time>
        </>
      ) : null}
    </span>
  );
}

/** A figure with its source under it. The default way to print any number. */
export function Figure({
  n,
  unit,
  source,
  block,
  at,
  note,
  children,
}: {
  n: ReactNode;
  unit?: string;
  source: Source;
  block?: number | string | null;
  at?: string | null;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <span className="m-figure">
      <span className="m-figure__n m-mono">
        {n}
        {unit ? <span className="m-figure__u">{unit}</span> : null}
      </span>
      <SourceChip source={source} block={block} at={at} note={note} />
      {children}
    </span>
  );
}
