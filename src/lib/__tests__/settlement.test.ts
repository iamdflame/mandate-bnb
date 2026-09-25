/**
 * A paid call counts as paid only when the chain shows the payment: the
 * seller's receipt header is read back, and a missing one is looked for.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaidCallRecord } from "../market/paid-calls";

const chain = vi.hoisted(() => ({ waitForTransactionReceipt: vi.fn(), getBlockNumber: vi.fn(), getLogs: vi.fn() }));
vi.mock("@/lib/chain/market", () => ({ marketClient: chain, logClients: [] }));
vi.mock("@/lib/db/client", () => ({ sql: null, db: null, hasDb: false }));

const { confirmSettlement, paysFor } = await import("../market/settlement");

const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
const PAYER = "0xAbCdEf0000000000000000000000000000000001";
const SELLER = "0x00000000000000000000000000000000000000Aa";
const TX = `0x${"12".repeat(32)}`;
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const pad = (a: string) => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
const amountHex = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;

const rec = (over: Partial<PaidCallRecord> = {}): PaidCallRecord =>
  ({
    id: "342379:x",
    tokenId: "342379",
    name: "Range check",
    category: "rebalancing",
    rail: "x402",
    url: "https://x.test",
    payer: PAYER,
    payTo: SELLER,
    asset: USD1,
    amount: "20000000000000000",
    method: "eip3009",
    paid: true,
    delivered: true,
    refused: null,
    tx: TX,
    block: null,
    approveTx: null,
    sponsored: false,
    subject: null,
    evidence: null,
    transcriptSha256: "h",
    deliverable: null,
    at: new Date().toISOString(),
    ms: 100,
    ...over,
  }) as PaidCallRecord;

const payment = (over: Partial<{ address: string; to: string; value: bigint }> = {}) => ({
  address: over.address ?? USD1.toLowerCase(),
  topics: [TRANSFER, pad(PAYER), pad(over.to ?? SELLER)],
  data: amountHex(over.value ?? 20000000000000000n),
});

describe("paysFor", () => {
  it("finds exactly the price, in the quoted token, from the payer to the payee", () => {
    expect(paysFor([payment()], rec())).toBe(true);
    expect(paysFor([payment({ value: 1n })], rec())).toBe(false);
    expect(paysFor([payment({ to: PAYER })], rec())).toBe(false);
    expect(paysFor([payment({ address: "0x55d398326f99059fF775485246999027B3197955" })], rec())).toBe(false);
  });
});

describe("confirmSettlement", () => {
  beforeEach(() => {
    chain.waitForTransactionReceipt.mockReset();
    chain.getBlockNumber.mockReset().mockResolvedValue(1000n);
    chain.getLogs.mockReset().mockResolvedValue([]);
  });

  it("confirms a receipt whose transaction moves the payment, with its block", async () => {
    chain.waitForTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 77n, logs: [payment()] });
    expect(await confirmSettlement(rec())).toMatchObject({ paid: true, confirmed: true, block: 77 });
  });

  it("overrules a receipt header naming a transaction that moves something else", async () => {
    chain.waitForTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 77n, logs: [payment({ value: 5n })] });
    expect(await confirmSettlement(rec())).toMatchObject({ paid: false, confirmed: false });
  });

  it("leaves the record as it is when the chain has not answered yet", async () => {
    chain.waitForTransactionReceipt.mockRejectedValue(new Error("timeout"));
    const r = rec();
    expect(await confirmSettlement(r)).toBe(r);
  });

  it("finds a payment the seller sent no receipt for, even when it did not deliver", async () => {
    chain.getLogs.mockResolvedValue([{ transactionHash: TX, blockNumber: 990n, args: { value: 20000000000000000n } }]);
    const found = await confirmSettlement(rec({ tx: null, paid: false, delivered: false }));
    expect(found).toMatchObject({ tx: TX, block: 990, paid: true, confirmed: true });
    expect(found.note).toMatch(/did not deliver/);
  });
});
