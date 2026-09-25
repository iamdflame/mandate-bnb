/**
 * The shape every tracking endpoint shares: a checked address in, the chain's
 * head block and the time out, alongside the answer.
 */

import { isAddress } from "viem";
import { CHAIN_ID } from "@/lib/config";
import { fail, gate, ok } from "@/lib/api/respond";
import { marketClient } from "@/lib/chain/market";
import { live } from "@/lib/data/live";
import { withTimeout } from "@/lib/cache";

const LIMIT = { capacity: 60, windowMs: 60_000 };

export async function trackingAnswer<T>(request: Request, address: string, read: (wallet: string) => Promise<T>) {
  const g = gate(request, LIMIT, CHAIN_ID);
  if (!g.allowed) return g.response;
  const wallet = decodeURIComponent(address).trim();
  if (!isAddress(wallet)) return fail(400, "Give a wallet address: 0x followed by 40 hex characters.", CHAIN_ID, g.headers);
  await live();
  const [data, block] = await Promise.all([read(wallet), withTimeout(marketClient.getBlockNumber().catch(() => null), 5_000)]);
  return ok(data, { chainId: CHAIN_ID, blockNumber: block ?? null }, g.headers);
}
