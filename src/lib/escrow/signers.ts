/**
 * Who may sign an agent's escrow quote: the wallets its ERC-8004 registration
 * names. Its owner, the agentWallet its card states, and the agentWallet the
 * registry holds on chain (getAgentWallet), which is the one BNB's agent SDK
 * checks a quote against. That last one was missing until 19 Oct: Brain on
 * BNB moved its grid planner (#302258) to a new owner and kept signing with
 * the agent wallet the registry still names, and we refused a quote the SDK
 * itself would accept.
 */

import { parseAbi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { IDENTITY_REGISTRY } from "@/lib/config";

const REGISTRY = parseAbi(["function getAgentWallet(uint256) view returns (address)"]);
const ZERO = /^0x0{40}$/i;

/** Pure: the wallets named, without blanks or repeats. */
export function namedWallets(...wallets: (string | null | undefined)[]): string[] {
  const out = new Map<string, string>();
  for (const w of wallets) if (typeof w === "string" && /^0x[0-9a-fA-F]{40}$/.test(w) && !ZERO.test(w)) out.set(w.toLowerCase(), w);
  return [...out.values()];
}

export async function quoteSigners(tokenId: string, entry: { owner?: string | null; card?: { agentWallet?: unknown } | null } | null | undefined): Promise<string[]> {
  const onChain = await marketClient
    .readContract({ address: IDENTITY_REGISTRY as Address, abi: REGISTRY, functionName: "getAgentWallet", args: [BigInt(tokenId)] })
    .catch(() => null);
  return namedWallets(entry?.owner, typeof entry?.card?.agentWallet === "string" ? entry.card.agentWallet : null, onChain as string | null);
}
