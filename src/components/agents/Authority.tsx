"use client";

/**
 * What each agent may do, and the control that ends it.
 *
 * The interesting half of a permission set is what is missing from it, so the
 * withheld calls are rendered beside the granted ones with the reason each was
 * withheld. A list of what an agent *can* do reads as a capability boast; the
 * same list next to what it cannot reads as a bound.
 */

import { useCallback, useEffect, useState } from "react";
import { CATEGORY_LABEL, type Category } from "@/lib/config";

interface Session {
  mandateId: number;
  category: Category;
  sessionKey: string;
  walletAddress: string;
  capWei: string;
  expiry: number;
  expiresIn: number;
  registered: boolean;
  registrationTx: string | null;
  allowlist: { to: string; signature: string }[];
  withheld: { to: string; signature: string; because: string }[];
  provenProtocols: string[];
  scopeRationale: string | null;
  grantedAt: string;
  revokedAt: string | null;
}

const short = (a: string) => `${a.slice(0, 10)}…${a.slice(-6)}`;

const dur = (s: number) => {
  if (s <= 0) return "expired";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export default function Authority({ explorer }: { explorer: string }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [revocable, setRevocable] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sessions");
      const j = (await r.json()) as { sessions: Session[]; revocable: boolean };
      setSessions(j.sessions);
      setRevocable(j.revocable);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (mandateId: number) => {
    if (!confirm(`Revoke the session for mandate ${mandateId}? The agent stops being able to act at all.`)) {
      return;
    }
    setBusy(mandateId);
    setNote(null);
    try {
      const r = await fetch("/api/sessions/revoke", {
        method: "POST",
        headers: { "content-type": "application/json", "x-operator-token": token },
        body: JSON.stringify({ mandateId }),
      });
      const j = (await r.json()) as { ok: boolean; reason?: string; revokedAt?: string };
      setNote(
        j.ok
          ? `Mandate ${mandateId}: revoked at ${j.revokedAt}. The key is gone from the account.`
          : (j.reason ?? "Revocation failed."),
      );
      await load();
    } catch (e) {
      setNote(String(e).slice(0, 200));
    } finally {
      setBusy(null);
    }
  };

  if (sessions === null) return <p className="au-lede">Reading sessions…</p>;

  if (sessions.length === 0) {
    return (
      <p className="au-lede">
        No sessions have been granted. Every agent is observing only — it can
        read the chain and decide, and holds no key with which to act.
      </p>
    );
  }

  return (
    <>
      {sessions.map((s) => {
        const dead = Boolean(s.revokedAt) || s.expiresIn <= 0;
        return (
          <section key={s.mandateId} className={`auth ${dead ? "auth--dead" : ""}`}>
            <header className="auth-head">
              <div>
                <span className="au-label">
                  Mandate {s.mandateId} · {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
                <h3 className="auth-key">
                  <a href={`${explorer}/address/${s.walletAddress}`} rel="noreferrer">
                    {short(s.sessionKey)}
                  </a>
                </h3>
              </div>
              <span className={`op__badge ${dead ? "op__badge--dead" : ""}`}>
                {s.revokedAt ? "revoked" : s.expiresIn <= 0 ? "expired" : `live · ${dur(s.expiresIn)} left`}
              </span>
            </header>

            <dl className="career-totals">
              <div>
                <dt>Spend cap</dt>
                <dd>{(Number(s.capWei) / 1e18).toFixed(6)} BNB</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{dur(s.expiresIn)}</dd>
              </div>
              <div>
                <dt>KeyStore</dt>
                <dd>{s.registered ? "registered" : "ephemeral"}</dd>
              </div>
              <div>
                <dt>Calls granted</dt>
                <dd>
                  {s.allowlist.length}
                  {s.withheld.length ? ` of ${s.allowlist.length + s.withheld.length}` : ""}
                </dd>
              </div>
            </dl>

            {s.scopeRationale ? <p className="auth-rationale">{s.scopeRationale}</p> : null}

            <div className="auth-calls">
              <div>
                <span className="au-label">May call, and nothing else</span>
                <ul className="auth-list">
                  {s.allowlist.map((c, i) => (
                    <li key={i}>
                      <code>{short(c.to)}</code> {c.signature.split("(")[0]}
                    </li>
                  ))}
                </ul>
              </div>
              {s.withheld.length ? (
                <div>
                  <span className="au-label">Withheld — not proven</span>
                  <ul className="auth-list auth-list--withheld">
                    {s.withheld.map((c, i) => (
                      <li key={i}>
                        <code>{short(c.to)}</code> {c.signature.split("(")[0]}
                        <span className="auth-because">{c.because}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {s.registrationTx ? (
              <p className="au-foot">
                Authorised on chain:{" "}
                <a href={`${explorer}/tx/${s.registrationTx}`} rel="noreferrer">
                  {s.registrationTx.slice(0, 18)}…
                </a>
              </p>
            ) : null}

            {!dead ? (
              <div className="auth-actions">
                {revocable ? (
                  <>
                    <input
                      type="password"
                      className="auth-token"
                      placeholder="operator token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      aria-label="Operator token"
                    />
                    <button
                      className="auth-revoke"
                      onClick={() => revoke(s.mandateId)}
                      disabled={busy === s.mandateId}
                    >
                      {busy === s.mandateId ? "Revoking…" : "Revoke"}
                    </button>
                  </>
                ) : (
                  <p className="au-foot">
                    This deployment has no operator token configured, so the
                    button is not shown rather than shown broken. Revocation runs
                    from the operator&rsquo;s machine:{" "}
                    <code>npm run grant -- revoke {s.mandateId}</code>
                  </p>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
      {note ? <p className="auth-note">{note}</p> : null}
    </>
  );
}
