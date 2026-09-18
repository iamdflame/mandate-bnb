/**
 * The tape keeps every attempt, including the ones we got wrong.
 *
 * The first payment to Agripinaa was refused because we sent the x402
 * specification's envelope to a seller that reads the Altana wire. The refusal
 * was correct. That row was deleted from the tape so the hire law would stop
 * holding it against the seller, which fixed the symptom by destroying the
 * evidence. It is back, marked as ours, and counted against nobody.
 */

import { describe, expect, it } from "vitest";
import { outcomes, type PaidCallRecord } from "../market/paid-calls";

const call = (over: Partial<PaidCallRecord>): PaidCallRecord =>
  ({
    id: "x",
    tokenId: "269703",
    name: "Agripinaa Grid",
    category: "grid-trading",
    rail: "x402",
    url: "https://example.test",
    payer: "0x1",
    payTo: "0x2",
    asset: "0x3",
    amount: "1",
    method: "permit2",
    paid: false,
    delivered: false,
    refused: "it answered 402 to the signed payment",
    tx: null,
    block: null,
    approveTx: null,
    sponsored: false,
    subject: null,
    evidence: null,
    transcriptSha256: "",
    deliverable: null,
    at: "2026-09-11T18:30:01.021Z",
    ms: 1,
    ...over,
  }) as PaidCallRecord;

describe("what happened when we paid", () => {
  it("does not count our own envelope mistake as the seller refusing", () => {
    const o = outcomes([call({ id: "a", fault: "ours" })]).get("269703")!;
    expect(o.refused).toBe(0);
    expect(o.lastWhy).toBeNull();
  });

  it("still counts a refusal that was the seller's", () => {
    const o = outcomes([call({ id: "b", fault: "seller" })]).get("269703")!;
    expect(o.refused).toBe(1);
    expect(o.lastWhy).toMatch(/402/);
  });

  it("counts an unattributed refusal against the seller, as it always did", () => {
    expect(outcomes([call({ id: "c" })]).get("269703")!.refused).toBe(1);
  });

  it("lets a later delivery stand after a mistake of ours", () => {
    const o = outcomes([
      call({ id: "a", fault: "ours" }),
      call({ id: "b", paid: true, delivered: true, refused: null, tx: "0xabc", at: "2026-09-11T18:38:16.000Z" }),
    ]).get("269703")!;
    expect(o).toMatchObject({ delivered: 1, refused: 0, lastWhy: null, lastTx: "0xabc" });
  });
});
