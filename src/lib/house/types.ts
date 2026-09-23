import type { Abi, Address, Hex } from "viem";
import type { HouseRun } from "@/lib/house/runs";

/** One contract call an agent wants its session to make. */
export interface Call {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
}

/** A call that landed. */
export interface Sent {
  hash: Hex;
  blockNumber: bigint;
  logs: { address: string; topics: Hex[]; data: Hex }[];
}

/** A run as the agent reports it; the harness adds who, when and in which mode. */
export type RunRow = Omit<HouseRun, "id" | "at" | "slug" | "mode">;

export interface TurnContext {
  /** The account the agent acts on, and the only account its session can touch. */
  account: Address;
  live: boolean;
  now: number;
  /** Sends one call through the agent's own session and waits for it to land. Throws in a dry run. */
  send: (call: Call, description: string) => Promise<Sent>;
  /** Writes a row the moment a step of a multi-transaction action lands. */
  record: (row: RunRow) => Promise<void>;
  /** The newest run of this agent that carried state. */
  last: HouseRun | null;
  /** Live actions in the last 24 hours, for daily caps. */
  today: HouseRun[];
  /** No new transaction is started after this moment; the next run resumes. */
  stepDeadline: number;
}

export interface TurnResult extends RunRow {
  /** True when the turn already wrote its own rows, so the harness must not write another. */
  recorded?: boolean;
}
