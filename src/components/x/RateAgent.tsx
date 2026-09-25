"use client";

import { useState } from "react";
import { zeroHash } from "viem";
import { Star } from "lucide-react";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";
import { RATING_TAG, REPUTATION_ABI, REPUTATION_REGISTRY } from "@/lib/chain/reputation-abi";
import { SITE } from "@/lib/site";

/**
 * Rating an agent after a hire, from your own wallet, on the ERC-8004
 * reputation registry.
 *
 * The rating is yours and on chain: it names the agent's id, a score out of a
 * hundred, the job it did as its first tag and this site as its second, and it
 * names the hire it follows: its feedbackHash is that hire's settlement
 * transaction. Nothing is written for you; the button asks your wallet to sign it.
 */
export default function RateAgent({ tokenId, name, category, hireTx }: { tokenId: string; name: string; category: string | null; hireTx: string | null }) {
  const { address, ready, connect, switchChain, available } = useWallet();
  const [stars, setStars] = useState(0);
  const [state, setState] = useState<{ at: "idle" | "signing" | "pending" | "done" | "failed"; hash?: string; error?: string }>({ at: "idle" });

  const rate = async () => {
    if (!address || !stars) return;
    setState({ at: "signing" });
    try {
      const hash = await sendMarketTx(
        address,
        "giveFeedback",
        [
          BigInt(tokenId),
          // A value out of 100 with no decimals, as the registry's existing records use.
          BigInt(stars * 20),
          0,
          category ?? "hire",
          RATING_TAG,
          // endpoint: none named; feedbackURI: the agent's page here, where the hire can be seen.
          "",
          `${SITE}/agents/${tokenId}`,
          // feedbackHash: the hire this rating follows, as its settlement transaction, so it can be matched to it.
          hireTx && /^0x[0-9a-fA-F]{64}$/.test(hireTx) ? (hireTx as `0x${string}`) : zeroHash,
        ],
        undefined,
        (s) => {
          if (s.phase === "pending" && s.hash) setState({ at: "pending", hash: s.hash });
        },
        { address: REPUTATION_REGISTRY, abi: REPUTATION_ABI },
      );
      setState({ at: "done", hash });
      // Filed with our tracking API, which reads the transaction back from the chain before keeping it.
      fetch("/api/v1/ratings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx: hash }) }).catch(() => undefined);
    } catch (e) {
      setState({ at: "failed", error: (e as Error).message.slice(0, 160) });
    }
  };

  if (state.at === "done" && state.hash) {
    return (
      <div className="x-rate x-rate--done" role="status">
        <p>
          Rated {stars} of 5, on chain.{" "}
          <a className="x-link x-mono" href={`https://bscscan.com/tx/${state.hash}`} target="_blank" rel="noreferrer">
            {state.hash.slice(0, 10)}…
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="x-rate">
      <p className="x-rate__q">How did {name} do?</p>
      <div className="x-rate__stars" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} of 5`}
            className={`x-rate__star${n <= stars ? " x-rate__star--on" : ""}`}
            onClick={() => setStars(n)}
          >
            <Star size={22} aria-hidden="true" />
          </button>
        ))}
      </div>
      {!available ? (
        <p className="x-rate__note">A wallet is needed to rate: the rating is written from it.</p>
      ) : !address ? (
        <button type="button" className="x-btn x-btn--block" onClick={connect}>
          Connect a wallet to rate
        </button>
      ) : !ready ? (
        <button type="button" className="x-btn x-btn--block" onClick={switchChain}>
          Switch to BNB Smart Chain
        </button>
      ) : (
        <button type="button" className="x-btn x-btn--block" onClick={rate} disabled={!stars || state.at === "signing" || state.at === "pending"}>
          {state.at === "signing" ? "Sign in your wallet…" : state.at === "pending" ? "Writing it on chain…" : "Rate it on chain"}
        </button>
      )}
      {state.at === "failed" ? <p className="x-rate__err">{state.error}</p> : null}
      <p className="x-rate__note">Written to the ERC-8004 reputation registry from your wallet. It costs a little gas.</p>
    </div>
  );
}
