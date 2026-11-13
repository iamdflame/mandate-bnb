import type { Address } from "viem";
import { sendMarketTx } from "@/lib/chain/wallet";
import { COMMERCE_ABI, ESCROW } from "./contracts";

/**
 * Takes back the money of an escrowed job that passed its deadline
 * undelivered. The kernel pays it to the wallet that funded the job, whoever
 * sends this; the buyer sends it from the receipt or from their desk.
 */
export const claimEscrowRefund = (from: Address, jobId: string | bigint) =>
  sendMarketTx(from, "claimRefund", [BigInt(jobId)], undefined, undefined, { address: ESCROW.commerce, abi: COMMERCE_ABI });
