import Link from "next/link";
import { Check, HelpCircle, Zap } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/config";
import type { Listing } from "@/lib/market/listing";
import { hireHref, hirePath } from "@/lib/market/hire-law";
import { assayFor } from "@/lib/market/assays";
import { trustOf } from "@/lib/market/trust";
import AgentArtwork from "./AgentArtwork";
import Status from "./Status";
import Price from "./Price";
import Ago from "./Ago";
import CompareToggle from "./CompareToggle";

/**
 * One agent, as a product on a shelf.
 *
 * The hierarchy is the brief's: the picture, the name, what it does, what it
 * costs, whether it is alive and what we have proven, and then the action.
 * Technical detail (token id, rail, exact token amount) is present but small,
 * because a person choosing between agents reads the price long before the
 * payment scheme.
 *
 * Everything shown is a fact we hold: the status is our own call, the price
 * is read from its own 402, the response time is what we measured, and a ✓
 * only ever marks something a check proved. Use now appears only when the
 * hire law finds a rail we can settle; otherwise the reason sits there.
 */

const RAIL: Record<string, string> = { x402: "x402", mandate: "ERC-8183" };
// The chip sits on the art beside "Run by Mandate"; the full name is on the agent page.
const SHORT: Record<string, string> = { "health-factor": "Health Factor" };
/*
  The census calls every agent in slices, so each one is re-checked roughly
  every hour and a quarter. Flagging anything over thirty minutes marked
  nearly every tile stale; three hours means a check has genuinely been missed.
*/
const STALE_MIN = 180;

export default function AgentTile({ l, forPosition }: { l: Listing; forPosition?: string }) {
  const verdict = hirePath(l);
  const href = hireHref(l.tokenId, verdict);
  const trust = trustOf(l, assayFor(l.tokenId));
  const rail = verdict.rails.map((r) => RAIL[r.kind]).find(Boolean) ?? (l.quote || l.declaresPayment ? "x402" : null);
  const detail = `/agents/${l.tokenId}${forPosition ? `?about=${encodeURIComponent(forPosition)}` : ""}`;
  const checkedAt = l.probe?.at ?? null;
  const stale = checkedAt ? (Date.now() - Date.parse(checkedAt)) / 60_000 > STALE_MIN : false;
  const shown = trust.badges.slice(0, 2);

  return (
    <article className={`x-agent${verdict.ok ? "" : " x-agent--dim"}`} data-agent={l.tokenId}>
      <div className="x-agent__art">
        <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} />
        <div className="x-agent__over">
          <Status liveness={l.liveness} at={l.probe?.at} />
        </div>
        <div className="x-agent__under">
          {l.category ? (
            <span className="x-catchip">
              <span className={`x-dotcat x-dotcat--${l.category}`} aria-hidden="true" />
              {SHORT[l.category] ?? CATEGORY_LABEL[l.category]}
            </span>
          ) : null}
          {verdict.ours ? (
            <span className="x-catchip x-catchip--ref" title="One of Mandate's own reference agents, listed with the same checks as everyone else">
              Run by Mandate
            </span>
          ) : null}
        </div>
      </div>

      <div className="x-agent__cmp">
        <CompareToggle tokenId={l.tokenId} name={l.name} />
      </div>

      <div className="x-agent__body">
        <Link href={detail} className="x-agent__name">
          {l.name}
        </Link>
        <p className="x-agent__what">{l.what ?? "Published no description of what it does."}</p>

        <div className="x-agent__buy">
          <Price l={l} rail={rail} />
          <span className="x-agent__live">
            {l.probe?.answered && l.probe.latencyMs != null ? (
              <span className="x-agent__ms x-mono">
                <Zap size={13} aria-hidden="true" />
                {l.probe.latencyMs} ms
              </span>
            ) : null}
            {checkedAt ? (
              <span className={`x-agent__ago${stale ? " x-agent__ago--stale" : ""}`}>
                <Ago iso={checkedAt} prefix={stale ? "last checked" : "checked"} />
              </span>
            ) : null}
          </span>
        </div>

        <ul className="x-agent__trust" aria-label="What we have proven">
          {shown.length ? (
            shown.map((b) => (
              <li key={b} className="x-proofchip x-proofchip--proven">
                <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                {b}
              </li>
            ))
          ) : (
            <li className="x-proofchip x-proofchip--unproven">
              <HelpCircle size={13} aria-hidden="true" />
              Nothing proven yet
            </li>
          )}
        </ul>

        <div className="x-agent__foot">
          <Link href={detail} className="x-btn x-btn--sm x-btn--ghost x-agent__view">
            View agent
          </Link>
          {verdict.ok && href ? (
            <Link href={href} className="x-btn x-btn--sm x-btn--primary">
              Use now
            </Link>
          ) : null}
        </div>
        {!verdict.ok && verdict.short ? (
          <p className="x-agent__why" title={verdict.reason ?? undefined}>
            {verdict.short}
          </p>
        ) : null}
      </div>
    </article>
  );
}
