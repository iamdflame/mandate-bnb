"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseAbi, parseEventLogs, type Address } from "viem";
import { Check } from "lucide-react";
import { IDENTITY_REGISTRY } from "@/lib/config";
import { marketClient } from "@/lib/chain/market";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";
import OpenInWallet from "./OpenInWallet";

const REGISTRY_ABI = parseAbi([
  "function register(string tokenURI) returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

const JOBS = [
  ["rebalancing", "Rebalancing"],
  ["grid-trading", "Grid Trading"],
  ["yield-optimisation", "Yield Optimisation"],
  ["health-factor", "Health Factor Monitoring"],
] as const;

const httpsUrl = (s: string) => /^https:\/\/[^\s]+$/i.test(s.trim());

/** The card as ERC-8004's registration-v1 has it, with only the fields the builder filled in. */
function cardOf(f: { name: string; description: string; category: string; x402: string; mcp: string; web: string; image: string }) {
  const services = [
    f.x402.trim() ? { name: "x402", endpoint: f.x402.trim() } : null,
    f.mcp.trim() ? { name: "MCP", endpoint: f.mcp.trim() } : null,
    f.web.trim() ? { name: "web", endpoint: f.web.trim() } : null,
  ].filter(Boolean);
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: f.name.trim(),
    description: f.description.trim(),
    category: f.category,
    ...(f.image.trim() ? { image: f.image.trim() } : {}),
    services,
    x402Support: Boolean(f.x402.trim()),
    active: true,
    supportedTrust: ["reputation"],
  };
}

/** UTF-8 safe base64, for a data URI the registry stores as the card itself. */
const toDataUri = (json: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `data:application/json;base64,${btoa(bin)}`;
};

/**
 * Registering an agent on the ERC-8004 identity registry from the builder's
 * own wallet. Either the card is written on chain as a data URI (no hosting
 * needed), or the registry points at a card the builder already serves. The
 * token is the builder's; MANDATE only reads it.
 */
export default function CreateAgent() {
  const { address, ready, available, connect, switchChain } = useWallet();
  const [mode, setMode] = useState<"card" | "url">("card");
  const [f, setF] = useState({ name: "", description: "", category: "rebalancing", x402: "", mcp: "", web: "", image: "", cardUrl: "" });
  const [state, setState] = useState<{ at: "idle" | "signing" | "pending" | "done" | "failed"; hash?: string; tokenId?: string; error?: string }>({ at: "idle" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const card = useMemo(() => cardOf(f), [f]);
  const uri = mode === "url" ? f.cardUrl.trim() : toDataUri(card);
  const problems = useMemo(() => {
    if (mode === "url") return httpsUrl(f.cardUrl) ? [] : ["Give the https address your card is served at."];
    const p: string[] = [];
    if (f.name.trim().length < 3) p.push("Give it a name.");
    if (f.description.trim().length < 20) p.push("Say what one call returns, in a sentence or two.");
    if (!f.x402.trim() && !f.mcp.trim()) p.push("Give at least one endpoint: x402 to be hireable, or MCP.");
    const label = { x402: "x402", mcp: "MCP", web: "website", image: "image" } as const;
    for (const k of ["x402", "mcp", "web", "image"] as const) if (f[k].trim() && !httpsUrl(f[k])) p.push(`The ${label[k]} address must start with https://`);
    return p;
  }, [f, mode]);

  const register = async () => {
    if (!address) return;
    setState({ at: "signing" });
    try {
      const hash = await sendMarketTx(address, "register", [uri], undefined, (s) => {
        if (s.phase === "pending" && s.hash) setState({ at: "pending", hash: s.hash });
      }, { address: IDENTITY_REGISTRY as Address, abi: REGISTRY_ABI });
      const receipt = await marketClient.getTransactionReceipt({ hash });
      const mint = parseEventLogs({ abi: REGISTRY_ABI, eventName: "Transfer", logs: receipt.logs }).find(
        (l) => l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() && /^0x0+$/.test(l.args.from),
      );
      setState({ at: "done", hash, tokenId: mint ? mint.args.tokenId.toString() : undefined });
    } catch (e) {
      setState({ at: "failed", error: (e as Error).message.slice(0, 200) });
    }
  };

  if (state.at === "done") {
    return (
      <div className="x-create x-create--done" role="status">
        <p className="x-create__ok">
          <Check size={18} aria-hidden="true" /> Registered{state.tokenId ? ` as agent #${state.tokenId}` : ""}.
        </p>
        <p>
          <a className="x-link x-mono" href={`https://bscscan.com/tx/${state.hash}`} target="_blank" rel="noreferrer">
            {state.hash?.slice(0, 12)}…
          </a>{" "}
          on BscScan.
        </p>
        {state.tokenId ? (
          <Link className="x-btn x-btn--primary" href={`/list?id=${state.tokenId}`}>
            See where it stands on MANDATE
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="x-create">
      <div className="x-create__mode" role="tablist" aria-label="How to give its card">
        <button type="button" role="tab" aria-selected={mode === "card"} className={`x-chip${mode === "card" ? " x-chip--on" : ""}`} onClick={() => setMode("card")}>
          Fill in its card here
        </button>
        <button type="button" role="tab" aria-selected={mode === "url"} className={`x-chip${mode === "url" ? " x-chip--on" : ""}`} onClick={() => setMode("url")}>
          I already serve a card
        </button>
      </div>

      {mode === "url" ? (
        <label className="x-create__f">
          <span>Card address</span>
          <input value={f.cardUrl} onChange={set("cardUrl")} placeholder="https://my-agent.vercel.app/api/card" inputMode="url" autoComplete="off" />
          <small>The starter template serves its card at /api/card.</small>
        </label>
      ) : (
        <>
          <label className="x-create__f">
            <span>Name</span>
            <input value={f.name} onChange={set("name")} placeholder="Venus Guard" maxLength={60} />
          </label>
          <label className="x-create__f">
            <span>What one call returns</span>
            <textarea value={f.description} onChange={set("description")} placeholder="Reads a Venus account's health factor and says how far it is from liquidation." rows={3} maxLength={400} />
          </label>
          <label className="x-create__f">
            <span>Job</span>
            <select value={f.category} onChange={set("category")}>
              {JOBS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
            <small>We file it by what its card says it does. Pick the closest job and describe it plainly.</small>
          </label>
          <label className="x-create__f">
            <span>x402 endpoint, to be hireable</span>
            <input value={f.x402} onChange={set("x402")} placeholder="https://my-agent.vercel.app/api/agent" inputMode="url" autoComplete="off" />
          </label>
          <label className="x-create__f">
            <span>MCP endpoint (optional)</span>
            <input value={f.mcp} onChange={set("mcp")} placeholder="https://my-agent.example/mcp" inputMode="url" autoComplete="off" />
          </label>
          <label className="x-create__f">
            <span>Website (optional)</span>
            <input value={f.web} onChange={set("web")} placeholder="https://my-agent.example" inputMode="url" autoComplete="off" />
          </label>
          <label className="x-create__f">
            <span>Image (optional)</span>
            <input value={f.image} onChange={set("image")} placeholder="https://…/avatar.png" inputMode="url" autoComplete="off" />
          </label>
          <details className="x-create__preview">
            <summary>The card that will be written on chain</summary>
            <pre className="x-pre x-mono">{JSON.stringify(card, null, 2)}</pre>
          </details>
        </>
      )}

      {problems.length ? (
        <ul className="x-create__problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      {!available ? (
        <OpenInWallet />
      ) : !address ? (
        <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={connect}>
          Connect a wallet to register
        </button>
      ) : !ready ? (
        <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={switchChain}>
          Switch to BNB Smart Chain
        </button>
      ) : (
        <button type="button" className="x-btn x-btn--primary x-btn--block" onClick={register} disabled={problems.length > 0 || state.at === "signing" || state.at === "pending"}>
          {state.at === "signing" ? "Sign in your wallet…" : state.at === "pending" ? "Registering on chain…" : "Register it from my wallet"}
        </button>
      )}
      {state.at === "failed" ? <p className="x-create__err">{state.error}</p> : null}
      <p className="x-create__note">One transaction on the ERC-8004 identity registry, a few cents of BNB. The agent is yours: its token is minted to this wallet.</p>
    </div>
  );
}
