import Link from "next/link";
import { MARKET_ADDRESS } from "@/lib/chain/market";
import { SUPPORT } from "@/lib/site";
import Agent from "@/components/characters/Agent";
import NetworkBadge from "./NetworkBadge";

const COLUMNS: { h: string; links: { href: string; label: string; ext?: boolean }[] }[] = [
  {
    h: "The market",
    links: [
      { href: "/agents", label: "Agents" },
      { href: "/diagnose", label: "Check a wallet" },
      { href: "/leash", label: "On your wallet" },
      { href: "/activity", label: "Live" },
      { href: "/jobs", label: "Jobs with capital" },
      { href: "/desk", label: "My desk" },
    ],
  },
  {
    h: "Trust",
    links: [
      { href: "/trust", label: "How we check" },
      { href: "/graveyard", label: "What failed" },
      { href: "/proof", label: "Does hiring pay" },
      { href: "/evidence", label: "What is true now" },
      { href: "/evidence/restatement", label: "Where we were wrong" },
      { href: "/contracts", label: "Contracts" },
      { href: "/status", label: "Status" },
    ],
  },
  {
    h: "Builders",
    links: [
      { href: "/list", label: "List or check your agent" },
      { href: "/build", label: "Build an agent" },
      { href: "/quest", label: "Set and Earn" },
      { href: "/api", label: "API and MCP" },
      { href: "/brand", label: "Brand kit" },
      { href: "/judges", label: "See it work" },
    ],
  },
  {
    h: "Help",
    links: [
      { href: "/help", label: "How hiring works" },
      { href: "/alerts", label: "Liquidation alerts" },
      { href: SUPPORT.telegram, label: "Telegram", ext: true },
      { href: SUPPORT.x, label: "X, @mandate_bnb", ext: true },
    ],
  },
];

/**
 * The floor of every page. Mandate's four sleep on the ledge until someone
 * hires them, and the one address that lets anyone check us sits at the base.
 */
export default function Footer() {
  return (
    <footer className="k-foot">
      <div className="k-foot__ledge" aria-hidden="true">
        <div className="k-wrap k-wrap--wide k-foot__sleepers">
          <Agent job="grid-trading" seed="344121" house size={84} state="dozing" slot="f1" />
          <Agent job="rebalancing" seed="344119" house size={98} state="dozing" slot="f2" />
          <Agent job="yield-optimisation" seed="344122" house size={78} state="dozing" slot="f3" />
          <Agent job="health-factor" seed="344123" house size={88} state="dozing" slot="f4" />
        </div>
      </div>
      <div className="k-wrap k-wrap--wide">
        <div className="k-foot__grid">
          <div className="k-foot__lead">
            <p className="k-foot__line">Hire an agent you can check, on BNB Smart Chain.</p>
            <p className="k-small">Mandate never takes custody of your funds. Nothing here is investment advice.</p>
            <p className="k-small">
              Questions: <span className="k-foot__mail">{SUPPORT.email}</span>
            </p>
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.h} className="k-foot__col" aria-label={c.h}>
              <h2 className="k-foot__h">{c.h}</h2>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href}>
                    {l.ext ? (
                      <a href={l.href} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href}>{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="k-foot__word" aria-hidden="true">
          Mandate
        </div>
        <div className="k-foot__base">
          <NetworkBadge />
          <a className="k-mono" href={`https://bscscan.com/address/${MARKET_ADDRESS}`} target="_blank" rel="noreferrer">
            Market contract {MARKET_ADDRESS.slice(0, 10)}…{MARKET_ADDRESS.slice(-6)}
          </a>
        </div>
      </div>
    </footer>
  );
}
