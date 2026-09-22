import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/config";
import type { Listing } from "@/lib/market/listing";
import { hireHref, hirePath } from "@/lib/market/hire-law";
import { assayFor } from "@/lib/market/assays";
import { trustOf } from "@/lib/market/trust";
import AgentArtwork from "./AgentArtwork";
import Status from "./Status";
import Metric from "./Metric";
import CompareToggle from "./CompareToggle";

/**
 * One agent, as a product on a shelf.
 *
 * Everything on the tile is a fact we hold, not a claim we repeated: the
 * status is our own call to its endpoint, the price is read from its own 402,
 * the response time is what we measured, and the checks are the stored
 * assay. What we do not know says so ("Not published") instead of showing a
 * zero. The Use button appears only when the hire law finds a rail we can
 * actually settle; otherwise the reason sits where the button would be.
 */

const RAIL: Record<string, string> = { x402: "x402", mandate: "ERC-8183" };

export default function AgentTile({ l, forPosition }: { l: Listing; forPosition?: string }) {
  const verdict = hirePath(l);
  const href = hireHref(l.tokenId, verdict);
  const trust = trustOf(l, assayFor(l.tokenId));
  const rails = verdict.rails.map((r) => RAIL[r.kind]).filter(Boolean);
  const detail = `/agents/${l.tokenId}${forPosition ? `?about=${encodeURIComponent(forPosition)}` : ""}`;

  const tags = [...new Set([...l.protocols.slice(0, 2), ...rails])].slice(0, 4);
  const shown = trust.badges.slice(0, 2);

  return (
    <article className={`x-agent${verdict.ok ? "" : " x-agent--dim"}`} data-agent={l.tokenId}>
      <div className="x-agent__art">
        <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} />
        <div className="x-agent__over">
          <Status liveness={l.liveness} />
        </div>
      </div>

      <div className="x-agent__cmp">
        <CompareToggle tokenId={l.tokenId} name={l.name} />
      </div>

      <div className="x-agent__body">
        <div className="x-agent__top">
          <span className="x-eyebrow">{l.category ? CATEGORY_LABEL[l.category] : "Unfiled"}</span>
          {verdict.ours ? (
            <span className="x-tag x-tag--ref" title="One of Mandate's own reference agents. Listed with the same checks as everyone else.">
              Reference
            </span>
          ) : (
            <span className="x-agent__id">#{l.tokenId}</span>
          )}
        </div>

        <Link href={detail} className="x-agent__name">
          {l.name}
        </Link>

        <p className="x-agent__what">{l.what ?? "Published no description of what it does."}</p>

        {tags.length ? (
          <div className="x-agent__tags">
            {tags.map((t) => (
              <span key={t} className="x-tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="x-agent__metrics">
          <Metric
            value={l.priceLabel}
            label={l.priceLabel ? "per call" : "price"}
            accent
            source="Read from the agent's own payment response"
          />
          <Metric
            value={l.probe?.answered && l.probe.latencyMs != null ? `${l.probe.latencyMs} ms` : null}
            label="response"
            source="Measured by our own call to its endpoint"
          />
          <Metric
            value={trust.verified === null ? null : `${trust.verified}/${trust.applicable}`}
            label="checks"
            source="Stored checks against the chain, not the agent's description"
          />
        </div>

        <div className="x-agent__trust">
          {shown.length ? (
            shown.map((b) => (
              <span key={b} className="x-check x-check--pass">
                <Check size={14} strokeWidth={2.25} aria-hidden="true" />
                {b}
              </span>
            ))
          ) : (
            <span className="x-check x-check--unknown">
              <Minus size={14} strokeWidth={2.25} aria-hidden="true" />
              Nothing verified yet
            </span>
          )}
        </div>

        <div className="x-agent__foot">
          <Link href={detail} className="x-btn x-btn--sm">
            View agent
          </Link>
          {verdict.ok && href ? (
            <Link href={href} className="x-btn x-btn--sm x-btn--primary">
              Use now
            </Link>
          ) : null}
        </div>
        {!verdict.ok && verdict.reason ? <p className="x-agent__why">{verdict.reason}</p> : null}
      </div>
    </article>
  );
}
