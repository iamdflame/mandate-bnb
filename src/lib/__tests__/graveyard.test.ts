/**
 * The graveyard: only failures, each attributed, and ours labelled as ours.
 *
 * The page is only worth anything if a row cannot be there by mistake and
 * cannot be missing by choice. These hold the selection rule against built
 * records, then against the committed record itself, where the first
 * Agripinaa refusal was our fault and has to stay on the page saying so.
 */

import { describe, expect, it } from "vitest";
import { buriedFor, graveAnchor, graveyard } from "../market/graveyard";
import { oneRowPerExchange, paidCallsFromFile, type PaidCallRecord } from "../market/paid-calls";
import { strangerHires, type StrangerHire } from "../market/stranger-hires";

const call = (over: Partial<PaidCallRecord>): PaidCallRecord => ({
  id: `1:${Math.random()}`,
  tokenId: "1",
  name: "Seller",
  category: "grid-trading",
  rail: "x402",
  url: "https://seller.example/x",
  payer: "0xpayer",
  payTo: "0xseller",
  asset: "0x55d398326f99059fF775485246999027B3197955",
  amount: "50000000000000000",
  method: "permit2",
  paid: true,
  delivered: true,
  refused: null,
  tx: "0xabc",
  block: 1,
  approveTx: null,
  sponsored: false,
  subject: "grid status",
  evidence: null,
  transcriptSha256: "f".repeat(64),
  deliverable: null,
  at: "2026-09-11T00:00:00Z",
  ms: 100,
  ...over,
});

const hire = (over: Partial<StrangerHire>): StrangerHire => ({
  tokenId: "9",
  who: "Provider",
  provider: "0xprov",
  providerVia: "card",
  ownerOf: "0xprov",
  jobId: "100",
  tx: "0xfund",
  budget: "0.1",
  token: "$U",
  expiredAt: 0,
  statusAtHire: "1",
  task: "report a health factor",
  at: "2026-09-11T00:00:00Z",
  ...over,
});

describe("what goes in the graveyard", () => {
  it("lists only failures: a delivered call and an unpaid call with no refusal stay out", () => {
    const g = graveyard(
      [
        call({ id: "ok", paid: true, delivered: true }),
        call({ id: "nothing", paid: false, delivered: false, refused: null, tx: null }),
        call({ id: "took", paid: true, delivered: false, refused: "settlement failed" }),
        call({ id: "refused", paid: false, delivered: false, refused: "Payment not accepted", tx: null }),
      ],
      [],
    );
    expect(g.map((x) => [x.id, x.kind])).toEqual([
      ["took", "took"],
      ["refused", "refused"],
    ]);
  });

  it("keeps the seller's own words, untouched, and the hash of the exchange", () => {
    const [g] = graveyard([call({ paid: true, delivered: false, refused: "settlement failed: Invalid parameters" })], []);
    expect(g.said).toBe("settlement failed: Invalid parameters");
    expect(g.sha256).toBe("f".repeat(64));
    expect(g.amount).toBe(0.05);
  });

  it("labels a failure that was ours, and never holds it against the agent", () => {
    const g = graveyard([call({ tokenId: "7", paid: false, delivered: false, refused: "402", fault: "ours", note: "We sent the wrong envelope." })], []);
    expect(g).toHaveLength(1);
    expect(g[0].ours).toBe(true);
    expect(buriedFor("7", g)).toBeNull();
    const theirs = graveyard([call({ tokenId: "8", paid: true, delivered: false, refused: "error" })], []);
    expect(buriedFor("8", theirs)?.kind).toBe("took");
  });

  it("buries an escrowed job only when its deliverable was read and did not match", () => {
    const read = { url: "https://p.example/r", committedHash: "0x1", contentHash: null, content: null, readAt: "2026-09-16T00:00:00Z" };
    const g = graveyard(
      [],
      [
        hire({ jobId: "1" }),
        hire({ jobId: "2", deliverable: { ...read, hashMatches: null } }),
        hire({ jobId: "3", deliverable: { ...read, hashMatches: true } }),
        { ...hire({ jobId: "4", deliverable: { ...read, hashMatches: false } }), disputed: { tx: "0xdispute", because: "no reading of its bytes matches" } } as StrangerHire,
      ],
    );
    expect(g.map((x) => x.id)).toEqual(["job:4"]);
    expect(g[0]).toMatchObject({ kind: "unchecked", ours: false, disputeTx: "0xdispute", budget: "0.1 $U" });
    expect(g[0].note).toMatch(/no reading of its bytes matches/);
  });

  it("puts the newest first, and gives every row an anchor a page can link to", () => {
    const g = graveyard(
      [call({ id: "a:0x1", at: "2026-09-10T00:00:00Z", paid: true, delivered: false }), call({ id: "b:0x2", at: "2026-09-12T00:00:00Z", paid: true, delivered: false })],
      [],
    );
    expect(g.map((x) => x.id)).toEqual(["b:0x2", "a:0x1"]);
    expect(graveAnchor(g[0])).toBe("g-b-0x2");
    expect(graveAnchor({ id: "job:56777" })).toMatch(/^g-[a-zA-Z0-9-]+$/);
  });
});

describe("one exchange, one row", () => {
  it("keeps the reading where money moved when the same exchange was recorded twice", () => {
    const early = call({ id: "269703:2026-09-11T18:38:16.825Z", paid: false, delivered: false, refused: "402", tx: null, transcriptSha256: "a".repeat(64) });
    const settled = call({ id: "269703:0x9e8b", paid: true, delivered: false, refused: "402", tx: "0x9e8b", transcriptSha256: "a".repeat(64) });
    const other = call({ id: "other", transcriptSha256: "b".repeat(64) });
    for (const order of [[early, settled, other], [settled, early, other]]) {
      const rows = oneRowPerExchange(order);
      expect(rows.map((r) => r.id).sort()).toEqual(["269703:0x9e8b", "other"]);
    }
    expect(graveyard(oneRowPerExchange([early, settled]), []).map((g) => g.kind)).toEqual(["took"]);
  });
});

describe("the committed record", () => {
  const graves = graveyard(paidCallsFromFile(), strangerHires());

  it("holds only failures", () => {
    for (const g of graves) {
      if (g.kind === "took") expect(g.tx).toBeTruthy();
      if (g.kind === "refused") expect(g.said).toBeTruthy();
    }
    const delivered = paidCallsFromFile().filter((c) => c.paid && c.delivered);
    for (const c of delivered) expect(graves.some((g) => g.id === c.id)).toBe(false);
  });

  it("keeps the first Agripinaa refusal, labelled as our mistake", () => {
    const ours = graves.filter((g) => g.ours);
    expect(ours.length).toBeGreaterThan(0);
    for (const g of ours) expect(g.note).toMatch(/ours/);
  });
});
