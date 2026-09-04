/**
 * Agent standings, derived from chain history.
 *
 * The point of making an agent post a bond is that its record stops being a
 * story it tells. So the record here is not stored, reported or self-declared:
 * it is reconstructed from the contract's own logs — every award, every
 * settlement, every slash, every dismissal — and it cannot be edited by the
 * agent it describes.
 *
 * This is the half of the brief a directory cannot answer honestly. "See how
 * they have performed" means nothing when performance is a field an agent
 * writes for itself.
 */

import { parseAbiItem, type Address, type Log } from "viem";
import { marketClient, MARKET_ADDRESS } from "./market";

const AWARDED = parseAbiItem(
  "event MandateAwarded(uint256 indexed mandateId, address indexed agent, uint96 bond)",
);
const SETTLED = parseAbiItem(
  "event EpochSettled(uint256 indexed mandateId, uint32 indexed epoch, address indexed agent, int256 realizedAlphaBps, uint96 feePaid, uint96 slashed)",
);
const DISMISSED = parseAbiItem(
  "event AgentDismissed(uint256 indexed mandateId, address indexed agent, string reason)",
);

export interface Standing {
  agent: Address;
  /** Mandates ever awarded to this agent. */
  mandatesHeld: number;
  /** Epochs it has been settled over. */
  epochs: number;
  /** Sum of realized alpha in bps across every epoch it was responsible for. */
  totalAlphaBps: number;
  /** Mean alpha per epoch, in bps. The headline number. */
  meanAlphaBps: number;
  /** Epochs beating the benchmark. */
  wins: number;
  /** Fees earned, in wei. */
  feesWei: string;
  /** Own capital lost to slashing, in wei. This is the number that cannot be faked. */
  slashedWei: string;
  /** Times dismissed mid-mandate. */
  dismissals: number;
  /** Most recent reason it was dismissed, if ever. */
  lastDismissalReason: string | null;
}

type AnyLog = Log & {
  eventName?: "MandateAwarded" | "EpochSettled" | "AgentDismissed";
  args?: Record<string, unknown>;
};

/**
 * Reads the full log history in chunks.
 *
 * Providers cap `eth_getLogs` spans and the cap varies, so the range is walked
 * rather than requested whole. A chunk the provider refuses is skipped and
 * counted, and the result says whether coverage was complete — a partial read
 * must never be presented as a full record.
 */
async function collect(
  fromBlock: bigint,
  toBlock: bigint,
  span: bigint,
): Promise<{ logs: AnyLog[]; complete: boolean }> {
  const events = [AWARDED, SETTLED, DISMISSED];
  const out: AnyLog[] = [];
  let failures = 0;
  let cursor = fromBlock;

  while (cursor <= toBlock) {
    const end = cursor + span > toBlock ? toBlock : cursor + span;
    try {
      const batch = await marketClient.getLogs({
        address: MARKET_ADDRESS,
        events,
        fromBlock: cursor,
        toBlock: end,
      });
      out.push(...(batch as AnyLog[]));
    } catch {
      failures += 1;
    }
    cursor = end + 1n;
  }

  return { logs: out, complete: failures === 0 };
}

export interface StandingsResult {
  standings: Standing[];
  complete: boolean;
  fromBlock: string;
  toBlock: string;
}

export async function readStandings(
  opts: { lookback?: bigint; span?: bigint } = {},
): Promise<StandingsResult> {
  if (!MARKET_ADDRESS) {
    return { standings: [], complete: false, fromBlock: "0", toBlock: "0" };
  }

  const head = await marketClient.getBlockNumber();
  const lookback = opts.lookback ?? 500_000n;
  const from = head > lookback ? head - lookback : 0n;
  const { logs, complete } = await collect(from, head, opts.span ?? 9_000n);

  const byAgent = new Map<string, Standing>();
  const get = (agent: string): Standing => {
    const key = agent.toLowerCase();
    let s = byAgent.get(key);
    if (!s) {
      s = {
        agent: key as Address,
        mandatesHeld: 0,
        epochs: 0,
        totalAlphaBps: 0,
        meanAlphaBps: 0,
        wins: 0,
        feesWei: "0",
        slashedWei: "0",
        dismissals: 0,
        lastDismissalReason: null,
      };
      byAgent.set(key, s);
    }
    return s;
  };

  // Logs arrive ordered by block then index, so a later dismissal reason wins.
  for (const log of logs) {
    const args = log.args ?? {};
    const agent = args.agent as string | undefined;
    if (!agent) continue;
    const s = get(agent);

    if (log.eventName === "MandateAwarded") {
      s.mandatesHeld += 1;
    } else if (log.eventName === "EpochSettled") {
      const alpha = Number(args.realizedAlphaBps ?? 0n);
      s.epochs += 1;
      s.totalAlphaBps += alpha;
      if (alpha > 0) s.wins += 1;
      s.feesWei = (BigInt(s.feesWei) + BigInt((args.feePaid as bigint) ?? 0n)).toString();
      s.slashedWei = (
        BigInt(s.slashedWei) + BigInt((args.slashed as bigint) ?? 0n)
      ).toString();
    } else if (log.eventName === "AgentDismissed") {
      s.dismissals += 1;
      s.lastDismissalReason = (args.reason as string) ?? null;
    }
  }

  const standings = [...byAgent.values()].map((s) => ({
    ...s,
    meanAlphaBps: s.epochs > 0 ? Math.round(s.totalAlphaBps / s.epochs) : 0,
  }));

  // Ranked by mean alpha, but an agent with no settled epochs has no record
  // and sorts last rather than at zero alongside genuine break-even results.
  standings.sort((a, b) => {
    if (a.epochs === 0 && b.epochs > 0) return 1;
    if (b.epochs === 0 && a.epochs > 0) return -1;
    return b.meanAlphaBps - a.meanAlphaBps;
  });

  return {
    standings,
    complete,
    fromBlock: from.toString(),
    toBlock: head.toString(),
  };
}
