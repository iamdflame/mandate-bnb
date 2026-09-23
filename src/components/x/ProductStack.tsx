import Link from "next/link";
import { Zap } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/config";
import type { Listing } from "@/lib/market/listing";
import { hireHref, hirePath } from "@/lib/market/hire-law";
import AgentArtwork from "./AgentArtwork";
import Price from "./Price";

/**
 * Three agents that can be hired right now, shown as products in the hero.
 *
 * The first thing on the page is the thing the page sells. These are the top
 * of the recommended order among agents we do not operate (ours only fill in
 * if there are too few), read from the same listing the marketplace uses.
 */
export default function ProductStack({ agents }: { agents: Listing[] }) {
  if (!agents.length) return null;
  return (
    <section className="x-stack" aria-label="Agents ready to work now">
      <p className="x-stack__k">
        <span className="x-status x-status--live">
          <span className="x-status__dot" aria-hidden="true" />
          Ready to work now
        </span>
      </p>
      <ol className="x-stack__list">
        {agents.map((l) => {
          const v = hirePath(l);
          const href = hireHref(l.tokenId, v);
          return (
            <li key={l.tokenId} className="x-stack__item">
              <span className="x-stack__art" aria-hidden="true">
                <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} shape="square" />
              </span>
              <span className="x-stack__main">
                <Link href={`/agents/${l.tokenId}`} className="x-stack__name">
                  {l.name}
                </Link>
                <span className="x-stack__cat">{l.category ? CATEGORY_LABEL[l.category] : "Unfiled"}</span>
                <span className="x-stack__row">
                  <Price l={l} size="sm" />
                  {l.probe?.latencyMs != null ? (
                    <span className="x-agent__ms x-mono">
                      <Zap size={12} aria-hidden="true" />
                      {l.probe.latencyMs} ms
                    </span>
                  ) : null}
                </span>
              </span>
              {href ? (
                <Link href={href} className="x-btn x-btn--sm x-btn--primary x-stack__use">
                  Use now
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Link href="/agents?hireable=1" className="x-stack__all">
        See every agent you can hire
      </Link>
    </section>
  );
}
