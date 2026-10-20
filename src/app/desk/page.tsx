import "@/styles/account.css";
import Link from "next/link";
import type { Metadata } from "next";
import { formatEther, formatUnits, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ArrowRight, Check, Lock, X } from "lucide-react";
import Ago from "@/components/x/Ago";
import AppShell from "@/components/v2/shell/AppShell";
import Agent from "@/components/characters/Agent";
import PageHead from "@/components/k/PageHead";
import DeskConnect from "@/components/account/DeskConnect";
import RevokeDialog from "@/components/x/RevokeDialog";
import YourAgents from "@/components/x/YourAgents";
import YourApprovals from "@/components/x/YourApprovals";
import YourHires from "@/components/x/YourHires";
import YourLeashes from "@/components/x/YourLeashes";
import Dashboard from "@/components/v2/portfolio/Dashboard";
import { live } from "@/lib/data/live";
import { snapshot } from "@/lib/data/snapshots";
import { listSessions, type SessionRecord } from "@/lib/chain/session-store";
import { activeKeys, comparePolicy, readKey, KEYSTORE, type PolicyMatch } from "@/lib/chain/keystore";
import { bscClient } from "@/lib/chain/rpc";
import { RECIPIENT_BOUND, SWAP_BOUND, USDT, WBNB } from "@/lib/chain/leash";
import { HOUSE_LEASHES, houseSessionId } from "@/lib/chain/house";
import { pauseForSlug } from "@/lib/market/paused";
import { houseActivity } from "@/lib/house/runs";
import { houseLive } from "@/lib/house/run";
import { allowedCalls, CANNOT, capsOf } from "@/lib/chain/leash-words";
import { referenceRegistrations } from "@/lib/house";
import { performanceOf } from "@/lib/market/performance";
import { readGridWindow, type GridWindow } from "@/lib/grid/window";
import { withTimeout } from "@/lib/cache";
import { CATEGORY_LABEL, PROTOCOL_LABEL } from "@/lib/config";
import { DEMO_ADDRESS, bscscanAddress, bscscanTx, passkeyRecord, recenterRecord, short } from "@/lib/demo";

export const metadata: Metadata = {
  title: "My Desk | MANDATE",
  description: "Your agents, what each one may do, and the control that ends it. MANDATE's own account, its agents and every key that can act on it, read from the Altana KeyStore.",
};

export const dynamic = "force-dynamic";
// Room for the census slice that runs after the response (see lib/census/refresh).
export const maxDuration = 60;

const TOKEN_LABEL: Record<string, string> = { [USDT.toLowerCase()]: "USDT", [WBNB.toLowerCase()]: "WBNB" };
const target = (to: string) => PROTOCOL_LABEL[to.toLowerCase()] ?? short(to);
const fn = (sig: string) => sig.slice(0, sig.indexOf("("));

function spendOf(rec: SessionRecord): string {
  const spend = (rec.permissions as { spend?: { limit: string | number; period: string; token?: string }[] } | null)?.spend ?? [];
  if (!spend.length) return "none";
  return spend
    .map((s) => `${Number(formatEther(BigInt(String(s.limit)))).toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${s.token ? TOKEN_LABEL[s.token.toLowerCase()] ?? short(s.token) : "BNB"}/${s.period}`)
    .join(", ");
}

const VERDICT_TAG: Record<PolicyMatch["verdict"], string> = {
  matches: "k-tag k-tag--ours",
  "registry says revoked": "k-tag",
  "registry says expired": "k-tag",
  "not registered": "k-tag k-tag--warn",
  "expiry differs": "k-tag k-tag--warn",
  unreadable: "k-tag k-tag--warn",
};

const when = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";

/** "in 12 days", "3 hours ago": how long until, or since, a unix time. */
function until(unix: number, now = Date.now()): string {
  const ms = unix * 1000 - now;
  const past = ms < 0;
  const h = Math.abs(ms) / 3_600_000;
  const words = h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
  return past ? `${words} ago` : `in ${words}`;
}

function Can({ items, no = false }: { items: string[]; no?: boolean }) {
  return (
    <ul className={`ac-can${no ? " ac-can--no" : ""}`}>
      {items.map((t) => (
        <li key={t}>
          {no ? <X size={14} strokeWidth={2.5} aria-hidden="true" /> : <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

const STATUS_WORD = { live: "Active", paused: "Paused", expired: "Expired", revoked: "Revoked", missing: "No session" } as const;

/**
 * My Desk.
 *
 * Your agents first: the jobs you opened and the permissions agents hold over
 * your wallet, with the real controls. Then the demo account, where our four
 * reference agents act through scoped sessions: what each may do, its caps,
 * when its session ends, what the KeyStore says about it, and the control
 * that ends it. The technical record (every key, the registry reading, the
 * threat model) is kept in full underneath, one click away.
 */
export default async function DeskPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await live(["grid-window"]);
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));

  const [sessions, keys, block, activity] = await Promise.all([
    listSessions().catch(() => [] as SessionRecord[]),
    withTimeout(activeKeys(DEMO_ADDRESS).catch(() => null), 6_000),
    withTimeout(bscClient().getBlockNumber().catch(() => null), 4_000),
    withTimeout(houseActivity().catch(() => null), 4_000),
  ]);
  const agentsLive = houseLive();
  const rows = await Promise.all(
    sessions.map(async (s) => ({
      s,
      m: await withTimeout(
        comparePolicy({ wallet: s.walletAddress as Address, publicKey: s.publicKey as Hex, expiry: s.expiry, registered: s.registered, revoked: Boolean(s.revokedAt) }).catch(() => null),
        6_000,
      ),
    })),
  );

  const ownKey = process.env.PRIVATE_KEY
    ? keccak256(privateKeyToAccount((process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`) as Hex).publicKey).toLowerCase()
    : null;
  const held = new Set(sessions.map((s) => s.keyId.toLowerCase()));
  const others = keys
    ? (await Promise.all(keys.filter((k) => !held.has(k.toLowerCase())).map((k) => withTimeout(readKey(DEMO_ADDRESS, k).catch(() => null), 5_000)))).filter(
        (e): e is NonNullable<typeof e> => Boolean(e),
      )
    : null;
  const unaccounted = others?.filter((e) => e.valid && e.expiry !== 0 && e.keyId.toLowerCase() !== ownKey) ?? [];
  const admins = others?.filter((e) => e.valid && (e.expiry === 0 || e.keyId.toLowerCase() === ownKey)) ?? [];

  const recenter = recenterRecord()?.latest ?? null;
  const passkey = passkeyRecord();
  const grid = snapshot<GridWindow>("grid-window")?.payload ?? (await withTimeout(readGridWindow().catch(() => null), 8_000));
  const liveRows = rows.filter((r) => !r.s.revokedAt && r.s.expiry * 1000 > Date.now());
  const pastRows = rows.filter((r) => !liveRows.includes(r));

  // The demo account's four agents, each with its session as it stands now.
  const regs = referenceRegistrations();
  const house = HOUSE_LEASHES.map((leash) => {
    const id = houseSessionId(leash.slug);
    const row = rows.find((r) => r.s.id === id && !r.s.revokedAt) ?? rows.find((r) => r.s.id === id) ?? null;
    const s = row?.s ?? null;
    const pause = pauseForSlug(leash.slug);
    const alive = Boolean(s && !s.revokedAt && s.expiry * 1000 > Date.now());
    // Paused outranks the session: a live key nothing acts through is not an active agent.
    const status: keyof typeof STATUS_WORD = pause ? "paused" : !s ? "missing" : s.revokedAt ? "revoked" : alive ? "live" : "expired";
    const tokenId = regs[leash.slug]?.tokenId ?? null;
    const name = leash.slug.replace(/^./, (c) => c.toUpperCase());
    return {
      leash,
      name,
      s,
      m: row?.m ?? null,
      status,
      pause,
      alive,
      tokenId,
      can: allowedCalls(s?.allowlist?.length ? s.allowlist : leash.calls).map((a) => a.words),
      caps: s ? capsOf(s.permissions) : leash.tokenSpend.map((t) => `${formatUnits(t.limit, 18)} ${TOKEN_LABEL[t.token.toLowerCase()] ?? "tokens"} a day`),
      perf: tokenId ? performanceOf(tokenId, 0, activity?.[leash.slug]?.action ?? null) : null,
      run: activity?.[leash.slug] ?? null,
    };
  });

  // "0.002 BNB · 0.05 USDT a day" rather than repeating the period per token.
  const compact = (caps: string[]) => (caps.length && caps.every((c) => c.endsWith(" a day")) ? `${caps.map((c) => c.slice(0, -6)).join(" · ")} a day` : caps.join(" · "));

  const revoked = one("revoked");
  const error = one("error");
  const revokedAgent = revoked ? house.find((h) => h.s?.id === revoked)?.name ?? revoked : null;

  return (
    <AppShell>
      <PageHead
        title="My desk"
        lede="Your hires, the agents on your wallets, your approvals, and every control that ends one."
        agent={{ job: "yield-optimisation", seed: "my-desk", state: "awake" }}
        source={
          block ? (
            <>
              <span className="k-dot k-dot--live" aria-hidden="true" /> Read from BNB Smart Chain at block {Number(block).toLocaleString("en-GB")}
            </>
          ) : (
            "The chain did not answer this time"
          )
        }
      >
        {revoked ? (
          <p className="k-note k-note--ok" role="status">
            <Check size={16} strokeWidth={3} aria-hidden="true" />
            <span>
              Access revoked onchain for {revokedAgent}.{" "}
              {one("tx") ? (
                <a className="k-link k-mono" href={bscscanTx(one("tx")!)} target="_blank" rel="noreferrer">
                  {short(one("tx")!)}
                </a>
              ) : null}
            </span>
          </p>
        ) : null}
        {error ? (
          <p className="k-note k-note--err" role="alert">
            <X size={16} strokeWidth={3} aria-hidden="true" />
            <span>
              Not revoked:{" "}
              {error === "token"
                ? "the operator token did not match."
                : error === "rate"
                  ? "too many attempts; wait a minute."
                  : error === "no-operator"
                    ? "this deployment has no operator token configured."
                    : `${one("why") ?? "the revoke failed"}.`}{" "}
              Nothing changed on chain.
            </span>
          </p>
        ) : null}
      </PageHead>

      <nav className="k-subnav" aria-label="On this page">
        <div className="k-wrap k-subnav__in">
          <a className="k-tab" href="#hires">
            Hires
          </a>
          <a className="k-tab" href="#leashes">
            On your wallets
          </a>
          <a className="k-tab" href="#approvals">
            Approvals
          </a>
          <a className="k-tab" href="#jobs">
            Jobs with capital
          </a>
          <a className="k-tab" href="#yours">
            Permissions
          </a>
          <a className="k-tab" href="#demo">
            Our agents at work
          </a>
          <a className="k-tab ac-tab--quiet" href="#operator">
            Operator
          </a>
        </div>
      </nav>

      <div className="k-wrap ac-desk">
        <DeskConnect />

        {/* ------------------------------------------------------- your hires */}
        <section className="ac-dsec" aria-labelledby="h-hires" id="hires">
          <div className="ac-dsec__h">
            <h2 className="k-h3" id="h-hires">
              Your hires
            </h2>
            <p className="k-small">Every agent this wallet paid, each with the transaction that proves it.</p>
            <Link href="/quest" className="k-btn k-btn--sm k-btn--ghost ac-dsec__go">
              Quest progress <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
          <YourHires />
        </section>

        {/* ------------------------------------------------------ your leashes */}
        <section className="ac-dsec" aria-labelledby="h-leashes" id="leashes">
          <div className="ac-dsec__h">
            <h2 className="k-h3" id="h-leashes">
              Agents on your wallets
            </h2>
            <p className="k-small">Yield-1 or Guard-1 acting on a passkey wallet you own, within a daily cap, until you revoke it.</p>
            <Link href="/leash" className="k-btn k-btn--sm k-btn--ghost ac-dsec__go">
              Leash an agent <ArrowRight size={15} className="k-btn__go" aria-hidden="true" />
            </Link>
          </div>
          <YourLeashes />
        </section>

        {/* ----------------------------------------------------- your approvals */}
        <section className="ac-dsec" aria-labelledby="h-approvals" id="approvals">
          <div className="ac-dsec__h">
            <h2 className="k-h3" id="h-approvals">
              Your approvals
            </h2>
            <p className="k-small">Anything a hire here left approved on your wallet, and the button that takes it back.</p>
          </div>
          <YourApprovals />
        </section>

        {/* --------------------------------------------- your jobs with capital */}
        <section className="ac-dsec" aria-labelledby="h-jobs" id="jobs">
          <div className="ac-dsec__h">
            <h2 className="k-h3" id="h-jobs">
              Your jobs with capital
            </h2>
            <p className="k-small">Accept a bid, follow each hourly checkpoint as it settles, and take your capital back when the term is served.</p>
          </div>
          <Dashboard />
        </section>

        {/* -------------------------------------------------------- your agents */}
        <section className="ac-dsec" aria-labelledby="h-yours" id="yours">
          <div className="ac-dsec__h">
            <h2 className="k-h3" id="h-yours">
              What agents may do on your wallet
            </h2>
            <p className="k-small">Each permission, its limits, and the control that ends it.</p>
          </div>
          <YourAgents />
        </section>
      </div>

      {/* ------------------------------------------------ our agents at work */}
      <section className="k-wrap ac-sec ac-ours" aria-labelledby="h-ours" id="demo">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2" id="h-ours">
              Our agents at work
            </h2>
            <p className="k-body">Our four agents act on our own account through scoped sessions, the way one acts on a wallet you leash. These are ours; nothing here touches your wallet.</p>
            <p className="k-src">
              Our account{" "}
              <a className="k-mono" href={bscscanAddress(DEMO_ADDRESS)} target="_blank" rel="noreferrer">
                {short(DEMO_ADDRESS)}
              </a>
            </p>
          </div>
        </div>
        <ol className="ac-house">
          {house.map((h, i) => (
            <li key={h.leash.slug} className="ac-hagent" id={h.leash.slug} data-job={h.leash.category} data-status={h.status} style={{ ["--i" as string]: i }}>
              <div className="ac-hagent__top">
                <span className="ac-hagent__art" aria-hidden="true">
                  <Agent job={h.leash.category} seed={h.tokenId ?? h.leash.slug} house size={92} state={h.status === "live" ? "leashed" : "dozing"} omit={["leash"]} slot={`house${i}`} />
                </span>
                <div className="ac-hagent__who">
                  {h.tokenId ? (
                    <Link href={`/agents/${h.tokenId}`} className="ac-hagent__name">
                      {h.name}
                    </Link>
                  ) : (
                    <span className="ac-hagent__name">{h.name}</span>
                  )}
                  <span className="ac-hagent__job">
                    {CATEGORY_LABEL[h.leash.category]}
                    {h.perf && h.perf.kind !== "none" ? <span className="ac-hagent__perf">{h.perf.title}</span> : null}
                  </span>
                  <span className="k-state">
                    <span className={`k-dot ${h.status === "live" ? "k-dot--live" : h.status === "paused" ? "k-dot--warn" : ""}`} aria-hidden="true" />
                    {STATUS_WORD[h.status]}
                  </span>
                </div>
              </div>
              <dl className="ac-hagent__facts">
                <div>
                  <dt>Daily cap</dt>
                  <dd className="k-num">{compact(h.caps) || "None"}</dd>
                </div>
                <div>
                  <dt>{h.s && !h.alive ? "Expired" : "Expires"}</dt>
                  <dd className="k-num">{h.s ? until(h.s.expiry) : "Not granted"}</dd>
                </div>
              </dl>
              {h.run?.last ? (
                <p className={`ac-hagent__check ac-hagent__check--${h.run.last.outcome}`} title={h.run.last.reason}>
                  <Ago iso={h.run.last.at} prefix={h.run.last.mode === "dry" ? "Dry check" : "Checked"} />: {h.run.last.reason}
                </p>
              ) : null}
              <details className="ac-more ac-more--sm ac-hagent__more">
                <summary>
                  <span className="ac-more__t">What it can do</span>
                </summary>
                <div className="ac-more__body">
                  <div className="ac-hagent__can">
                    <div>
                      <p className="k-label">It can</p>
                      <Can items={h.can} />
                    </div>
                    <div>
                      <p className="k-label">It cannot</p>
                      <Can no items={CANNOT} />
                    </div>
                  </div>
                  <dl className="k-facts ac-facts--sm">
                    <div>
                      <dt>{h.s && !h.alive ? "Expired" : "Expires"}</dt>
                      <dd>{h.s ? `${when(h.s.expiry)} (${until(h.s.expiry)})` : "No session"}</dd>
                    </div>
                    <div>
                      <dt>KeyStore, now</dt>
                      <dd>{h.m ? <span className={VERDICT_TAG[h.m.verdict]}>{h.m.verdict}</span> : h.s ? "Unreadable" : "Nothing registered"}</dd>
                    </div>
                    {h.s ? (
                      <div>
                        <dt>Session key</dt>
                        <dd className="k-mono">{short(h.s.keyId, 12, 6)}</dd>
                      </div>
                    ) : null}
                    {h.pause ? null : (
                      <div>
                        <dt>Acts</dt>
                        <dd>{agentsLive ? "On its own, on the site's clock" : "Dry: it decides and records, and sends nothing yet"}</dd>
                      </div>
                    )}
                    {h.run?.action ? (
                      <div>
                        <dt>Last action</dt>
                        <dd>
                          <Ago iso={h.run.action.at} />
                          {h.run.action.txs.map((t) => (
                            <span key={t.tx}>
                              {"  "}
                              <a className="k-link k-mono ac-gap" href={bscscanTx(t.tx)} target="_blank" rel="noreferrer">
                                {t.step}
                              </a>
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {h.run?.action ? <p className="k-small">{h.run.action.reason}</p> : null}
                  {h.pause ? (
                    <p className="k-note k-note--warn">
                      <span>
                        {h.pause.reason} Its session is left to {h.alive ? "run out" : "stay expired"} rather than revoked, and nothing acts through it.
                      </span>
                    </p>
                  ) : null}
                  <div className="k-row" style={{ ["--gap" as string]: "8px" }}>
                    {h.alive && h.s ? (
                      <a href="#operator" className="k-btn k-btn--sm k-btn--ghost">
                        Revoke, in operator controls
                      </a>
                    ) : (
                      <p className="k-small">
                        {h.status === "expired" || (h.status === "paused" && h.s && !h.s.revokedAt)
                          ? "Nothing to revoke: the session has expired and can no longer act. Renewing it is one mainnet transaction by the operator."
                          : h.status === "revoked"
                            ? "Already revoked. It can no longer act."
                            : "No session has been granted, so it cannot act on the account."}
                      </p>
                    )}
                    {h.leash.slug === "range-1" && recenter ? (
                      <a href="#range-1-record" className="k-btn k-btn--sm k-btn--ghost">
                        Its record
                      </a>
                    ) : h.leash.slug === "grid-1" && grid ? (
                      <a href="#grid-1-window" className="k-btn k-btn--sm k-btn--ghost">
                        Its trading window
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------ the record */}
      <section className="k-wrap ac-sec" aria-labelledby="h-record">
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h3" id="h-record">
              The record, for anyone checking
            </h2>
            <p className="k-small">What our agents did with their keys, and what a stolen key could do. Read from the chain where it can be.</p>
          </div>
        </div>

        <details className="ac-more" id="range-1-record">
          <summary>
            <span className="ac-more__t">
              Range-1 used its key
              <small>An out-of-range position, recentered through RecipientBound. The NFTs never left the account.</small>
            </span>
          </summary>
          <div className="ac-more__body">
            {recenter ? (
              <dl className="k-facts">
                <div>
                  <dt>Before</dt>
                  <dd>
                    Position #{recenter.before.tokenId}, range [{recenter.before.range[0]}, {recenter.before.range[1]}), pool tick {recenter.before.tick}: out of range
                  </dd>
                </div>
                <div>
                  <dt>Withdraw</dt>
                  <dd>
                    <a className="k-link k-mono" href={bscscanTx(recenter.txs.decreaseLiquidity)} target="_blank" rel="noreferrer">
                      {short(recenter.txs.decreaseLiquidity)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Collect</dt>
                  <dd>
                    <a className="k-link k-mono" href={bscscanTx(recenter.txs.collect)} target="_blank" rel="noreferrer">
                      {short(recenter.txs.collect)}
                    </a>{" "}
                    to the principal; RecipientBound&rsquo;s collect has no recipient argument
                  </dd>
                </div>
                <div>
                  <dt>Re-mint</dt>
                  <dd>
                    <a className="k-link k-mono" href={bscscanTx(recenter.txs.mint)} target="_blank" rel="noreferrer">
                      {short(recenter.txs.mint)}
                    </a>{" "}
                    position #{recenter.after.tokenId}, range [{recenter.after.range[0]}, {recenter.after.range[1]}), tick {recenter.after.tick}: {recenter.after.inRange ? "in range" : "out of range"}
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>
                    {recenter.sameOwnerThroughout ? "The same account before and after: " : "Owner changed: "}
                    <span className="k-mono">{short(recenter.after.owner)}</span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="k-small">Not run yet.</p>
            )}
          </div>
        </details>

        <details className="ac-more" id="grid-1-window">
          <summary>
            <span className="ac-more__t">
              Grid-1&rsquo;s window
              <small>Read from SwapBound&rsquo;s own Swapped events. A simulated fill emits nothing, so none can appear here.</small>
            </span>
          </summary>
          <div className="ac-more__body">
            {grid ? (
              <>
                <div className="k-figs ac-figs--sm">
                  <div className="k-fig">
                    <span className="k-fig__n">{grid.fills.length}</span>
                    <span className="k-fig__l">fills</span>
                  </div>
                  <div className="k-fig">
                    <span className="k-fig__n">{grid.winRate === null ? "None" : `${Math.round(grid.winRate * 100)}%`}</span>
                    <span className="k-fig__l">{grid.winRate === null ? "no round trip yet" : `win rate, of ${grid.roundTrips.length}`}</span>
                  </div>
                  <div className={`k-fig ${grid.pnlUsd >= 0 ? "ac-up" : "ac-down"}`}>
                    <span className="k-fig__n">
                      {grid.pnlUsd >= 0 ? "+" : "−"}${Math.abs(grid.pnlUsd).toFixed(4)}
                    </span>
                    <span className="k-fig__l">against doing nothing</span>
                  </div>
                  <div className={`k-fig ${grid.maxDrawdownUsd > 0 ? "ac-down" : ""}`}>
                    <span className="k-fig__n">${grid.maxDrawdownUsd.toFixed(4)}</span>
                    <span className="k-fig__l">worst drawdown</span>
                  </div>
                </div>
                <p className="k-src">
                  {grid.window.start
                    ? `Window ${grid.window.start.slice(0, 16).replace("T", " ")} to ${grid.window.end?.slice(0, 16).replace("T", " ")} UTC (${(grid.window.hours ?? 0).toFixed(1)} h). `
                    : "No fill yet. "}
                  Gas ${grid.gasUsd.toFixed(4)} at the chain&apos;s price, included. Read to block {grid.toBlock.toLocaleString("en-GB")}.
                </p>
                {grid.fills.length ? (
                  <div className="k-table-wrap">
                    <table className="k-table">
                      <thead>
                        <tr>
                          <th>When (UTC)</th>
                          <th>Side</th>
                          <th className="ac-r">USDT</th>
                          <th className="ac-r">WBNB</th>
                          <th className="ac-r">Price</th>
                          <th>Transaction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grid.fills.map((f) => (
                          <tr key={f.tx}>
                            <td>{f.at ? f.at.slice(0, 19).replace("T", " ") : `block ${f.block}`}</td>
                            <td className="k-table__main">{f.side === "buy" ? "bought BNB" : "sold BNB"}</td>
                            <td className="ac-r">{f.usdt.toFixed(4)}</td>
                            <td className="ac-r">{f.wbnb.toFixed(6)}</td>
                            <td className="ac-r">{f.price.toFixed(2)}</td>
                            <td>
                              <a className="k-link k-mono" href={bscscanTx(f.tx)} target="_blank" rel="noreferrer">
                                {short(f.tx)}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="k-small">The window could not be read from the chain just now. That is our read failing, not a result.</p>
            )}
          </div>
        </details>

        <details className="ac-more" id="passkey">
          <summary>
            <span className="ac-more__t">
              A passkey wallet, start to finish
              <small>Grant, act, revoke, on mainnet, with the KeyStore read at each step.</small>
            </span>
          </summary>
          <div className="ac-more__body">
            {passkey ? (
              <dl className="k-facts">
                <div>
                  <dt>Wallet</dt>
                  <dd>
                    <a className="k-link k-mono" href={bscscanAddress(passkey.wallet)} target="_blank" rel="noreferrer">
                      {short(passkey.wallet)}
                    </a>{" "}
                    (admin: {passkey.admin.kind})
                  </dd>
                </div>
                <div>
                  <dt>Policy granted</dt>
                  <dd>
                    {passkey.session.calls.map((c) => `${fn(c.signature)} on ${target(c.to)}`).join(", ")}; spend{" "}
                    {passkey.session.spend
                      .map((s) => `${Number(formatEther(BigInt(s.limit))).toString()} ${s.token ? TOKEN_LABEL[s.token.toLowerCase()] ?? short(s.token) : "BNB"}/${s.period}`)
                      .join(", ")}
                    ; expires {when(passkey.session.expiry)}
                  </dd>
                </div>
                {Object.entries(passkey.txs).map(([k, h]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {h ? (
                        <a className="k-link k-mono" href={bscscanTx(h)} target="_blank" rel="noreferrer">
                          {short(h)}
                        </a>
                      ) : (
                        "the relay did not report a hash"
                      )}
                    </dd>
                  </div>
                ))}
                {Object.entries(passkey.keystore).map(([k, v]) => (
                  <div key={`ks-${k}`}>
                    <dt>KeyStore {k}</dt>
                    <dd>
                      session key {v.sessionValid ? "valid" : "not valid"}
                      {v.adminValid === undefined || v.adminValid === null ? "" : `, admin key ${v.adminValid ? "valid" : "not valid"}`} at block {v.block.toLocaleString("en-GB")}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Afterwards</dt>
                  <dd>{passkey.discarded}</dd>
                </div>
              </dl>
            ) : (
              <p className="k-small">Not run yet.</p>
            )}
          </div>
        </details>

        <details className="ac-more" id="stolen">
          <summary>
            <span className="ac-more__t">
              If a key is stolen
              <small>What the thief gets, by key. Written against the allowlists and the contracts behind them.</small>
            </span>
          </summary>
          <div className="ac-more__body">
            <div className="k-table-wrap">
              <table className="k-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>The thief can</th>
                    <th>The thief cannot</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="k-table__main">Rebalancing session</td>
                    <td>
                      Withdraw the principal&rsquo;s positions and re-mint them, up to RecipientBound&rsquo;s remaining caps, with everything landing back on the principal. Spend a little of the account&rsquo;s BNB on gas.
                    </td>
                    <td>Send tokens or positions to any other address. Call the position manager directly. Approve anything. Act after expiry or revoke.</td>
                  </tr>
                  <tr>
                    <td className="k-table__main">Grid session</td>
                    <td>
                      Trade USDT and WBNB in the one 0.05% pool, up to SwapBound&rsquo;s lifetime caps (3 USDT, 0.005 WBNB sold), at a price of their choosing above zero. Bad trades can lose value up to those caps.
                    </td>
                    <td>Receive the proceeds, which go to the principal. Trade any other token or pool. Approve anything. Act after expiry or revoke.</td>
                  </tr>
                  <tr>
                    <td className="k-table__main">Yield session</td>
                    <td>Move the principal&rsquo;s USDT or BNB into or out of Venus supply.</td>
                    <td>Send it anywhere else, borrow, or supply on another account&rsquo;s behalf.</td>
                  </tr>
                  <tr>
                    <td className="k-table__main">Health-factor session</td>
                    <td>Repay the principal&rsquo;s own Venus debt and add collateral.</td>
                    <td>Borrow, withdraw collateral, or repay for someone else.</td>
                  </tr>
                  <tr>
                    <td className="k-table__main">Operator token</td>
                    <td>Revoke sessions from this page, which stops agents working.</td>
                    <td>Grant a key, or move any funds.</td>
                  </tr>
                  <tr>
                    <td className="k-table__main">Adjudicator key</td>
                    <td>Propose a false epoch result, which anyone can challenge with the observation inside the 300 second window.</td>
                    <td>Withdraw escrow, change parameters, or take the owner&rsquo;s role. It is a different key from the owner.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="k-small">
              The same table, with the reasoning, is in <span className="k-mono">docs/threat-model.md</span>.{" "}
              <Link className="k-link" href="/status">
                Is the judge path up right now
              </Link>
            </p>
          </div>
        </details>
      </section>

      {/* ---------------------------------------------- operator controls, last */}
      <section className="k-wrap ac-sec ac-op-wrap" aria-labelledby="h-operator">
        <details className="ac-op" id="operator" open={Boolean(revoked || error)}>
          <summary>
            <span className="ac-op__ic" aria-hidden="true">
              <Lock size={18} />
            </span>
            <span className="ac-more__t">
              <span id="h-operator">Operator</span>
              <small>Controls for our own account. They need the operator token, which visitors do not have.</small>
            </span>
          </summary>
          <div className="ac-op__body">
            <p className="k-src">
              Account{" "}
              <a className="k-mono" href={bscscanAddress(DEMO_ADDRESS)} target="_blank" rel="noreferrer">
                {DEMO_ADDRESS}
              </a>
              <span className="ac-gap">
                KeyStore{" "}
                <a className="k-mono" href={bscscanAddress(KEYSTORE)} target="_blank" rel="noreferrer">
                  {short(KEYSTORE)}
                </a>
              </span>
            </p>

            {house.some((h) => h.alive && h.s) ? (
              <div className="ac-op__revokes">
                <p className="k-label">End an agent&rsquo;s session</p>
                <div className="k-row" style={{ ["--gap" as string]: "8px" }}>
                  {house
                    .filter((h) => h.alive && h.s)
                    .map((h) => (
                      <span key={h.leash.slug} className="ac-op__rv">
                        <span className="k-small">{h.name}</span>
                        <RevokeDialog sessionId={h.s!.id} agent={h.name} calls={h.can} />
                      </span>
                    ))}
                </div>
              </div>
            ) : null}

            <details className="ac-more" id="keys" open={Boolean(revoked || error)}>
              <summary>
                <span className="ac-more__t">
                  Keys that can act right now
                  <small>The policy is what this site granted. The KeyStore column is the registry, read live. They should agree.</small>
                </span>
                <span className="ac-more__n">{liveRows.length}</span>
              </summary>
              <div className="ac-more__body">
                {liveRows.length === 0 ? (
                  <p className="k-small">No live session on our own account.</p>
                ) : (
                  <div className="k-table-wrap">
                    <table className="k-table ac-keys">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>May call, and nothing else</th>
                          <th>Spend cap</th>
                          <th>Expires</th>
                          <th>KeyStore, now</th>
                          <th>End it</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveRows.map(({ s, m }) => (
                          <tr key={s.id} id={s.id}>
                            <td>
                              <strong className="ac-keys__l">{s.label}</strong>
                              <div className="k-mono k-small">{short(s.keyId, 12, 6)}</div>
                              {s.registrationTx ? (
                                <a className="k-link k-small" href={bscscanTx(s.registrationTx)} target="_blank" rel="noreferrer">
                                  registered
                                </a>
                              ) : (
                                <span className="k-small">{s.registered ? "registered" : "not registered: enforced by the account, invisible to KeyStore readers"}</span>
                              )}
                            </td>
                            <td>
                              {s.allowlist.map((c) => (
                                <div key={c.to + c.signature} className="k-mono k-small">
                                  {fn(c.signature)} on {target(c.to)}
                                </div>
                              ))}
                            </td>
                            <td className="k-small">{spendOf(s)}</td>
                            <td className="k-small">{when(s.expiry)}</td>
                            <td>
                              {m ? (
                                <>
                                  <span className={VERDICT_TAG[m.verdict]}>{m.verdict}</span>
                                  {m.registry?.expiry ? <div className="k-small">registry expiry {when(m.registry.expiry)}</div> : null}
                                </>
                              ) : (
                                <span className="k-tag k-tag--warn">unreadable</span>
                              )}
                            </td>
                            <td>
                              <form className="ac-keys__rv" method="post" action="/api/desk/revoke">
                                <input type="hidden" name="id" value={s.id} />
                                <input className="ac-dialog__input" type="password" name="token" placeholder="operator token" aria-label="Operator token" autoComplete="off" />
                                <button className="k-btn k-btn--sm" type="submit">
                                  Revoke
                                </button>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="k-small">
                  Revoking needs the operator token because it spends the account&rsquo;s gas. Nothing on this page can grant a key. Rebalancing keys are granted on{" "}
                  <a className="k-link k-mono" href={`https://repo.sourcify.dev/56/${RECIPIENT_BOUND}`} target="_blank" rel="noreferrer">
                    RecipientBound
                  </a>{" "}
                  and grid keys on{" "}
                  <a className="k-link k-mono" href={`https://repo.sourcify.dev/56/${SWAP_BOUND}`} target="_blank" rel="noreferrer">
                    SwapBound
                  </a>
                  , never on PancakeSwap directly: both write the principal as the recipient from immutable storage, so no key here can name where the money goes.
                </p>
              </div>
            </details>

            <details className="ac-more">
              <summary>
                <span className="ac-more__t">KeyStore: keys this site does not hold</span>
              </summary>
              <div className="ac-more__body">
                {others === null ? (
                  <p className="k-small">The KeyStore did not answer, so this list is unknown rather than empty.</p>
                ) : unaccounted.length === 0 ? (
                  <p className="k-small">
                    None. {admins.length ? `${admins.length} admin key${admins.length === 1 ? "" : "s"} (the account's own signer, no expiry). ` : ""}
                    Every other valid key on the account is listed above.
                  </p>
                ) : (
                  <ul className="ac-calls">
                    {unaccounted.map((e) => (
                      <li key={e.keyId} className="k-mono">
                        {short(e.keyId, 14, 6)} valid until {e.expiry ? when(e.expiry) : "no expiry"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>

            {pastRows.length ? (
              <details className="ac-more">
                <summary>
                  <span className="ac-more__t">Keys that have ended</span>
                  <span className="ac-more__n">{pastRows.length}</span>
                </summary>
                <div className="ac-more__body">
                  <div className="k-table-wrap">
                    <table className="k-table">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Ended</th>
                          <th>KeyStore, now</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastRows.map(({ s, m }) => (
                          <tr key={s.id}>
                            <td>
                              <strong className="ac-keys__l">{s.label}</strong>
                              <div className="k-mono k-small">{short(s.keyId, 12, 6)}</div>
                            </td>
                            <td className="k-small">
                              {s.revokedAt ? `revoked ${s.revokedAt.slice(0, 16).replace("T", " ")} UTC` : `expired ${when(s.expiry)}`}
                              {s.revokeTx ? (
                                <>
                                  {" "}
                                  <a className="k-link k-mono" href={bscscanTx(s.revokeTx)} target="_blank" rel="noreferrer">
                                    {short(s.revokeTx)}
                                  </a>
                                </>
                              ) : null}
                              {s.revokedBecause ? <div>{s.revokedBecause}</div> : null}
                            </td>
                            <td>{m ? <span className={VERDICT_TAG[m.verdict]}>{m.verdict}</span> : <span className="k-tag k-tag--warn">unreadable</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </details>
      </section>
    </AppShell>
  );
}
