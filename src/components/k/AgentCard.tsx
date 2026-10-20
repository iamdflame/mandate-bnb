import Link from "next/link";
import Agent from "@/components/characters/Agent";
import { answeredAgo, poseOf } from "@/lib/view/state";
import type { MarketCard } from "@/lib/market/market-api";

/**
 * One agent in the market's own template: its face, its words, its price, and
 * how recently it answered. Every agent on the site is shown with this card,
 * so agents from many builders read as one shelf and differ only by what is
 * true of them. Styles: src/styles/agents.css.
 */
export default function AgentCard({ a, i = 0, slot = "card" }: { a: Pick<MarketCard, "tokenId" | "name" | "job" | "jobLabel" | "ours" | "hireable" | "price" | "whyNot" | "checked" | "delivers" | "answeredMinutesAgo" | "what">; i?: number; slot?: string }) {
  const pose = poseOf(a);
  return (
    <Link href={`/agents/${a.tokenId}`} className="k-agent" data-job={a.job ?? undefined} style={{ ["--i" as string]: i }}>
      <span className="k-agent__art" aria-hidden="true">
        <Agent job={a.job} seed={a.tokenId} house={a.ours} size={112} state={pose} slot={slot} />
      </span>
      <span className="k-agent__body">
        <span className="k-agent__top">
          <span className="k-agent__job">{a.jobLabel}</span>
          {a.ours ? <span className="k-tag k-tag--ours">Ours</span> : null}
        </span>
        <span className="k-agent__name">{a.name}</span>
        {a.what ? <span className="k-agent__what">{a.what}</span> : null}
        <span className="k-agent__facts">
          <span className="k-agent__price k-num">{a.hireable ? (a.price ?? "No price") : (a.whyNot?.short ?? "Not hireable now")}</span>
          <span className="k-agent__meta">
            {a.delivers ? (
              <span className="k-num">delivers in {a.delivers.seconds < 60 ? `${a.delivers.seconds} s` : `${Math.round(a.delivers.seconds / 60)} min`}</span>
            ) : (
              <span>no delivery yet</span>
            )}
            <span className="k-state">
              <span className={`k-dot ${pose === "awake" ? "k-dot--live" : pose === "ready" ? "k-dot--ready" : pose === "failed" || pose === "graveyard" ? "k-dot--err" : ""}`} aria-hidden="true" />
              {answeredAgo(a.answeredMinutesAgo) ?? "not answering"}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
