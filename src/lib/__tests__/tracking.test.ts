/**
 * The tracking BNB's quest counts from: only what a wallet did with its own
 * money, each row with the transaction that proves it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData } from "viem";
import { jobsCovered, paidCallHires, type HireRow } from "../market/tracking";
import { isTeam, teamWallets } from "../team";
import { REPUTATION_ABI, REPUTATION_REGISTRY } from "../chain/reputation-abi";
import type { PaidCallRecord } from "../market/paid-calls";

const chain = vi.hoisted(() => ({ getTransactionReceipt: vi.fn(), getTransaction: vi.fn() }));
vi.mock("@/lib/chain/market", async (orig) => {
  const real = await orig<typeof import("@/lib/chain/market")>();
  return { ...real, marketClient: { ...real.marketClient, getTransactionReceipt: chain.getTransactionReceipt, getTransaction: chain.getTransaction } };
});
vi.mock("@/lib/db/client", () => ({ sql: null, db: null, hasDb: false }));

const call = (over: Partial<PaidCallRecord>): PaidCallRecord =>
  ({
    id: `x:${Math.random()}`,
    tokenId: "342379",
    name: "Range check",
    category: "rebalancing",
    rail: "x402",
    url: "https://x.test",
    payer: "0xAbCdEf0000000000000000000000000000000001",
    payTo: "0x1",
    asset: "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d",
    amount: "20000000000000000",
    method: "eip3009",
    paid: true,
    delivered: true,
    refused: null,
    tx: "0xsettle",
    block: 1,
    approveTx: null,
    sponsored: false,
    subject: null,
    evidence: null,
    transcriptSha256: "h",
    deliverable: null,
    at: "2026-09-25T10:00:00Z",
    ms: 100,
    ...over,
  }) as PaidCallRecord;

describe("a wallet's hires", () => {
  it("counts only calls the wallet itself paid, matched without regard to case, each with its settlement", () => {
    const rows = paidCallHires(
      [call({}), call({ payer: "0x9999999999999999999999999999999999999999" }), call({ paid: false, tx: null })],
      "0xabcdef0000000000000000000000000000000001",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "paid-call", agentId: "342379", category: "rebalancing", tx: "0xsettle", completed: true });
  });

  it("covers a job only with the wallet's own hires the chain confirms, never a call we paid for it", () => {
    const own: HireRow = { kind: "paid-call", agentId: "1", agentName: null, category: "grid-trading", tx: "0x1", block: 1, contract: null, jobId: null, amount: "1", asset: null, completed: true, onChain: true, at: null, sponsored: false };
    const covered = jobsCovered([own, { ...own, category: "yield-optimisation", sponsored: true }, { ...own, category: "rebalancing", onChain: false }]);
    expect(covered["grid-trading"]).toBe(1);
    expect(covered["yield-optimisation"]).toBe(0);
    expect(covered["rebalancing"]).toBe(0);
  });

  it("marks a call on chain only once its settlement has been read back", () => {
    const [unread] = paidCallHires([call({})], "0xabcdef0000000000000000000000000000000001");
    const [read] = paidCallHires([call({ confirmed: true, block: 9 })], "0xabcdef0000000000000000000000000000000001");
    expect(unread!.onChain).toBe(false);
    expect(read).toMatchObject({ onChain: true, block: 9 });
  });
});

describe("team wallets", () => {
  it("declares our own wallets, including the house agents' owners, and nobody else", () => {
    expect(isTeam("0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90")).toBe(true);
    expect(isTeam("0x6F29B50ebaF733D980EadfeB3253347d8a12A69C")).toBe(true);
    expect(Object.values(teamWallets()).some((w) => /range-1/.test(w))).toBe(true);
    expect(isTeam("0x1234567890123456789012345678901234567890")).toBe(false);
  });
});

describe("POST /api/v1/ratings", () => {
  const post = async (tx: string, ip: string) => {
    const { POST } = await import("../../app/api/v1/ratings/route");
    return POST(new Request("https://t.test/api/v1/ratings", { method: "POST", body: JSON.stringify({ tx }), headers: { "content-type": "application/json", "x-forwarded-for": ip } }));
  };
  const TX = `0x${"ab".repeat(32)}`;
  const input = encodeFunctionData({ abi: REPUTATION_ABI, functionName: "giveFeedback", args: [342379n, 80n, 0, "rebalancing", "mandatemarkets", "", "https://x.test/agents/342379", `0x${"00".repeat(32)}`] });

  beforeEach(() => {
    chain.getTransactionReceipt.mockReset().mockResolvedValue({ status: "success", blockNumber: 123n });
    chain.getTransaction.mockReset().mockResolvedValue({ to: REPUTATION_REGISTRY, from: "0xAbCdEf0000000000000000000000000000000001", input });
  });

  it("keeps a successful giveFeedback on the registry, filed under the sender, not the caller", async () => {
    const res = await post(TX, "10.9.0.1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { wallet: string; agentId: string; score: number; tag2: string }; observed: { blockNumber: string } };
    expect(body.data).toMatchObject({ wallet: "0xabcdef0000000000000000000000000000000001", agentId: "342379", score: 80, tag2: "mandatemarkets" });
    expect(body.observed.blockNumber).toBe("123");
  });

  it("refuses a transaction to any other contract, a reverted one, and one not yet mined", async () => {
    chain.getTransaction.mockResolvedValueOnce({ to: "0x0000000000000000000000000000000000000001", from: "0x1", input });
    expect((await post(TX, "10.9.0.2")).status).toBe(400);
    chain.getTransactionReceipt.mockResolvedValueOnce({ status: "reverted", blockNumber: 1n });
    expect((await post(TX, "10.9.0.3")).status).toBe(400);
    chain.getTransactionReceipt.mockRejectedValueOnce(new Error("not found"));
    expect((await post(TX, "10.9.0.4")).status).toBe(404);
  });
});
