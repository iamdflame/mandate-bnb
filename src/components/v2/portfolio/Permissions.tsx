"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/chain/wallet";
import None, { Reading } from "@/components/account/None";

/**
 * What an agent is allowed to do with a wallet, and the button that stops it.
 *
 * A session key is the part of this that a person most needs to see and least
 * wants to read about, so the panel leads with the two facts that matter, how
 * much it can spend and when it dies, and only then lists the calls.
 *
 * The `withheld` list is the interesting half and it is deliberately shown.
 * The allowlist is the intersection of what the category permits with what the
 * agent has actually been observed doing on chain, so a call the category
 * allows and the agent has never made is absent. Showing what was taken away
 * is how a person sees that narrowing happened rather than taking it on trust.
 *
 * Where revocation cannot be performed from this deployment, the control says
 * so in a sentence instead of failing when pressed. A dead button that throws
 * a 502 is worse than a disabled one that explains itself.
 */

interface Session {
  mandateId: number;
  category: string;
  sessionKey: string;
  walletAddress: string;
  capWei: string;
  expiry: number;
  expiresIn: number;
  registered: boolean;
  registrationTx: string | null;
  allowlist: { to: string; signature: string }[];
  withheld: { to: string; signature: string; because?: string }[];
  scopeRationale: string | null;
  revokedAt: string | null;
  market: string | null;
}

const bnb = (wei: string) => `${(Number(BigInt(wei)) / 1e18).toFixed(5)} BNB`;
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/** `embedded`: the page around it already has the heading, so it shows only the list. */
export default function Permissions({ embedded = false }: { embedded?: boolean }) {
  const { address } = useWallet();
  const [all, setAll] = useState<Session[] | null>(null);
  const [revocable, setRevocable] = useState(false);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((b: { sessions?: Session[]; revocable?: boolean }) => {
        setAll(b.sessions ?? []);
        setRevocable(Boolean(b.revocable));
      })
      .catch(() => setAll([]));
  }, []);

  // Never blank while it reads: a section with nothing under it reads as broken.
  if (!all) return <Reading label="Reading what agents may do on this wallet…" rows={1} />;

  const mine = address
    ? all.filter((s) => s.walletAddress.toLowerCase() === address.toLowerCase())
    : [];
  const now = Math.floor(Date.now() / 1000);

  return (
    <section className="ac-perms">
      {embedded ? null : (
        <div className="ac-sec__h">
          <div>
            <h2 className="k-h2">What your agents are allowed to do</h2>
            <p className="k-body">A session key lets an agent act without holding your keys. It can only call what is listed, only up to a cap, and only until it expires.</p>
          </div>
        </div>
      )}

      {mine.length === 0 ? (
        <None job="grid-trading" seed="desk-perms" pose="ready">
          <p className="ac-none__claim">No agent holds a permission over this wallet.</p>
          <p className="k-small">
            Nothing can act on your behalf right now. A permission is granted only when you award a job to an agent, and it is scoped to that job: a spend cap, an expiry, and a fixed list of calls it may make.
            {all.length ? ` ${all.length} ${all.length === 1 ? "permission has" : "permissions have"} been granted on this market by other wallets, all of them ${all.every((s) => s.expiry < now) ? "now expired" : "listed publicly"}.` : ""}
          </p>
        </None>
      ) : (
        <div className="ac-perms__list">
          {mine.map((s) => {
            const expired = s.expiry < now;
            const dead = expired || Boolean(s.revokedAt);
            return (
              <article className="ac-perm" key={s.sessionKey} data-dead={dead ? "1" : undefined}>
                <header className="ac-perm__head">
                  <div>
                    <h3 className="k-h3">
                      Job #{s.mandateId}, {s.category}
                    </h3>
                    <p className="k-small k-mono">{short(s.sessionKey)}</p>
                  </div>
                  <span className={`k-tag${dead ? "" : " k-tag--ours"}`}>{s.revokedAt ? "Revoked" : expired ? "Expired" : "Active"}</span>
                </header>

                <dl className="ac-perm__facts">
                  <div>
                    <dt>The most it can spend</dt>
                    <dd className="k-num">{bnb(s.capWei)}</dd>
                  </div>
                  <div>
                    <dt>{expired ? "Expired" : "Expires"}</dt>
                    <dd className="k-num">{new Date(s.expiry * 1000).toUTCString()}</dd>
                  </div>
                  <div>
                    <dt>Calls it may make</dt>
                    <dd className="k-num">{s.allowlist.length}</dd>
                  </div>
                  <div>
                    <dt>Calls withheld from it</dt>
                    <dd className="k-num">{s.withheld.length}</dd>
                  </div>
                </dl>

                <details className="ac-more ac-more--sm">
                  <summary>
                    <span className="ac-more__t">Exactly what it may and may not call</span>
                  </summary>
                  <div className="ac-more__body">
                    <p className="k-label">Allowed</p>
                    <ul className="ac-calls">
                      {s.allowlist.map((c) => (
                        <li key={`${c.to}${c.signature}`}>
                          <span className="k-mono">{c.signature}</span>
                          <span className="k-small k-mono">on {short(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                    {s.withheld.length ? (
                      <>
                        <p className="k-label">Withheld, and why</p>
                        <ul className="ac-calls ac-calls--off">
                          {s.withheld.map((c) => (
                            <li key={`${c.to}${c.signature}`}>
                              <span className="k-mono">{c.signature}</span>
                              <span className="k-small">{c.because ?? "never observed on chain"}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {s.scopeRationale ? <p className="k-small">{s.scopeRationale}</p> : null}
                  </div>
                </details>

                <div className="ac-perm__act">
                  {dead ? (
                    <p className="k-small">This permission is {s.revokedAt ? "revoked" : "expired"} and can no longer be used by anyone. Nothing further is needed from you.</p>
                  ) : revocable ? (
                    <RevokeButton mandateId={s.mandateId} />
                  ) : (
                    <p className="k-small">
                      Revocation for this permission runs through the operator that granted it, and that signer is not held by this deployment, so the button would fail if it were here. It is being said rather than shown.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RevokeButton({ mandateId }: { mandateId: number }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [why, setWhy] = useState<string | null>(null);

  const revoke = async () => {
    setState("working");
    try {
      const res = await fetch("/api/sessions/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mandateId }),
      });
      const body = (await res.json()) as { reason?: string; error?: string };
      if (!res.ok) throw new Error(body.reason ?? body.error ?? `The revoke service answered ${res.status}.`);
      setState("done");
    } catch (e) {
      setWhy(e instanceof Error ? e.message : "Revocation failed.");
      setState("error");
    }
  };

  if (state === "done") {
    return <p className="k-note k-note--ok">Revoked. This agent can no longer act on your behalf.</p>;
  }

  return (
    <>
      <p className="k-small">Revoking takes effect immediately and cannot be undone. The job continues; the agent simply loses the ability to act through this key.</p>
      <button className={`k-btn k-btn--danger k-btn--sm${state === "working" ? " k-btn--busy" : ""}`} type="button" disabled={state === "working"} onClick={() => void revoke()}>
        {state === "working" ? "Revoking…" : "Revoke this permission"}
      </button>
      {why ? <p className="k-note k-note--err">{why}</p> : null}
    </>
  );
}
