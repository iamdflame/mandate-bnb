/**
 * Client for MandateMarket.
 *
 * The floor reads from here. Every figure it renders is a contract call or a
 * log — nothing on the floor is a number this codebase made up.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  formatEther,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc, bscTestnet, foundry } from "viem/chains";
import { MANDATE_MARKET_ABI } from "./abi";

export const MARKET_ADDRESS = (process.env.NEXT_PUBLIC_MARKET_ADDRESS ??
  process.env.MARKET_ADDRESS ??
  "") as Address;

const MARKET_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_MARKET_CHAIN_ID ?? process.env.MARKET_CHAIN_ID ?? 31337,
);

const MARKET_RPC =
  process.env.NEXT_PUBLIC_MARKET_RPC_URL ??
  process.env.MARKET_RPC_URL ??
  "http://127.0.0.1:8545";

export const marketChain =
  MARKET_CHAIN_ID === 56 ? bsc : MARKET_CHAIN_ID === 97 ? bscTestnet : foundry;

export const marketClient: PublicClient = createPublicClient({
  chain: marketChain,
  transport: MARKET_RPC.startsWith("ws")
    ? fallback([webSocket(MARKET_RPC), http()])
    : http(MARKET_RPC, { timeout: 20_000 }),
});

export function walletFor(privateKey: Hex) {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: marketChain,
    transport: http(MARKET_RPC),
  });
}

export const CATEGORY_NAMES = [
  "Rebalancing",
  "Grid Trading",
  "Yield Optimisation",
  "Health Factor",
] as const;

export const STATE_NAMES = ["Open", "Active", "Closed", "Abandoned"] as const;

export interface MandateView {
  id: number;
  principal: Address;
  capital: bigint;
  agent: Address;
  bond: bigint;
  category: number;
  state: number;
  toleranceBps: number;
  feeBps: number;
  slashBps: number;
  epochLength: number;
  epochsTotal: number;
  epochsSettled: number;
  lastSettledAt: number;
  cumulativeAlphaBps: bigint;
  strikes: number;
}

export interface BidView {
  agent: Address;
  bond: bigint;
  targetAlphaBps: number;
  spent: boolean;
}

const ZERO = "0x0000000000000000000000000000000000000000";

export const isZero = (a: string | undefined | null) =>
  !a || a.toLowerCase() === ZERO;

export async function readMandateCount(): Promise<number> {
  if (!MARKET_ADDRESS) return 0;
  const n = await marketClient.readContract({
    address: MARKET_ADDRESS,
    abi: MANDATE_MARKET_ABI,
    functionName: "mandateCount",
  });
  return Number(n);
}

export async function readMandate(id: number): Promise<MandateView> {
  const m = (await marketClient.readContract({
    address: MARKET_ADDRESS,
    abi: MANDATE_MARKET_ABI,
    functionName: "getMandate",
    args: [BigInt(id)],
  })) as Record<string, unknown>;

  return {
    id,
    principal: m.principal as Address,
    capital: m.capital as bigint,
    agent: m.agent as Address,
    bond: m.bond as bigint,
    category: Number(m.category),
    state: Number(m.state),
    toleranceBps: Number(m.toleranceBps),
    feeBps: Number(m.feeBps),
    slashBps: Number(m.slashBps),
    epochLength: Number(m.epochLength),
    epochsTotal: Number(m.epochsTotal),
    epochsSettled: Number(m.epochsSettled),
    lastSettledAt: Number(m.lastSettledAt),
    cumulativeAlphaBps: m.cumulativeAlphaBps as bigint,
    strikes: Number(m.strikes),
  };
}

export async function readBids(id: number): Promise<BidView[]> {
  const bids = (await marketClient.readContract({
    address: MARKET_ADDRESS,
    abi: MANDATE_MARKET_ABI,
    functionName: "getBids",
    args: [BigInt(id)],
  })) as readonly Record<string, unknown>[];

  return bids.map((b) => ({
    agent: b.agent as Address,
    bond: b.bond as bigint,
    targetAlphaBps: Number(b.targetAlphaBps),
    spent: Boolean(b.spent),
  }));
}

export async function readAllMandates(): Promise<MandateView[]> {
  const count = await readMandateCount();
  if (count === 0) return [];
  return Promise.all(Array.from({ length: count }, (_, i) => readMandate(i)));
}

/** Formats wei as BNB with a fixed number of places, for a ledger column. */
export const bnb = (wei: bigint, dp = 3) => Number(formatEther(wei)).toFixed(dp);

export const bps = (v: number | bigint) => {
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${(n / 100).toFixed(2)}%`;
};

export const shortAddr = (a: string) =>
  a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export { MANDATE_MARKET_ABI };
