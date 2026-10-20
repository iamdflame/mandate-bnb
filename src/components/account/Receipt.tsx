import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import CopyLine from "./CopyLine";

/**
 * One template for every record of a job with capital: the plain receipt
 * (/receipts/[id]), the full on-chain record (/mandate/[id]) and a job left
 * on a contract we replaced (/ledger/[deployment]/[id]). The same head, the
 * same paper for the terms, the same tape for what happened, the same "check
 * it yourself" foot, and links between the views of one job.
 *
 * The character is the job's family in the pose its state gives it: running
 * is working, waiting is ready, anything over is dozing. It is decorative
 * (a seed made from the job), never one of the agents' faces.
 */
export function ReceiptHead({
  kind,
  title,
  lede,
  status,
  tone = "neutral",
  job,
  seed,
  pose,
  back = { href: "/activity", label: "All activity" },
  views,
  children,
}: {
  kind: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  status: string;
  tone?: "live" | "neutral" | "warn";
  job: string | null;
  seed: string;
  pose: CharacterState;
  back?: { href: string; label: string };
  /** The other views of the same job. */
  views?: { href: string; label: string; current?: boolean }[];
  children?: ReactNode;
}) {
  return (
    <header className="ac-rh" data-job={job ?? undefined}>
      <div className="ac-rh__pool" aria-hidden="true" />
      <div className="k-wrap ac-rh__in">
        <div className="ac-rh__copy">
          <Link className="ac-rh__back" href={back.href}>
            <ArrowLeft size={15} aria-hidden="true" /> {back.label}
          </Link>
          <p className="ac-rh__kind k-rise" style={{ ["--i" as string]: 0 }}>
            {kind}
          </p>
          <h1 className="k-display ac-rh__h k-rise" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          <p className="ac-rh__status k-rise" style={{ ["--i" as string]: 2 }}>
            <span className={`k-dot ${tone === "live" ? "k-dot--live" : tone === "warn" ? "k-dot--warn" : ""}`} aria-hidden="true" />
            {status}
          </p>
          {lede ? (
            <p className="k-lede k-rise" style={{ ["--i" as string]: 3 }}>
              {lede}
            </p>
          ) : null}
          {views?.length ? (
            <nav className="ac-rh__views k-rise" aria-label="Views of this job" style={{ ["--i" as string]: 4 }}>
              {views.map((v) => (
                <Link key={v.href} href={v.href} className="k-chip" aria-current={v.current ? "page" : undefined}>
                  {v.label}
                </Link>
              ))}
            </nav>
          ) : null}
          {children}
        </div>
        <div className="ac-rh__art" aria-hidden="true">
          <div className="ac-rh__floor" />
          <Agent job={job} seed={seed} size={176} state={pose} slot="rh" />
        </div>
      </div>
    </header>
  );
}

/** The terms, set as a receipt: label left, value right, a rule between. */
export function ReceiptPaper({ title, note, rows, children }: { title: string; note?: ReactNode; rows: { k: ReactNode; v: ReactNode; strong?: boolean }[]; children?: ReactNode }) {
  return (
    <section className="ac-paper" aria-label={title}>
      <div className="ac-paper__head">
        <h2 className="k-h3">{title}</h2>
        {note ? <p className="k-small">{note}</p> : null}
      </div>
      <dl className="ac-paper__rows">
        {rows.map((r, i) => (
          <div key={i} className={r.strong ? "ac-paper__row ac-paper__row--strong" : "ac-paper__row"}>
            <dt>{r.k}</dt>
            <dd>{r.v}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="ac-paper__foot">{children}</div> : null}
    </section>
  );
}

/** A titled part of a record. */
export function ReceiptPart({ title, note, children, id }: { title: string; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="ac-part" id={id} aria-label={title}>
      <div className="ac-part__head">
        <h2 className="k-h3">{title}</h2>
        {note ? <p className="k-small">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** What happened, in order: a dot, the event, its figure and its proof. */
export function ReceiptTape({ rows }: { rows: { key: string; t: ReactNode; d?: ReactNode; fig?: ReactNode; tone?: "up" | "down" | "warn" | "plain"; at?: ReactNode }[] }) {
  return (
    <ol className="ac-rtape">
      {rows.map((r, i) => (
        <li key={r.key} className="ac-rtape__row" data-tone={r.tone ?? "plain"} style={{ ["--i" as string]: Math.min(i, 12) }}>
          <span className="ac-rtape__dot" aria-hidden="true" />
          <div className="ac-rtape__main">
            <p className="ac-rtape__t">{r.t}</p>
            {r.d ? <div className="ac-rtape__d">{r.d}</div> : null}
          </div>
          {r.fig ? <span className="ac-rtape__fig k-num">{r.fig}</span> : null}
          {r.at ? <span className="ac-rtape__at k-num">{r.at}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** The command that re-derives the record from the chain alone. */
export function ReceiptCheck({ commands, note }: { commands: string[]; note?: ReactNode }) {
  return (
    <section className="ac-check" aria-label="Check it yourself">
      <div className="ac-part__head">
        <h2 className="k-h3">Check it yourself</h2>
        <p className="k-small">{note ?? "Reads the chain and nothing we control."}</p>
      </div>
      {commands.map((c) => (
        <CopyLine key={c}>{c}</CopyLine>
      ))}
    </section>
  );
}
