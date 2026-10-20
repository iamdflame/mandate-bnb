import Link from "next/link";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import type { MarketEvent } from "@/lib/market/events";
import Ago from "./Ago";

const KIND_WORD: Record<MarketEvent["kind"], string> = {
  responded: "Response",
  silent: "No answer",
  paid: "Payment",
  failed: "Failed payment",
  job: "Escrow job",
  granted: "Permission",
  revoked: "Revoked",
  listed: "New agent",
  acted: "Agent action",
};

/**
 * The pose an event's agent is drawn in: what actually happened in that
 * event, never a mood. An answer is awake, a silence dozes, a delivered
 * payment hops, a failed one is shown failing, a granted key is a leash.
 */
export const EVENT_POSE: Record<MarketEvent["kind"], CharacterState> = {
  responded: "awake",
  silent: "dozing",
  paid: "delivered",
  failed: "failed",
  job: "working",
  granted: "leashed",
  revoked: "ready",
  listed: "ready",
  acted: "working",
};

/**
 * Market events as a live tape: the agent, drawn in the pose its event
 * left it in, who, what, the one figure that matters, and when. The source
 * and proof open underneath for anyone who wants them. Rows arrive one
 * after another, the newest first.
 */
export default function Timeline({ events, detail = false, start = 0 }: { events: MarketEvent[]; detail?: boolean; start?: number }) {
  return (
    <ol className="ac-tape">
      {events.map((e, i) => {
        const row = (
          <>
            <span className="ac-tape__face" aria-hidden="true">
              <Agent job={e.category} seed={e.tokenId ?? e.actor} size={36} state={EVENT_POSE[e.kind]} omit={["leash"]} slot={`tl${start + i}`} />
            </span>
            <span className="ac-tape__main">
              {e.tokenId ? (
                <Link href={`/agents/${e.tokenId}`} className="ac-tape__who">
                  {e.actor}
                </Link>
              ) : (
                <span className="ac-tape__who">{e.actor}</span>
              )}{" "}
              <span className="ac-tape__what">{e.what}</span>
            </span>
            {e.figure ? <span className="ac-tape__fig k-num">{e.figure}</span> : <span />}
            <span className="ac-tape__at">
              <Ago iso={e.at} />
            </span>
          </>
        );
        const style = { ["--i" as string]: Math.min(start + i, 14) };
        if (!detail)
          return (
            <li key={e.id} className="ac-tape__row" data-kind={e.kind} style={style}>
              {row}
            </li>
          );
        return (
          <li key={e.id} className="ac-tape__item" data-kind={e.kind} style={style}>
            <details>
              <summary className="ac-tape__row">{row}</summary>
              <dl className="ac-tape__more">
                <div>
                  <dt>Type</dt>
                  <dd>{KIND_WORD[e.kind]}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{e.source}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd className="k-num">{new Date(e.at).toUTCString()}</dd>
                </div>
                {e.note ? (
                  <div>
                    <dt>Note</dt>
                    <dd>{e.note}</dd>
                  </div>
                ) : null}
                {e.proof ? (
                  <div>
                    <dt>Proof</dt>
                    <dd>
                      <a className="k-link k-mono" href={e.proof} target="_blank" rel="noreferrer">
                        {e.proof.replace("https://", "").slice(0, 60)}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
