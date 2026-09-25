"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, parseAbi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { sendMarketTx, useWallet } from "@/lib/chain/wallet";

const ERC20 = parseAbi(["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)"]);

/*
  Every standing approval a hire on this site can leave behind, and nothing
  else. Paying in USD1 or $U per call signs a one-time transfer and approves
  nothing; paying in USDT approves Permit2 for exactly the price; an escrowed
  job approves the escrow contract for exactly its budget. Each is shown with
  what it still allows and revoked by you, from your wallet, in one step.
*/
const PAIRS: { token: Address; symbol: string; spender: Address; spenderName: string; why: string }[] = [
  {
    token: "0x55d398326f99059fF775485246999027B3197955",
    symbol: "USDT",
    spender: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    spenderName: "Permit2",
    why: "Left by paying for a call in USDT",
  },
  {
    token: "0xcE24439F2D9C6a2289F741120FE202248B666666",
    symbol: "$U",
    spender: "0xEa4DAa3100A767e86FDed867729ae7446476EBA6",
    spenderName: "ERC-8183 escrow",
    why: "Left by funding an escrowed job",
  },
];

interface Row {
  key: string;
  symbol: string;
  spenderName: string;
  why: string;
  token: Address;
  spender: Address;
  amount: bigint;
}

/** Standing approvals from the connected wallet, each with a revoke you sign. */
export default function YourApprovals() {
  const { address, ready } = useWallet();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const read = useCallback(async () => {
    if (!address) return;
    const found = await Promise.all(
      PAIRS.map(async (p) => {
        const amount = (await marketClient.readContract({ address: p.token, abi: ERC20, functionName: "allowance", args: [address, p.spender] }).catch(() => 0n)) as bigint;
        return { key: `${p.token}:${p.spender}`, symbol: p.symbol, spenderName: p.spenderName, why: p.why, token: p.token, spender: p.spender, amount };
      }),
    );
    setRows(found.filter((r) => r.amount > 0n));
  }, [address]);

  useEffect(() => {
    void read();
  }, [read]);

  const revoke = async (r: Row) => {
    if (!address) return;
    setBusy(r.key);
    setError(null);
    try {
      await sendMarketTx(address, "approve", [r.spender, 0n], undefined, undefined, { address: r.token, abi: ERC20 });
      await read();
    } catch (e) {
      setError((e as Error).message.slice(0, 160));
    } finally {
      setBusy(null);
    }
  };

  if (!address) {
    return <p className="x-muted">Connect a wallet to see any approval a hire here left on it, and to revoke it.</p>;
  }
  if (rows === null) return <p className="x-muted">Reading your approvals from the chain…</p>;
  return (
    <div className="x-approvals">
      {rows.length === 0 ? (
        <p className="x-approvals__none">No standing approvals. Nothing a hire here asked for can move your tokens.</p>
      ) : (
        <ul className="x-approvals__list">
          {rows.map((r) => (
            <li key={r.key} className="x-approval">
              <div>
                <p className="x-approval__t">
                  {r.spenderName} may move up to {formatUnits(r.amount, 18)} {r.symbol}
                </p>
                <p className="x-approval__why">{r.why}.</p>
              </div>
              <button type="button" className="x-btn x-btn--sm" onClick={() => revoke(r)} disabled={busy === r.key || !ready}>
                {busy === r.key ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="x-approvals__err">{error}</p> : null}
    </div>
  );
}
