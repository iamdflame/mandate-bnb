"use client";

/**
 * Wallet connection.
 *
 * Written against EIP-1193 directly rather than pulling in a connector kit.
 * The page needs one thing — an injected provider that can sign for this chain
 * — and a wallet library would add a few hundred kilobytes, a modal we would
 * then have to restyle, and a second source of truth about chain state.
 *
 * Everything here can be signing real BNB on BSC mainnet, so the flow is
 * deliberately explicit: never switch chains silently, never submit without
 * the amount having been shown, and always surface the transaction hash.
 */

import {
  createWalletClient,
  custom,
  formatEther,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { useCallback, useEffect, useState } from "react";
import { marketChain, marketClient, MARKET_ADDRESS } from "./market";
import { MANDATE_MARKET_ABI } from "./abi";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "failed";

export interface TxState {
  phase: TxPhase;
  hash?: Hash;
  error?: string;
}

export interface WalletState {
  address: Address | null;
  chainId: number | null;
  /** True when a provider exists at all. */
  available: boolean;
  /** True when connected and on the chain the market lives on. */
  ready: boolean;
  balanceWei: bigint | null;
}

const toHexChain = (id: number) => `0x${id.toString(16)}`;

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    available: false,
    ready: false,
    balanceWei: null,
  });

  const refresh = useCallback(async (address: Address | null) => {
    const provider = window.ethereum;
    if (!provider || !address) {
      setState((s) => ({ ...s, address: null, ready: false, balanceWei: null }));
      return;
    }
    const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
    const chainId = Number.parseInt(chainHex, 16);
    let balanceWei: bigint | null = null;
    try {
      balanceWei = await marketClient.getBalance({ address });
    } catch {
      balanceWei = null;
    }
    setState({
      address,
      chainId,
      available: true,
      ready: chainId === marketChain.id,
      balanceWei,
    });
  }, []);

  // Reflect an already-authorised wallet without prompting on page load.
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) {
      setState((s) => ({ ...s, available: false }));
      return;
    }
    setState((s) => ({ ...s, available: true }));

    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as Address[];
        if (list?.length) void refresh(list[0]);
      })
      .catch(() => undefined);

    const onAccounts = (accounts: unknown) => {
      const list = accounts as Address[];
      void refresh(list?.length ? list[0] : null);
    };
    const onChain = () => {
      setState((s) => {
        if (s.address) void refresh(s.address);
        return s;
      });
    };

    const p = provider as unknown as {
      on?: (e: string, h: (v: unknown) => void) => void;
      removeListener?: (e: string, h: (v: unknown) => void) => void;
    };
    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) throw new Error("No wallet found in this browser.");
    const accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as Address[];
    await refresh(accounts[0] ?? null);
  }, [refresh]);

  /** Asks the wallet to move to the market's chain, adding it if unknown. */
  const switchChain = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChain(marketChain.id) }],
      });
    } catch (error) {
      // 4902: the wallet does not know this chain yet.
      const code = (error as { code?: number }).code;
      if (code !== 4902) throw error;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: toHexChain(marketChain.id),
            chainName: marketChain.name,
            nativeCurrency: marketChain.nativeCurrency,
            rpcUrls: [marketChain.rpcUrls.default.http[0]],
            blockExplorerUrls: marketChain.blockExplorers?.default?.url
              ? [marketChain.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    }
    if (state.address) await refresh(state.address);
  }, [refresh, state.address]);

  return { ...state, connect, switchChain, refresh };
}

/**
 * Sends one write to the market and follows it to a receipt.
 *
 * Simulates first: a revert caught here costs nothing, while the same revert
 * caught on-chain costs gas and tells the user far less about why.
 */
export async function sendMarketTx(
  account: Address,
  functionName: string,
  args: unknown[],
  value?: bigint,
  onPhase?: (s: TxState) => void,
): Promise<Hash> {
  const provider = window.ethereum;
  if (!provider) throw new Error("No wallet found.");

  const wallet = createWalletClient({
    account,
    chain: marketChain,
    transport: custom(provider),
  });

  onPhase?.({ phase: "signing" });

  try {
    const { request } = await marketClient.simulateContract({
      address: MARKET_ADDRESS,
      abi: MANDATE_MARKET_ABI,
      functionName,
      args,
      value,
      account,
    } as never);

    const hash = await wallet.writeContract(request as never);
    onPhase?.({ phase: "pending", hash });

    const receipt = await marketClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      onPhase?.({ phase: "failed", hash, error: "The transaction reverted." });
      throw new Error("reverted");
    }
    onPhase?.({ phase: "confirmed", hash });
    return hash;
  } catch (error) {
    const message = readableError(error);
    onPhase?.({ phase: "failed", error: message });
    throw new Error(message);
  }
}

/** Turns a viem/provider error into something a person can act on. */
export function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (/User rejected|denied transaction|4001/i.test(raw)) {
    return "You rejected the request in your wallet.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Not enough BNB to cover the amount plus gas.";
  }
  // Custom errors from MandateMarket, mapped to what the user should do.
  const named: Record<string, string> = {
    BondTooSmall: "That bond is below the market minimum.",
    BadState: "This mandate is no longer accepting that action.",
    NoCapital: "A mandate needs capital to open.",
    BadParameters: "Those mandate terms are out of range.",
    NotPrincipal: "Only the principal who opened this mandate can award it.",
    MandateHeld: "That bond is currently at risk and cannot be withdrawn.",
    BidSpent: "That bid has already been promoted or withdrawn.",
    NothingToWithdraw: "There is nothing to withdraw.",
    EpochNotElapsed: "This epoch has not finished yet.",
  };
  for (const [key, message] of Object.entries(named)) {
    if (raw.includes(key)) return message;
  }

  const short = raw.split("\n")[0] ?? raw;
  return short.length > 160 ? `${short.slice(0, 157)}…` : short;
}

export const fmtBnb = (wei: bigint | null, dp = 3) =>
  wei === null ? "—" : Number(formatEther(wei)).toFixed(dp);
