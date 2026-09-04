/**
 * BSC ground truth.
 *
 * Everything in ASSAY that is a claim comes from 8004scan. Everything that is
 * a fact comes from here.
 *
 * The load-bearing optimisation: a wallet with nonce 0 has never sent a
 * transaction, so it cannot have interacted with any protocol, ever. That
 * settles both the Activity and Capability assays in two cheap calls and
 * skips log scanning entirely. Measured against the registry, this short
 * circuit applies to essentially every agent on BSC.
 */

import {
  createPublicClient,
  fallback,
  http,
  getAddress,
  pad,
  type Address,
} from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { CHAIN_ID, IS_TESTNET, RPC_FALLBACKS, RPC_URL } from "@/lib/config";

export const publicClient = createPublicClient({
  chain: IS_TESTNET ? bscTestnet : bsc,
  transport: fallback(
    [RPC_URL, ...RPC_FALLBACKS].map((url) =>
      http(url, { timeout: 30_000, retryCount: 2, batch: { wait: 16 } }),
    ),
    { rank: false },
  ),
});

export const isAddress = (v: string | null | undefined): v is string =>
  typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

export const normalise = (v: string) => v.toLowerCase() as Address;

export interface WalletFacts {
  address: string;
  /** Number of transactions this wallet has ever *sent*. 0 means it has never acted. */
  nonce: number;
  /** Native BNB balance in wei. */
  balanceWei: bigint;
  /** True when the wallet has code — an agent whose "wallet" is a contract. */
  isContract: boolean;
  /** Cheap composite: a wallet that has never sent a tx and holds nothing. */
  isDormant: boolean;
}

/** Three calls, batched by the transport into one round trip where supported. */
export async function getWalletFacts(address: string): Promise<WalletFacts> {
  const addr = getAddress(address) as Address;
  const [nonce, balanceWei, code] = await Promise.all([
    publicClient.getTransactionCount({ address: addr }),
    publicClient.getBalance({ address: addr }),
    publicClient.getCode({ address: addr }),
  ]);
  const isContract = Boolean(code && code !== "0x");
  return {
    address: address.toLowerCase(),
    nonce,
    balanceWei,
    isContract,
    isDormant: nonce === 0 && balanceWei === 0n,
  };
}

/** The subset of an eth_getLogs entry this scan consumes. */
interface RawLog {
  address: string;
  transactionHash?: string;
  blockNumber?: string;
  logIndex?: string;
}

export interface ProtocolTouch {
  protocol: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
}

/**
 * Looks for evidence that `wallet` has interacted with any of `protocols`
 * within a recent window.
 *
 * Agent wallets appear in protocol logs as an indexed topic (recipient, owner,
 * sender), so we scan the protocol contracts for logs carrying the wallet's
 * padded address in topics 1-3 rather than scanning the wallet itself.
 *
 * On window size: no free BSC provider serves deep history. Measured, the
 * public nodes cap `eth_getLogs` at 50 blocks (1rpc), ~2,000 (publicnode),
 * and 10,000 (drpc); anything wider is refused as an archive request. So the
 * assay asks a question the free tier can actually answer, and one that is
 * arguably sharper: not "has this agent ever acted", but "has it acted
 * recently". Every one of these agents claims to run continuously. A
 * rebalancer that has not touched a position manager in the last ten thousand
 * blocks is not rebalancing anything.
 *
 * Setting ARCHIVE_RPC_URL to a provider with history widens the window to a
 * lifetime lookback automatically.
 */
export const ARCHIVE_RPC = process.env.ARCHIVE_RPC_URL ?? "";
export const hasArchive = Boolean(ARCHIVE_RPC);

/** Log-scanning client: the archive provider when configured, else drpc. */
const logClient = createPublicClient({
  chain: IS_TESTNET ? bscTestnet : bsc,
  transport: http(ARCHIVE_RPC || "https://bsc.drpc.org", {
    timeout: 30_000,
    retryCount: 1,
  }),
});

export async function findProtocolTouches(
  wallet: string,
  protocols: readonly string[],
  opts: { lookbackBlocks?: bigint; chunk?: bigint; maxHits?: number } = {},
): Promise<{ touches: ProtocolTouch[]; scannedBlocks: bigint; complete: boolean }> {
  // Free providers refuse anything wider than 10k blocks.
  const lookback = opts.lookbackBlocks ?? (hasArchive ? 2_000_000n : 9_500n);
  const chunk = opts.chunk ?? 9_500n;
  const maxHits = opts.maxHits ?? 12;

  const head = await publicClient.getBlockNumber();
  const floor = head > lookback ? head - lookback : 0n;
  const padded = pad(normalise(wallet), { size: 32 });
  const addresses = protocols.map((p) => normalise(p));

  const touches: ProtocolTouch[] = [];
  let to = head;
  let scanned = 0n;
  let failures = 0;

  while (to > floor && touches.length < maxHits) {
    const from = to - chunk > floor ? to - chunk : floor;
    // The wallet may occupy any indexed position, so probe each separately.
    for (const position of [1, 2, 3] as const) {
      if (touches.length >= maxHits) break;
      const topics: (string | null)[] = [null, null, null, null];
      topics[position] = padded;
      let logs: RawLog[] = [];
      try {
        // viem's typed getLogs models topics as an event-derived tuple, which
        // cannot express "any signature, this address in position N". The raw
        // RPC call can, so it is used directly.
        logs = (await logClient.request({
          method: "eth_getLogs",
          params: [
            {
              address: addresses,
              fromBlock: `0x${from.toString(16)}`,
              toBlock: `0x${to.toString(16)}`,
              topics,
            },
          ],
        } as never)) as unknown as RawLog[];
      } catch {
        // Provider refused the range, or a transient failure. Record it: a
        // failed scan is "unknown", never "no evidence".
        failures += 1;
        // Free endpoints refuse or time out on every wide range, so one
        // refusal settles it. Bail rather than retrying 150 doomed chunks.
        if (!hasArchive) {
          return { touches: dedupe(touches), scannedBlocks: scanned, complete: false };
        }
        continue;
      }
      for (const log of logs ?? []) {
        touches.push({
          protocol: String(log.address).toLowerCase(),
          txHash: log.transactionHash ?? "",
          blockNumber: Number(BigInt(log.blockNumber ?? "0x0")),
          logIndex: Number(BigInt(log.logIndex ?? "0x0")),
        });
      }
    }
    scanned += to - from;
    to = from;
  }

  return {
    touches: dedupe(touches),
    scannedBlocks: scanned,
    complete: to <= floor && failures === 0,
  };
}

const dedupe = (touches: ProtocolTouch[]) => {
  const seen = new Set<string>();
  return touches.filter((t) => {
    const key = `${t.txHash}:${t.logIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Funding-graph edge: who paid for this wallet's first breath.
 *
 * Sybil rings are usually funded from one purse. Establishing that two
 * reviewer wallets share a funder is far stronger evidence of coordination
 * than behavioural similarity alone. Public RPC cannot list inbound transfers
 * cheaply, so this is best-effort and its absence is never treated as
 * exculpatory.
 */
export async function getFirstFunder(address: string): Promise<string | null> {
  const facts = await getWalletFacts(address);
  if (facts.nonce === 0 && facts.balanceWei === 0n) return null;
  // Requires an indexed source (BscScan API) to do properly. The Sybil engine
  // treats a null here as "unknown", not "clean".
  return null;
}

export const bnb = (wei: bigint, dp = 4) => {
  const s = (Number(wei) / 1e18).toFixed(dp);
  return s.replace(/\.?0+$/, "") || "0";
};

export const CHAIN = CHAIN_ID;
