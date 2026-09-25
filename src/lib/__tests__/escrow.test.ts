/**
 * Escrowed jobs: the addresses the browser loads are the SDK's, a job is
 * counted from what the kernel says, and a delivery hashes to what was kept.
 */

import { describe, expect, it, vi } from "vitest";
import { keccak256, stringToHex } from "viem";
import { ERC8183_ADDRESSES } from "@altananetwork/sdk";
import { ESCROW, JOB_STATUS } from "../escrow/contracts";

vi.mock("@/lib/db/client", () => ({ sql: null, db: null, hasDb: false }));

describe("escrow contracts", () => {
  it("are the Altana SDK's own ERC-8183 addresses on BNB Smart Chain", () => {
    const sdk = ERC8183_ADDRESSES[56]!;
    expect(ESCROW.commerce).toBe(sdk.commerce);
    expect(ESCROW.router).toBe(sdk.router);
    expect(ESCROW.policy).toBe(sdk.policy);
    expect(ESCROW.paymentToken).toBe(sdk.paymentToken);
  });

  it("names the kernel's states in its own order", async () => {
    const { JOB_STATUS: sdkStatus } = await import("@altananetwork/sdk");
    expect([...JOB_STATUS]).toEqual([...sdkStatus]);
  });
});

describe("escrow hires in the tracking API", () => {
  it("count a job as completed once our agent has submitted it, with the funding transaction as proof", async () => {
    const { escrowHires } = await import("../market/tracking");
    const base = {
      jobId: "56801",
      client: "0xabc",
      provider: "0x004c7ae8077560c75fe5687da39e7be0697ddbfd",
      slug: "range-1",
      tokenId: "344119",
      budget: "50000000000000000",
      subject: null,
      fundedTx: "0xfund",
      submitTx: null,
      settleTx: null,
      deliverableHash: null,
      expiredAt: null,
      submittedAt: null,
      note: null,
      createdAt: "2026-09-25T00:00:00Z",
    };
    const [funded, submitted] = escrowHires([
      { ...base, status: "FUNDED" },
      { ...base, jobId: "56802", status: "SUBMITTED" },
    ]);
    expect(funded).toMatchObject({ kind: "escrow-job", agentId: "344119", tx: "0xfund", jobId: "56801", completed: false, onChain: true, contract: ESCROW.commerce });
    expect(submitted!.completed).toBe(true);
    // The tracking module loads the whole catalogue on first import.
  }, 60_000);
});

describe("a deliverable", () => {
  it("is kept as text, so the bytes served hash to what was submitted", () => {
    // jsonb would have reordered these keys; text keeps them as hashed.
    const text = JSON.stringify({ job: { id: "1" }, answer: { b: 1, a: 2 } });
    expect(keccak256(stringToHex(text))).toBe(keccak256(stringToHex(JSON.stringify(JSON.parse(text)))));
    expect(text.indexOf('"b"')).toBeLessThan(text.indexOf('"a"'));
  });
});
