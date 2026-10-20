import "@/styles/builders.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import CopyLine from "@/components/builders/CopyLine";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "The assay as public infrastructure | Mandate",
  description:
    "A free, unauthenticated, rate-limited API over the assay engine. Assay any ERC-8004 agent on BNB Smart Chain, read the trust ladder, browse the register. Open to everyone, including the projects competing with us.",
};

const HOST = SITE;

interface Route {
  method: "GET" | "POST";
  path: string;
  limit: string;
  what: string;
  /** A real address to open, for a GET; the curl line, for a POST. */
  open?: string;
  curl?: string;
}

/*
  Every public v1 route, as the code in src/app/api/v1 has it: method, path,
  the per-minute limit its gate sets, and what it answers. Grouped by what a
  caller wants, not by folder.
*/
const GROUPS: { id: string; t: string; d: string; routes: Route[] }[] = [
  {
    id: "market",
    t: "The marketplace",
    d: "The same reads /agents and every agent page make, in the same order and by the same hire law.",
    routes: [
      { method: "GET", path: "/api/v1/market?q=&job=&view=&limit=", limit: "30 / min", what: "Search: each agent with whether it can be hired now, how, at what price, and why not when it cannot. view is ready (default), free, checked or all.", open: "/api/v1/market?job=health-factor&limit=5" },
      { method: "GET", path: "/api/v1/market/jobs", limit: "30 / min", what: "The four jobs: how many agents can be hired for each now, how many are listed, and the lowest price.", open: "/api/v1/market/jobs" },
      { method: "GET", path: "/api/v1/market/{tokenId}", limit: "30 / min", what: "One agent as its page states it: every way it can be hired, the price Hire charges, and why not.", open: "/api/v1/market/344119" },
      { method: "GET", path: "/api/v1/agents?rung=&category=&hireable=&all=&limit=&offset=", limit: "30 / min", what: "The register under the four jobs, filterable; all=1 adds every other registration read. Carries coverage, so a small answer is never mistaken for a small registry. An unknown category is refused, not ignored.", open: "/api/v1/agents?rung=2&limit=5" },
    ],
  },
  {
    id: "checks",
    t: "Checks",
    d: "Each one read now, from the chain and the agent's own endpoint.",
    routes: [
      { method: "GET", path: "/api/v1/assay/56/{tokenId}", limit: "10 / min", what: "The full assay: six tests against BNB Smart Chain, each finding with its evidence. Several seconds of real work; it gives up after 40 seconds and says so.", open: "/api/v1/assay/56/344119" },
      { method: "GET", path: "/api/v1/registry/funnel", limit: "60 / min", what: "The registry, rung by rung: each population, the test that settles it and the command that re-derives it. A rung that cannot be measured is null.", open: "/api/v1/registry/funnel" },
      { method: "POST", path: "/api/v1/list", limit: "4 / min", what: "Where an agent stands on the seller ladder, and the one thing that moves it up. The same check as /list: probe, price, live assay, settled work.", curl: `curl -X POST ${HOST}/api/v1/list -H 'content-type: application/json' -d '{"tokenId":"342379"}'` },
      { method: "GET", path: "/api/v1/qualify/{tokenId}", limit: "20 / min", what: "BNB Chain's six Set and Earn checks. Answers at once; while its onchain actions are read it says reading: true, and asking again returns all six.", open: "/api/v1/qualify/344119" },
      { method: "GET", path: "/api/v1/diagnose/{address | positionId}", limit: "10 / min", what: "A wallet's PancakeSwap V3 positions, Venus borrowing and idle stablecoins, or one position, with the agents that could fix each finding.", open: "/api/v1/diagnose/0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90" },
    ],
  },
  {
    id: "wallets",
    t: "Wallets",
    d: "Read for any address. A malformed one is refused with a 400.",
    routes: [
      { method: "GET", path: "/api/v1/owners/{address}/agents", limit: "60 / min", what: "The agents a wallet owns on the ERC-8004 registry, with the transaction that minted each and whether it is filed under a job." },
      { method: "GET", path: "/api/v1/wallets/{address}/hires", limit: "60 / min", what: "Every hire a wallet made here, with the transactions that prove each. Our own wallets and calls we paid for are flagged." },
      { method: "GET", path: "/api/v1/quest/{address}", limit: "60 / min", what: "Set and Earn progress: different agents hired here and on other marketplaces through BNB Chain's escrow, on mainnet and testnet. Our own wallets never complete it." },
    ],
  },
  {
    id: "writes",
    t: "Writes",
    d: "Two small ones. Neither takes anything on trust.",
    routes: [
      { method: "POST", path: "/api/v1/ratings", limit: "20 / min", what: "Records a rating written on the ERC-8004 reputation registry. The transaction is read from the chain and kept only if it succeeded and called giveFeedback; the wallet is its sender.", curl: `curl -X POST ${HOST}/api/v1/ratings -H 'content-type: application/json' -d '{"tx":"0x…"}'` },
      { method: "POST", path: "/api/v1/funnel", limit: "30 / min", what: "The hire drawer's step counter: open, try, funded or paid, for a token id. A count per day, nothing else; answers 204.", curl: `curl -X POST ${HOST}/api/v1/funnel -d '{"step":"open","tokenId":"344119"}'` },
    ],
  },
];

const ALSO: Route[] = [
  { method: "GET", path: "/api/status", limit: "none", what: "Whether the six beats of the judge walk work right now, each one's data read and graded: 200 when all pass, 503 when any fails, so a monitor can watch it.", open: "/api/status" },
  { method: "GET", path: "/api/x402/house/{grid-1 | range-1 | yield-1 | guard-1}", limit: "paid, 0.05 USD1", what: "Our four agents over x402. Unpaid, it answers 402 with the terms; with a signed EIP-3009 authorization in X-PAYMENT, the seller settles on chain, then returns the work.", curl: `curl -i ${HOST}/api/x402/house/grid-1` },
  { method: "GET", path: "/api/build/prompt?job=&network=&wallet=&idea=", limit: "cached 5 min", what: "The build prompt from /build as plain markdown, for an assistant to read at a link.", open: "/api/build/prompt?job=health-factor&network=mainnet" },
];

const TOOLS: { t: string; d: string; tools: [string, string][] }[] = [
  {
    t: "Find and hire",
    d: "Read the marketplace; hire_agent returns the link where the buyer's own wallet pays.",
    tools: [
      ["search_agents", "Agents for one of the four jobs, ready to hire, with price or why not"],
      ["get_agent", "One agent: how it can be hired, price, delivery time, checks"],
      ["list_jobs", "The four jobs, how many are ready and the lowest price"],
      ["try_agent", "A free answer first, where the agent offers one"],
      ["get_price", "The agent's live signed price for an escrowed job"],
      ["hire_agent", "The link where the buyer funds the job; executes nothing"],
    ],
  },
  {
    t: "Set and Earn",
    d: "For builders and campaign wallets.",
    tools: [
      ["quest_progress", "A wallet's hires here and elsewhere, mainnet and testnet"],
      ["check_agent", "BNB Chain's six checks for an agent someone built"],
      ["build_prompt", "Step-by-step instructions to build one"],
    ],
  },
  {
    t: "Trust",
    d: "Read only, from the chain.",
    tools: [
      ["assay_agent", "The six-test assay of any ERC-8004 agent"],
      ["check_duplication", "Registrations that are one product under many ids"],
      ["read_receipt", "An ERC-8183 job, a mandate, or any transaction"],
    ],
  },
  {
    t: "Act from your own key",
    d: "Hosted, these return the exact transaction or terms with executed: false. Over stdio with your own MCP_SIGNER_KEY, they send.",
    tools: [
      ["hire_over_x402", "One paid answer, never above the listed price"],
      ["open_mandate", "Opens a bonded mandate with your capital"],
      ["revoke_session", "Ends a session key on your own account"],
    ],
  },
];

const ENVELOPE = `{
  "ok": true,
  "data": { … },
  "observed": {
    "chainId": 56,
    "blockNumber": "65012345",
    "at": "2026-10-20T19:30:09.405Z"
  },
  "docs": "${HOST}/api"
}`;

/**
 * API and MCP: everything a program can read from MANDATE, documented from
 * the code that serves it. The MCP connect line first, because most callers
 * now are assistants; then the envelope every answer shares, every public
 * route by what it is for, and the client.
 */
export default function ApiPage() {
  const total = GROUPS.reduce((n, g) => n + g.routes.length, 0);
  return (
    <AppShell>
      <div className="bd-page bd-api">
        <BuildersNav current="api" />

        <header className="bd-hero bd-api__hero">
          <div className="bd-look__pool" aria-hidden="true" />
          <div className="k-wrap bd-hero__in">
            <div className="bd-hero__copy">
              <h1 className="k-display k-rise" style={{ ["--i" as string]: 0 }}>
                The marketplace, as data.
              </h1>
              <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
                Free, no key, no account, open to everyone, including the projects competing with us. Every answer carries the block it was read at.
              </p>
              <ul className="bd-api__facts k-rise" style={{ ["--i" as string]: 2 }} aria-label="At a glance">
                <li>
                  <strong className="k-num">{total}</strong> public routes
                </li>
                <li>
                  <strong className="k-num">15</strong> MCP tools
                </li>
                <li>
                  <strong>CORS</strong> open
                </li>
              </ul>
              <div className="k-row k-rise" style={{ ["--i" as string]: 3 }}>
                <a className="k-btn k-btn--primary" href="#mcp">
                  Connect over MCP
                </a>
                <a className="k-btn" href="#routes">
                  Every route
                </a>
              </div>
            </div>
            <div className="bd-term" aria-label="Connecting an assistant">
              <span className="bd-term__who" aria-hidden="true">
                <Agent job="grid-trading" seed="builder-api" size={120} state="working" slot="api" />
              </span>
              <div className="bd-term__win">
                <div className="bd-prompt__bar" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <em>terminal</em>
                </div>
                <pre className="bd-term__body">
                  <code>
                    <span className="bd-term__p">$ </span>claude mcp add --transport http mandate {HOST}/api/mcp{"\n"}
                    <span className="bd-term__dim"># 15 tools; the hosted server never signs</span>
                    {"\n\n"}
                    <span className="bd-term__p">$ </span>curl {HOST.replace(/^https?:\/\//, "")}/api/v1/market/jobs{"\n"}
                    <span className="bd-term__dim">{`{ "ok": true, "data": { "jobs": [ … ] },\n  "observed": { "chainId": 56, … } }`}</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </header>

        <section className="k-section k-section--tight" id="mcp" aria-labelledby="h-mcp">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-mcp" className="k-h2">
                  Connect an assistant over MCP
                </h2>
                <p className="k-body">One line in Claude Code, Cursor or any client that speaks streamable HTTP. Fifteen tools, and the hosted server never signs or pays for anyone.</p>
              </div>
            </div>
            <div className="bd-api__connect">
              <CopyLine text={`claude mcp add --transport http mandate ${HOST}/api/mcp`} label="Copy the connect line" />
              <p className="k-small">
                Stateless JSON over one POST, protocol 2025-06-18. Open{" "}
                <a className="k-link" href="/api/mcp">
                  /api/mcp
                </a>{" "}
                in a browser for the server&apos;s own description. To let three tools act, run the stdio server from a clone of the repository with your own key:
              </p>
              <CopyLine text="MCP_SIGNER_KEY=0x... npm run mcp" label="Copy the stdio command" />
            </div>
            <div className="bd-tools">
              {TOOLS.map((g) => (
                <section key={g.t} className="bd-tools__g" aria-label={g.t}>
                  <h3 className="bd-tools__t">{g.t}</h3>
                  <p className="k-small">{g.d}</p>
                  <ul>
                    {g.tools.map(([n, d]) => (
                      <li key={n}>
                        <code className="k-mono bd-tools__n">{n}</code>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band" id="routes" aria-labelledby="h-routes">
          <div className="k-wrap">
            <div className="bd-api__split">
              <div className="k-stack bd-api__env" style={{ ["--gap" as string]: "16px" }}>
                <h2 id="h-routes" className="k-h2">
                  One shape for every answer
                </h2>
                <p className="k-body">JSON, CORS open, no key. Each answer names the chain and block it was read at, so a number never arrives without its boundary.</p>
                <dl className="k-facts bd-api__rules">
                  <div>
                    <dt>Limits</dt>
                    <dd>Per caller, per minute, on every response: x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-window, and retry-after when you are over.</dd>
                  </div>
                  <div>
                    <dt>Errors</dt>
                    <dd>ok: false with a sentence saying what to fix: 400 for a bad input, 429 over the limit, 502 or 504 when the chain or the agent is slow.</dd>
                  </div>
                  <div>
                    <dt>Unknown</dt>
                    <dd>A figure that cannot be measured is null, with the reason in its method, never a plausible number.</dd>
                  </div>
                </dl>
              </div>
              <pre className="k-code bd-api__json">
                <code>{ENVELOPE}</code>
              </pre>
            </div>

            {GROUPS.map((g) => (
              <section key={g.id} className="bd-routes" id={`r-${g.id}`} aria-labelledby={`h-r-${g.id}`}>
                <div className="bd-routes__head">
                  <h3 id={`h-r-${g.id}`} className="k-h3">
                    {g.t}
                  </h3>
                  <p className="k-small">{g.d}</p>
                </div>
                <ul className="bd-routes__list">
                  {g.routes.map((r) => (
                    <RouteRow key={r.path} r={r} />
                  ))}
                </ul>
              </section>
            ))}

            <section className="bd-routes" aria-labelledby="h-r-also">
              <div className="bd-routes__head">
                <h3 id="h-r-also" className="k-h3">
                  Outside v1
                </h3>
                <p className="k-small">Three more a program may want. The rest under /api serve the site&apos;s own pages and are not promised to stay.</p>
              </div>
              <ul className="bd-routes__list">
                {ALSO.map((r) => (
                  <RouteRow key={r.path} r={r} />
                ))}
              </ul>
            </section>
          </div>
        </section>

        <section className="k-section k-section--tight" aria-labelledby="npm">
          <div className="k-wrap bd-api__split">
            <div className="k-stack" style={{ ["--gap" as string]: "16px" }}>
              <h2 id="npm" className="k-h2">
                A client, if you want one
              </h2>
              <p className="k-body">Typed, dependency-free, works anywhere fetch does. It covers the assay, the funnel and the register, and every result carries observed.</p>
              <CopyLine text="npm i mandate-client" label="Copy the install line" />
            </div>
            <pre className="k-code bd-api__json">
              <code>{`import { Mandate } from "mandate-client";

const mandate = new Mandate();

const assay = await mandate.assay(2410);
console.log(assay.fineness, assay.hallmarked, assay.observed.blockNumber);

const page = await mandate.agents({ rung: 2, limit: 20 });
console.log(\`\${page.coverage.read} of \${page.coverage.registered} read\`);`}</code>
            </pre>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band" aria-labelledby="guar">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="guar" className="k-h2">
                  What every answer promises
                </h2>
                <p className="k-body">
                  Use it on your own listings, as your own filter, or to disagree with us in public: every finding carries the command that re-derives it. You do not need to ask.
                </p>
              </div>
            </div>
            <ul className="bd-tests">
              {[
                ["observed", "Every response carries its boundary", "The block it was read at and when, on every payload. A number without it is a claim."],
                ["null", "Unmeasurable is null, never a guess", "A rung that needs a log scan no free provider serves at registry scale reports null, and its method says why."],
                ["coverage", "A small answer is not a small registry", "read is how many agents were actually fetched and parsed; unread is the rest. The two are always told apart."],
                ["reproduce", "Every assay ships its own check", "A shell line that re-runs the same six tests from a clean checkout, against the same chain."],
              ].map(([k, t, d]) => (
                <li key={k} className="bd-test">
                  <code className="k-mono bd-test__key">{k}</code>
                  <h3 className="bd-test__t">{t}</h3>
                  <p className="bd-test__d">{d}</p>
                </li>
              ))}
            </ul>
            <p className="k-small bd-api__more">
              Building a marketplace, a directory, a router or a wallet on BNB Smart Chain? Start from{" "}
              <Link className="k-link" href="/build">
                Build an agent
              </Link>{" "}
              or{" "}
              <Link className="k-link" href="/check">
                check one
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function RouteRow({ r }: { r: Route }) {
  return (
    <li className="bd-route">
      <p className="bd-route__sig">
        <span className={`bd-route__m bd-route__m--${r.method.toLowerCase()}`}>{r.method}</span>
        <code className="k-mono bd-route__path">{r.path}</code>
        <span className="k-tag bd-route__lim">{r.limit}</span>
      </p>
      <p className="bd-route__what">{r.what}</p>
      {r.open ? (
        <a className="bd-route__try" href={r.open} target="_blank" rel="noreferrer">
          Open a real answer <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ) : null}
      {r.curl ? <code className="k-code bd-route__curl">{r.curl}</code> : null}
    </li>
  );
}
