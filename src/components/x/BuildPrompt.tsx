"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { buildPrompt, openIn, type BuildNetwork } from "@/lib/build/prompt";
import { useWallet } from "@/lib/chain/wallet";

/**
 * Build it with your own AI assistant: choose the job and the network, and
 * get a prompt that hands Claude, ChatGPT or Cursor everything BNB Chain's six
 * checks need, with the connected wallet as the agent's owner. Copy it, or
 * open a chat that reads it from its link.
 */
export default function BuildPrompt() {
  const { address } = useWallet();
  const [job, setJob] = useState<Category>("health-factor");
  const [network, setNetwork] = useState<BuildNetwork>("mainnet");
  const [wallet, setWallet] = useState("");
  const [idea, setIdea] = useState("");
  const [copied, setCopied] = useState(false);

  // The connected wallet is the likely campaign wallet; the builder can change it.
  useEffect(() => {
    if (address && !wallet) setWallet(address);
  }, [address, wallet]);

  const input = { job, network, wallet: wallet.trim() || null, idea: idea.trim() || null };
  const prompt = useMemo(() => buildPrompt(input), [job, network, wallet, idea]); // eslint-disable-line react-hooks/exhaustive-deps
  const links = useMemo(() => openIn(input), [job, network, wallet, idea]); // eslint-disable-line react-hooks/exhaustive-deps
  const badWallet = wallet.trim() !== "" && !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* The prompt is on screen to select. */
    }
  };

  return (
    <section className="bd-prompt" aria-labelledby="h-prompt" id="prompt">
      <div className="bd-prompt__head">
        <h2 id="h-prompt" className="k-h2">
          Or build it with your AI assistant
        </h2>
        <p className="k-body">
          Choose the job and the network, and paste this into Claude, ChatGPT, Cursor or Claude Code. It carries BNB Chain&apos;s six checks, BNB&apos;s agent SDK, the onchain work that
          counts for the job, the contracts and the test-token faucets. It never asks for your wallet&apos;s key.
        </p>
      </div>
      <div className="bd-prompt__grid">
        <div className="bd-prompt__form">
          <label className="bd-f">
            <span>Job</span>
            <select value={job} onChange={(e) => setJob(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="bd-f bd-f--set">
            <legend>Network</legend>
            <label className="bd-radio">
              <input type="radio" name="network" checked={network === "mainnet"} onChange={() => setNetwork("mainnet")} />
              <span className="bd-radio__t">Mainnet</span>
              <span className="bd-radio__d">MANDATE checks all six for you</span>
            </label>
            <label className="bd-radio">
              <input type="radio" name="network" checked={network === "testnet"} onChange={() => setNetwork("testnet")} />
              <span className="bd-radio__t">Testnet</span>
              <span className="bd-radio__d">Free test tokens, you check it yourself</span>
            </label>
          </fieldset>
          <label className="bd-f">
            <span>Your campaign wallet (optional)</span>
            <input className="k-mono" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="0x…" spellCheck={false} />
            {badWallet ? <small className="bd-f__err">That is not a wallet address; the prompt will ask you for it instead.</small> : null}
          </label>
          <label className="bd-f">
            <span>What should it do? (optional)</span>
            <input value={idea} maxLength={400} onChange={(e) => setIdea(e.target.value)} placeholder="Leave empty and your assistant will propose something" />
          </label>
        </div>
        <div className="bd-prompt__out">
          <div className="bd-prompt__bar" aria-hidden="true">
            <span />
            <span />
            <span />
            <em>prompt.md</em>
          </div>
          <textarea className="bd-prompt__text k-mono" readOnly value={prompt} rows={12} aria-label="The prompt" />
          <div className="bd-prompt__acts">
            <button type="button" className="k-btn k-btn--primary" onClick={() => void copy()}>
              <Copy size={15} aria-hidden="true" /> {copied ? "Copied" : "Copy the prompt"}
            </button>
            <a className="k-btn" href={links.claude} target="_blank" rel="noreferrer">
              Open in Claude
            </a>
            <a className="k-btn" href={links.chatgpt} target="_blank" rel="noreferrer">
              Open in ChatGPT
            </a>
          </div>
          <p className="k-small">
            The open links ask the assistant to read this prompt from its link; one that cannot open links asks you to paste it. Using Claude Code or Cursor? Add MANDATE&apos;s MCP server (
            <span className="k-mono">/api/mcp</span>) and ask for <span className="k-mono">build_prompt</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
