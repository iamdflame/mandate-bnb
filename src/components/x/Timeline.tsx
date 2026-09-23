import Link from "next/link";
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
 * Market events as a flat timeline: a dot, who, what, the one figure that
 * matters, and when. The source and proof open underneath for anyone who
 * wants them.
 */
export default function Timeline({ events, detail = false }: { events: MarketEvent[]; detail?: boolean }) {
  return (
    <ol className="x-tl">
      {events.map((e) => {
        const row = (
          <>
            <span className={`x-tl__dot x-tl__dot--${e.kind}`} aria-hidden="true" />
            <span className="x-tl__main">
              {e.tokenId ? (
                <Link href={`/agents/${e.tokenId}`} className="x-tl__actor">
                  {e.actor}
                </Link>
              ) : (
                <span className="x-tl__actor">{e.actor}</span>
              )}{" "}
              <span className="x-tl__what">{e.what}</span>
            </span>
            {e.figure ? <span className="x-tl__fig x-mono">{e.figure}</span> : <span />}
            <span className="x-tl__at">
              <Ago iso={e.at} />
            </span>
          </>
        );
        if (!detail) return <li key={e.id} className="x-tl__row">{row}</li>;
        return (
          <li key={e.id} className="x-tl__item">
            <details>
              <summary className="x-tl__row">{row}</summary>
              <dl className="x-tl__more">
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
                  <dd className="x-mono">{new Date(e.at).toUTCString()}</dd>
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
                      <a className="x-link x-mono" href={e.proof} target="_blank" rel="noreferrer">
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
