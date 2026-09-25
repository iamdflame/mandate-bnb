import Link from "next/link";
import type { Metadata } from "next";
import { formatEther, formatUnits, keccak256, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Check, X } from "lucide-react";
import Ago from "@/components/x/Ago";
import AppShell from "@/components/v2/shell/AppShell";
import AgentArtwork from "@/components/x/AgentArtwork";
import RevokeDialog from "@/components/x/RevokeDialog";
import YourAgents from "@/components/x/YourAgents";
import YourApprovals from "@/components/x/YourApprovals";
import YourHires from "@/components/x/YourHires";
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
  matches: "m-tag m-tag--verified",
  "registry says revoked": "m-tag",
  "registry says expired": "m-tag",
  "not registered": "m-tag m-tag--caution",
  "expiry differs": "m-tag m-tag--caution",
  unreadable: "m-tag m-tag--caution",
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
    <ul className={`x-can${no ? " x-can--no" : ""}`}>
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
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">My Desk</h1>
          <p className="x-mkt-head__sub">Your hires, your approvals, and every control that ends one.</p>
          <p className="x-fresh x-mkt-head__fresh">
            {block ? (
              <>
                <span className="x-status__dot" style={{ background: "var(--c-ok)" }} aria-hidden="true" />
                Read at block {Number(block).toLocaleString("en-GB")}
              </>
            ) : (
              "The chain did not answer this time"
            )}
          </p>
        </div>

        {revoked ? (
          <p className="x-banner x-banner--ok" role="status">
            <Check size={16} strokeWidth={3} aria-hidden="true" />
            <span>
              Access revoked onchain for {revokedAgent}.{" "}
              {one("tx") ? (
                <a className="x-link x-mono" href={bscscanTx(one("tx")!)} target="_blank" rel="noreferrer">
                  {short(one("tx")!)}
                </a>
              ) : null}
            </span>
          </p>
        ) : null}
        {error ? (
          <p className="x-banner x-banner--err" role="alert">
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
      </section>

      {/* ------------------------------------------------------- your hires */}
      <section className="x-wrap x-section--tight" aria-labelledby="h-hires" id="hires">
        <div className="x-head">
          <div>
            <h2 id="h-hires">Your hires</h2>
            <p>Every agent this wallet paid, each with the transaction that proves it.</p>
          </div>
          <Link href="/quest" className="x-head__link">
            Quest progress
          </Link>
        </div>
        <YourHires />
      </section>

      {/* ------------------------------------------------------ your leashes */}
      <section className="x-wrap x-section--tight" aria-labelledby="h-leashes" id="leashes">
        <div className="x-head">
          <div>
            <h2 id="h-leashes">Agents on your wallets</h2>
            <p>Let Yield-1 or Guard-1 act on a passkey wallet you own, within a daily cap, until you revoke it.</p>
          </div>
          <Link href="/leash" className="x-head__link">
            Leash an agent
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------- your approvals */}
      <section className="x-wrap x-section--tight" aria-labelledby="h-approvals" id="approvals">
        <div className="x-head">
          <div>
            <h2 id="h-approvals">Your approvals</h2>
            <p>Anything a hire here left approved on your wallet, and the button that takes it back.</p>
          </div>
        </div>
        <YourApprovals />
      </section>

      {/* -------------------------------------------------------- your agents */}
      <section className="x-wrap x-section--tight" aria-labelledby="h-yours" id="yours">
        <div className="x-head">
          <div>
            <h2 id="h-yours">Your agents</h2>
            <p>What each agent may do, its limits, and the control that ends it.</p>
          </div>
        </div>
        <YourAgents />

        {/* The demo account, right under it: the agents a visitor can actually see at work. */}
        <h3 className="x-desk-sub" id="demo">
          MANDATE&apos;s own account{" "}
          <a className="x-link x-mono" href={bscscanAddress(DEMO_ADDRESS)} target="_blank" rel="noreferrer">
            {short(DEMO_ADDRESS)}
          </a>
          <span className="x-desk-sub__n">Our four reference agents, each acting through a scoped session</span>
        </h3>
        <ol className="x-house-list">
          {house.map((h) => (
            <li key={h.leash.slug} className="x-house" id={h.leash.slug}>
              <div className="x-house__row">
                <span className="x-house__art" aria-hidden="true">
                  <AgentArtwork category={h.leash.category} seed={`${h.tokenId ?? h.leash.slug}:Mandate ${h.name}`} shape="square" />
                </span>
                <span className="x-house__main">
                  {h.tokenId ? (
                    <Link href={`/agents/${h.tokenId}`} className="x-house__name">
                      {h.name}
                    </Link>
                  ) : (
                    <span className="x-house__name">{h.name}</span>
                  )}
                  <span className="x-house__sub">
                    {CATEGORY_LABEL[h.leash.category]}
                    {h.perf && h.perf.kind !== "none" ? ` · ${h.perf.title}` : ""}
                  </span>
                  {h.run?.last ? (
                    <span className={`x-house__check x-house__check--${h.run.last.outcome}`} title={h.run.last.reason}>
                      <Ago iso={h.run.last.at} prefix={h.run.last.mode === "dry" ? "Dry check" : "Checked"} />: {h.run.last.reason}
                    </span>
                  ) : null}
                </span>
                <span className={`x-house__st x-house__st--${h.status}`}>
                  <span className="x-status__dot" aria-hidden="true" />
                  {STATUS_WORD[h.status]}
                </span>
                <span className="x-house__cell">
                  <span className="x-house__k">Daily cap</span>
                  {compact(h.caps) || "None"}
                </span>
                <span className="x-house__cell">
                  <span className="x-house__k">{h.s && !h.alive ? "Expired" : "Expires"}</span>
                  {h.s ? until(h.s.expiry) : "Not granted"}
                </span>
                <details className="x-house__manage">
                  <summary className="x-btn x-btn--sm">Manage</summary>
                  <div className="x-house__panel">
                    <div>
                      <h3 className="x-hire__h">It can</h3>
                      <Can items={h.can} />
                    </div>
                    <div>
                      <h3 className="x-hire__h">It cannot</h3>
                      <Can no items={CANNOT} />
                    </div>
                    <dl className="x-kv">
                      <div>
                        <dt>Daily cap</dt>
                        <dd>{compact(h.caps) || "None"}</dd>
                      </div>
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
                          <dd className="x-mono">{short(h.s.keyId, 12, 6)}</dd>
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
                                {" · "}
                                <a className="x-link x-mono" href={bscscanTx(t.tx)} target="_blank" rel="noreferrer">
                                  {t.step}
                                </a>
                              </span>
                            ))}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {h.run?.action ? <p className="x-house__did">{h.run.action.reason}</p> : null}
                    {h.pause ? (
                      <p className="x-house__pause">
                        {h.pause.reason} Its session is left to {h.alive ? "run out" : "stay expired"} rather than revoked, and nothing acts through it.
                      </p>
                    ) : null}
                    <div className="x-house__act">
                      {h.alive && h.s ? (
                        <RevokeDialog sessionId={h.s.id} agent={h.name} calls={h.can} />
                      ) : (
                        <p className="x-pay__note">
                          {h.status === "expired" || (h.status === "paused" && h.s && !h.s.revokedAt)
                            ? "Nothing to revoke: the session has expired and can no longer act. Renewing it is one mainnet transaction by the operator."
                            : h.status === "revoked"
                              ? "Already revoked. It can no longer act."
                              : "No session has been granted, so it cannot act on the account."}
                        </p>
                      )}
                      {h.leash.slug === "range-1" && recenter ? (
                        <a href="#range-1-record" className="x-btn x-btn--sm x-btn--ghost">
                          Its record
                        </a>
                      ) : h.leash.slug === "grid-1" && grid ? (
                        <a href="#grid-1-window" className="x-btn x-btn--sm x-btn--ghost">
                          Its trading window
                        </a>
                      ) : null}
                    </div>
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------- technical record below */}
      <section className="x-wrap x-section--tight x-records" aria-labelledby="h-advanced">
        <h2 id="h-advanced">Advanced controls and the record</h2>
        <p className="x-ad-src">
          Account{" "}
          <a className="x-link x-mono" href={bscscanAddress(DEMO_ADDRESS)} target="_blank" rel="noreferrer">
            {DEMO_ADDRESS}
          </a>{" "}
          · KeyStore{" "}
          <a className="x-link x-mono" href={bscscanAddress(KEYSTORE)} target="_blank" rel="noreferrer">
            {short(KEYSTORE)}
          </a>
        </p>

        <details className="x-record" id="keys" open={Boolean(revoked || error)}>
          <summary>
            Keys that can act right now <span className="x-chip__n">{liveRows.length}</span>
          </summary>
          <p className="x-ad-src">The policy is what this site granted. The KeyStore column is the registry, read live. They should agree.</p>
          {liveRows.length === 0 ? (
            <p className="x-muted">No live session on MANDATE's own account.</p>
          ) : (
            <div className="m-scroll">
              <table className="m-table">
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
                        <strong>{s.label}</strong>
                        <div className="m-mono m-note">{short(s.keyId, 12, 6)}</div>
                        {s.registrationTx ? (
                          <a className="m-link m-note" href={bscscanTx(s.registrationTx)} target="_blank" rel="noreferrer">
                            registered
                          </a>
                        ) : (
                          <span className="m-note">{s.registered ? "registered" : "not registered: enforced by the account, invisible to KeyStore readers"}</span>
                        )}
                      </td>
                      <td>
                        {s.allowlist.map((c) => (
                          <div key={c.to + c.signature} className="m-mono m-note">
                            {fn(c.signature)} on {target(c.to)}
                          </div>
                        ))}
                      </td>
                      <td className="m-note">{spendOf(s)}</td>
                      <td className="m-note">{when(s.expiry)}</td>
                      <td>
                        {m ? (
                          <>
                            <span className={VERDICT_TAG[m.verdict]}>{m.verdict}</span>
                            {m.registry?.expiry ? <div className="m-note">registry expiry {when(m.registry.expiry)}</div> : null}
                          </>
                        ) : (
                          <span className="m-tag m-tag--caution">unreadable</span>
                        )}
                      </td>
                      <td>
                        <form className="m-revoke" method="post" action="/api/desk/revoke">
                          <input type="hidden" name="id" value={s.id} />
                          <input className="m-input" type="password" name="token" placeholder="operator token" aria-label="Operator token" autoComplete="off" />
                          <button className="m-btn m-btn--sm" type="submit">
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
          <p className="x-ad-src">
            Revoking needs the operator token because it spends the account&rsquo;s gas. Nothing on this page can grant a key. Rebalancing keys are granted on{" "}
            <a className="x-link x-mono" href={`https://repo.sourcify.dev/56/${RECIPIENT_BOUND}`} target="_blank" rel="noreferrer">
              RecipientBound
            </a>{" "}
            and grid keys on{" "}
            <a className="x-link x-mono" href={`https://repo.sourcify.dev/56/${SWAP_BOUND}`} target="_blank" rel="noreferrer">
              SwapBound
            </a>
            , never on PancakeSwap directly: both write the principal as the recipient from immutable storage, so no key here can name where the money goes.
          </p>
        </details>

        <details className="x-record">
          <summary>KeyStore: keys this site does not hold</summary>
          {others === null ? (
            <p className="x-muted">The KeyStore did not answer, so this list is unknown rather than empty.</p>
          ) : unaccounted.length === 0 ? (
            <p className="x-ad-p">
              None. {admins.length ? `${admins.length} admin key${admins.length === 1 ? "" : "s"} (the account's own signer, no expiry). ` : ""}
              Every other valid key on the account is listed above.
            </p>
          ) : (
            <ul className="x-ad-p">
              {unaccounted.map((e) => (
                <li key={e.keyId} className="x-mono">
                  {short(e.keyId, 14, 6)} valid until {e.expiry ? when(e.expiry) : "no expiry"}
                </li>
              ))}
            </ul>
          )}
        </details>

        <details className="x-record" id="range-1-record">
          <summary>Range-1 used its key</summary>
          <p className="x-ad-src">An out-of-range position, recentered through RecipientBound. The NFTs never left the account.</p>
          {recenter ? (
            <dl className="x-kv">
              <div>
                <dt>Before</dt>
                <dd>
                  Position #{recenter.before.tokenId}, range [{recenter.before.range[0]}, {recenter.before.range[1]}), pool tick {recenter.before.tick}: out of range
                </dd>
              </div>
              <div>
                <dt>Withdraw</dt>
                <dd>
                  <a className="x-link x-mono" href={bscscanTx(recenter.txs.decreaseLiquidity)} target="_blank" rel="noreferrer">
                    {short(recenter.txs.decreaseLiquidity)}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Collect</dt>
                <dd>
                  <a className="x-link x-mono" href={bscscanTx(recenter.txs.collect)} target="_blank" rel="noreferrer">
                    {short(recenter.txs.collect)}
                  </a>{" "}
                  to the principal; RecipientBound&rsquo;s collect has no recipient argument
                </dd>
              </div>
              <div>
                <dt>Re-mint</dt>
                <dd>
                  <a className="x-link x-mono" href={bscscanTx(recenter.txs.mint)} target="_blank" rel="noreferrer">
                    {short(recenter.txs.mint)}
                  </a>{" "}
                  position #{recenter.after.tokenId}, range [{recenter.after.range[0]}, {recenter.after.range[1]}), tick {recenter.after.tick}:{" "}
                  {recenter.after.inRange ? "in range" : "out of range"}
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {recenter.sameOwnerThroughout ? "The same account before and after: " : "Owner changed: "}
                  <span className="x-mono">{short(recenter.after.owner)}</span>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="x-muted">Not run yet.</p>
          )}
        </details>

        <details className="x-record" id="grid-1-window">
          <summary>Grid-1&rsquo;s window</summary>
          <p className="x-ad-src">Read from SwapBound&rsquo;s own Swapped events. A simulated fill emits nothing, so none can appear here.</p>
          {grid ? (
            <>
              <dl className="x-perf">
                <div>
                  <dt>Fills</dt>
                  <dd className="x-mono">{grid.fills.length}</dd>
                </div>
                <div>
                  <dt>Win rate</dt>
                  <dd className="x-mono">{grid.winRate === null ? "No round trip yet" : `${Math.round(grid.winRate * 100)}% of ${grid.roundTrips.length}`}</dd>
                </div>
                <div className={grid.pnlUsd >= 0 ? "x-perf--up" : "x-perf--down"}>
                  <dt>Against doing nothing</dt>
                  <dd className="x-mono">
                    {grid.pnlUsd >= 0 ? "+" : "−"}${Math.abs(grid.pnlUsd).toFixed(4)}
                  </dd>
                </div>
                <div className={grid.maxDrawdownUsd > 0 ? "x-perf--down" : undefined}>
                  <dt>Worst drawdown</dt>
                  <dd className="x-mono">${grid.maxDrawdownUsd.toFixed(4)}</dd>
                </div>
              </dl>
              <p className="x-ad-src">
                {grid.window.start
                  ? `Window ${grid.window.start.slice(0, 16).replace("T", " ")} to ${grid.window.end?.slice(0, 16).replace("T", " ")} UTC (${(grid.window.hours ?? 0).toFixed(1)} h). `
                  : "No fill yet. "}
                Gas ${grid.gasUsd.toFixed(4)} at the chain&apos;s price, included. Read to block {grid.toBlock.toLocaleString("en-GB")}.
              </p>
              {grid.fills.length ? (
                <div className="m-scroll">
                  <table className="m-table">
                    <thead>
                      <tr>
                        <th>When (UTC)</th>
                        <th>Side</th>
                        <th className="m-num">USDT</th>
                        <th className="m-num">WBNB</th>
                        <th className="m-num">Price</th>
                        <th>Transaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grid.fills.map((f) => (
                        <tr key={f.tx}>
                          <td className="m-note">{f.at ? f.at.slice(0, 19).replace("T", " ") : `block ${f.block}`}</td>
                          <td>{f.side === "buy" ? "bought BNB" : "sold BNB"}</td>
                          <td className="m-num">{f.usdt.toFixed(4)}</td>
                          <td className="m-num">{f.wbnb.toFixed(6)}</td>
                          <td className="m-num">{f.price.toFixed(2)}</td>
                          <td>
                            <a className="m-link m-mono" href={bscscanTx(f.tx)} target="_blank" rel="noreferrer">
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
            <p className="x-muted">The window could not be read from the chain just now. That is our read failing, not a result.</p>
          )}
        </details>

        <details className="x-record" id="passkey">
          <summary>A passkey wallet, start to finish</summary>
          <p className="x-ad-src">Grant, act, revoke, on mainnet, with the KeyStore read at each step.</p>
          {passkey ? (
            <dl className="x-kv">
              <div>
                <dt>Wallet</dt>
                <dd>
                  <a className="x-link x-mono" href={bscscanAddress(passkey.wallet)} target="_blank" rel="noreferrer">
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
                      <a className="x-link x-mono" href={bscscanTx(h)} target="_blank" rel="noreferrer">
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
                    {v.adminValid === undefined || v.adminValid === null ? "" : `, admin key ${v.adminValid ? "valid" : "not valid"}`} at block{" "}
                    {v.block.toLocaleString("en-GB")}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Afterwards</dt>
                <dd>{passkey.discarded}</dd>
              </div>
            </dl>
          ) : (
            <p className="x-muted">Not run yet.</p>
          )}
        </details>

        <details className="x-record" id="stolen">
          <summary>If a key is stolen</summary>
          <p className="x-ad-src">What the thief gets, by key. Written against the allowlists above and the contracts behind them.</p>
          <div className="m-scroll">
            <table className="m-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>The thief can</th>
                  <th>The thief cannot</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rebalancing session</td>
                  <td>
                    Withdraw the principal&rsquo;s positions and re-mint them, up to RecipientBound&rsquo;s remaining caps, with everything landing back on the principal.
                    Spend a little of the account&rsquo;s BNB on gas.
                  </td>
                  <td>Send tokens or positions to any other address. Call the position manager directly. Approve anything. Act after expiry or revoke.</td>
                </tr>
                <tr>
                  <td>Grid session</td>
                  <td>
                    Trade USDT and WBNB in the one 0.05% pool, up to SwapBound&rsquo;s lifetime caps (3 USDT, 0.005 WBNB sold), at a price of their choosing above zero.
                    Bad trades can lose value up to those caps.
                  </td>
                  <td>Receive the proceeds, which go to the principal. Trade any other token or pool. Approve anything. Act after expiry or revoke.</td>
                </tr>
                <tr>
                  <td>Yield session</td>
                  <td>Move the principal&rsquo;s USDT or BNB into or out of Venus supply.</td>
                  <td>Send it anywhere else, borrow, or supply on another account&rsquo;s behalf.</td>
                </tr>
                <tr>
                  <td>Health-factor session</td>
                  <td>Repay the principal&rsquo;s own Venus debt and add collateral.</td>
                  <td>Borrow, withdraw collateral, or repay for someone else.</td>
                </tr>
                <tr>
                  <td>Operator token</td>
                  <td>Revoke sessions from this page, which stops agents working.</td>
                  <td>Grant a key, or move any funds.</td>
                </tr>
                <tr>
                  <td>Adjudicator key</td>
                  <td>Propose a false epoch result, which anyone can challenge with the observation inside the 300 second window.</td>
                  <td>Withdraw escrow, change parameters, or take the owner&rsquo;s role. It is a different key from the owner.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="x-ad-src">
            The same table, with the reasoning, is in <span className="x-mono">docs/threat-model.md</span>.{" "}
            <Link className="x-link" href="/status">
              Is the judge path up right now
            </Link>
          </p>
        </details>

        {pastRows.length ? (
          <details className="x-record">
            <summary>
              Keys that have ended <span className="x-chip__n">{pastRows.length}</span>
            </summary>
            <div className="m-scroll">
              <table className="m-table">
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
                        <strong>{s.label}</strong>
                        <div className="m-mono m-note">{short(s.keyId, 12, 6)}</div>
                      </td>
                      <td className="m-note">
                        {s.revokedAt ? `revoked ${s.revokedAt.slice(0, 16).replace("T", " ")} UTC` : `expired ${when(s.expiry)}`}
                        {s.revokeTx ? (
                          <>
                            {" "}
                            <a className="m-link m-mono" href={bscscanTx(s.revokeTx)} target="_blank" rel="noreferrer">
                              {short(s.revokeTx)}
                            </a>
                          </>
                        ) : null}
                        {s.revokedBecause ? <div>{s.revokedBecause}</div> : null}
                      </td>
                      <td>{m ? <span className={VERDICT_TAG[m.verdict]}>{m.verdict}</span> : <span className="m-tag m-tag--caution">unreadable</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </section>
    </AppShell>
  );
}
