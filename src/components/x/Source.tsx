import type { ReactNode } from "react";
import Ago from "./Ago";

/**
 * Where a figure came from, on one small line under it.
 *
 * Four sources feed these pages and they are not equally good, so they are
 * named rather than blended: the chain at a block, our own call to an agent,
 * our record of something we did, and our index of the chain. A figure a
 * reader cannot trace to one of them should not be on the page.
 */

export type SourceKind = "chain" | "probe" | "record" | "index";

const WORD: Record<SourceKind, string> = {
  chain: "BNB Smart Chain",
  probe: "Our call to the agent",
  record: "Our record",
  index: "Our index of the chain",
};

const MEANS: Record<SourceKind, string> = {
  chain: "Read from BNB Smart Chain at the block shown. Nobody's opinion, including ours.",
  probe: "We called the endpoint ourselves and kept what came back.",
  record: "Our own record of something we did. Check it against the transaction.",
  index: "Built from the chain by our own reader, refreshed on a clock.",
};

export default function Source({
  kind,
  block,
  at,
  verb = "read",
  children,
}: {
  kind: SourceKind;
  /** The block the figure was read at, when there is one. */
  block?: number | null;
  /** When it was read, shown as an age that stays true. */
  at?: string | null;
  /** What happened at that time: "read", "locked", "recorded". */
  verb?: string;
  /** Anything else a reader needs, such as how to check it. */
  children?: ReactNode;
}) {
  return (
    <p className="x-src" title={MEANS[kind]}>
      <span className="x-src__k">{WORD[kind]}</span>
      {block ? <span className="x-mono">block {block.toLocaleString("en-GB")}</span> : null}
      {at ? (
        <span>
          <Ago iso={at} prefix={verb} />
        </span>
      ) : null}
      {children ? <span className="x-src__note">{children}</span> : null}
    </p>
  );
}
