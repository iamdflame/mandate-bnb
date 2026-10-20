"use client";

import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";
import { useWallet } from "@/lib/chain/wallet";
import Agent from "@/components/characters/Agent";

/**
 * Signing up for a free liquidation alert: a wallet, the health factor that
 * should wake you, and a Telegram link whose Start button finishes it.
 *
 * Nothing is signed. The wallet's Venus position is public; the form shows it
 * as it stands now, so a person can see what they are asking us to watch.
 */
const LEVELS = [1.5, 1.3, 1.2, 1.1] as const;
const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

type Now = { words: string; state: string } | null;

export default function AlertSignup() {
  const { address } = useWallet();
  const [wallet, setWallet] = useState("");
  const [level, setLevel] = useState<number>(1.3);
  const [on, setOn] = useState<{ on: boolean; bot: string | null } | null>(null);
  const [now, setNow] = useState<Now>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/alerts", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setOn({ on: Boolean(j?.data?.on), bot: j?.data?.bot ?? null }))
      .catch(() => setOn({ on: false, bot: null }));
  }, []);

  // The connected wallet is the usual answer to "which wallet?".
  useEffect(() => {
    if (address && !wallet) setWallet(address);
  }, [address, wallet]);

  // What that wallet's loan looks like right now.
  useEffect(() => {
    setNow(null);
    setLink(null);
    if (!isAddress(wallet)) return;
    let gone = false;
    const t = setTimeout(() => {
      fetch(`/api/alerts?wallet=${wallet.trim()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => !gone && setNow(j?.data ? { words: j.data.words, state: j.data.state } : null))
        .catch(() => undefined);
    }, 300);
    return () => {
      gone = true;
      clearTimeout(t);
    };
  }, [wallet]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/alerts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: wallet.trim(), threshold: level }) });
      const j = await r.json();
      if (!r.ok || !j?.data?.link) throw new Error(j?.error ?? "The alert could not be set up just now.");
      setLink(j.data.link);
      window.open(j.data.link, "_blank", "noopener");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (on && !on.on) {
    return (
      <div className="k-panel k-panel--raised ac-al__card ac-al__card--off">
        <Agent job="health-factor" seed="alerts-off" size={96} state="dozing" slot="aloff" />
        <p className="k-h3">Alerts are being switched on.</p>
        <p className="k-small">Check back shortly. Until then you can read any wallet&apos;s Venus loan on the wallet check.</p>
        <a className="k-btn k-btn--sm" href="/diagnose">
          Check a wallet
        </a>
      </div>
    );
  }

  const low = Boolean(now && ["low", "danger", "liquidatable"].includes(now.state));
  // Where each level sits on a scale from 1.0 (liquidation) to 1.6.
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - 1) / 0.6) * 100))}%`;

  return (
    <div className="k-panel k-panel--raised ac-al__card">
      <label className="ac-al__field">
        <span className="k-label">Wallet to watch</span>
        <span className="k-field ac-al__input">
          <input className="k-mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} inputMode="text" />
        </span>
      </label>
      {isAddress(wallet) ? (
        <p className={`ac-al__now${low ? " ac-al__now--warn" : ""}`} role="status">
          <span className={`k-dot ${now ? (low ? "k-dot--warn" : "k-dot--ready") : "k-dot--live"}`} aria-hidden="true" />
          {now ? `Right now: ${now.words}.` : "Reading its Venus position…"}
        </p>
      ) : null}

      <fieldset className="ac-al__levels">
        <legend className="k-label">Wake me when its health factor falls below</legend>
        <div className="ac-al__gauge" aria-hidden="true">
          <span className="ac-al__track" />
          <span className="ac-al__liq" style={{ left: at(1) }}>
            <span>1.0 liquidation</span>
          </span>
          <span className="ac-al__pin" style={{ left: at(level) }} />
        </div>
        <div className="k-row ac-al__chips">
          {[...LEVELS].sort((a, b) => a - b).map((l) => (
            <button key={l} type="button" className="k-chip ac-al__chip" aria-pressed={level === l} onClick={() => setLevel(l)}>
              <span className="k-num">{l.toFixed(1)}</span>
            </button>
          ))}
        </div>
        <p className="k-small">Below 1.0 Venus can liquidate the loan. 1.3 leaves time to act; 1.1 is a last call.</p>
      </fieldset>

      <button type="button" className={`k-btn k-btn--primary k-btn--block k-btn--lg${busy ? " k-btn--busy" : ""}`} onClick={() => void start()} disabled={!isAddress(wallet) || busy || !on}>
        <Send size={16} aria-hidden="true" /> {busy ? "Making your link…" : "Get alerts on Telegram"}
      </button>
      {link ? (
        <p className="k-note k-note--ok ac-al__done" role="status">
          <Bell size={16} aria-hidden="true" />
          <span>
            Telegram should have opened. Press <strong>Start</strong> there to finish.{" "}
            <a className="k-link" href={link} target="_blank" rel="noreferrer">
              Open it again
            </a>
          </span>
        </p>
      ) : null}
      {error ? <p className="k-note k-note--err">{error}</p> : null}
      {on?.bot ? (
        <p className="k-small">
          Already in Telegram? Send <span className="k-mono">/watch 0x… 1.3</span> to{" "}
          <a className="k-link" href={`https://t.me/${on.bot}`} target="_blank" rel="noreferrer">
            @{on.bot}
          </a>
          .
        </p>
      ) : null}
    </div>
  );
}
