/**
 * The self-check's rules: what it calls a problem of ours.
 *
 * On 25 Oct every IPFS card had been unreadable for days with no error
 * anywhere. These hold that a dead service, a drop in what is hireable, and a
 * paid call failing on our side are each seen within the hour, and that the
 * public providers we do not rely on are not turned into noise.
 */

import { describe, expect, it } from "vitest";
import { compare, type Dependency, type Reading } from "../ops/self-check";

const reading = (over: Partial<Reading> = {}): Reading => ({
  at: "2026-10-25T16:00:00Z",
  hireableMainnet: 28,
  hireableTestnet: 15,
  answering: 240,
  cardsUnread: 10,
  registryUnread: 1338,
  paidCalls24h: 6,
  paidOurFault24h: 0,
  conformanceFail: 2,
  ...over,
});
const dep = (group: Dependency["group"], name: string, ok: boolean, primary = false): Dependency => ({ group, name, ok, detail: ok ? "fine" : "answered 429", ms: 100, ...(primary ? { primary } : {}) });
const healthy = [dep("mainnet RPC", "bsc-rpc.publicnode.com", true, true), dep("log provider", "LOG_RPC_URL", true, true), dep("log provider", "bsc.drpc.org", false), dep("testnet RPC", "testnet reader", true), dep("IPFS gateway", "ipfs.filebase.io", true), dep("IPFS gateway", "gateway.pinata.cloud", true), dep("IPFS gateway", "ipfs.io", false)];

describe("the self-check", () => {
  it("is quiet when our side is fine, whatever public providers we do not rely on are doing", () => {
    expect(compare(reading(), reading(), healthy)).toEqual([]);
  });

  it("flags every IPFS gateway down, and one left standing, before a card goes unread", () => {
    const allDown = healthy.map((d) => (d.group === "IPFS gateway" ? { ...d, ok: false } : d));
    expect(compare(reading(), reading(), allDown).map((f) => f.key)).toContain("dep:IPFS gateway:down");
    const oneLeft = healthy.map((d) => (d.name === "gateway.pinata.cloud" ? { ...d, ok: false } : d));
    expect(compare(reading(), reading(), oneLeft).map((f) => f.key)).toContain("dep:IPFS gateway:one");
  });

  it("flags the provider we configured when it fails, even while a fallback answers", () => {
    const keys = compare(reading(), reading(), healthy.map((d) => (d.name === "LOG_RPC_URL" ? { ...d, ok: false } : d))).map((f) => f.key);
    expect(keys).toContain("dep:LOG_RPC_URL:down");
  });

  it("flags a fall in what is hireable, a rise in unread cards or failed checks, and any paid call failing on our side", () => {
    const keys = compare(reading({ hireableMainnet: 22, cardsUnread: 40, conformanceFail: 6, paidOurFault24h: 1 }), reading(), healthy).map((f) => f.key);
    expect(keys).toEqual(expect.arrayContaining(["hireable:drop", "hireable:low", "cards:unread", "conformance:fail", "paid:ours"]));
  });
});
