/**
 * The registry tail: mints decoded exactly, agents filed by what they say.
 *
 * The catalogue is only the registry's own answer if a mint cannot be misread
 * (a transfer between owners is not a new agent) and a card's own label is
 * never taken at its word. These hold both, and hold that an agent read from
 * the chain merges over the committed crawl instead of duplicating it.
 */

import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import { keccak256, toHex } from "viem";
import { TRANSFER_TOPIC, URI_UPDATED_TOPIC, agentFrom, cardUnread, decodeMints, decodeUriUpdates, protocolsOf, readAgain, retryAt } from "../registry/tail";
import { readCard } from "../sources/registry";
import { getAgentIndex } from "../data/agents";
import { putRegistryExtra } from "../registry/extras";
import type { RegistryEntry } from "../sources/registry";

const word = (hex: string) => `0x${hex.replace(/^0x/, "").padStart(64, "0")}`;
const ZERO = word("0");

describe("reading mints", () => {
  it("decodes a mint's token, owner, block and transaction, and ignores ordinary transfers", () => {
    const mints = decodeMints([
      { topics: [TRANSFER_TOPIC, ZERO, word("00000000000000000000000081762d5214fcb6fb3b102bef9d69d13a56c1a2d0"), word((344124).toString(16))], blockNumber: "0x7394c5d", transactionHash: "0xabc" },
      // A transfer from one owner to another is not a new agent.
      { topics: [TRANSFER_TOPIC, word("1234"), word("5678"), word("1")], blockNumber: "0x1", transactionHash: "0xdef" },
    ]);
    expect(mints).toEqual([{ tokenId: "344124", owner: "0x81762d5214fcb6fb3b102bef9d69d13a56c1a2d0", block: 121195613, tx: "0xabc" }]);
  });
});

const entry = (over: Partial<RegistryEntry>): RegistryEntry => ({
  chainId: 56,
  tokenId: "400000",
  owner: "0x00000000000000000000000000000000000000AA",
  tokenURI: "data:application/json;base64,e30=",
  cardSource: "data-uri",
  name: null,
  description: null,
  image: null,
  services: [],
  claimedCategory: null,
  x402Endpoint: null,
  card: null,
  cardError: null,
  blockNumber: "123000000",
  at: "2026-09-25T00:00:00Z",
  ...over,
});

describe("filing an agent", () => {
  it("files it by what its card says it does, and keeps its mint as evidence", () => {
    const a = agentFrom(
      "400000",
      entry({ name: "Range keeper", description: "Rebalances PancakeSwap V3 liquidity positions when they drift out of range.", services: [{ name: "MCP", endpoint: "https://x.test/mcp" }, { name: "x402", endpoint: "https://x.test/pay" }], x402Endpoint: "https://x.test/pay" }),
      { block: 123000001, tx: "0xmint" },
    );
    expect(a.category).toBe("rebalancing");
    expect(a.protocols).toEqual(["MCP", "x402"]);
    expect(a.x402).toBe(true);
    expect(a.owner).toBe("0x00000000000000000000000000000000000000aa");
    expect(a).toMatchObject({ registeredTx: "0xmint", registeredBlock: 123000001, source: "tail" });
  });

  it("does not take a card's own category label as the answer", () => {
    const a = agentFrom("400001", entry({ name: "Hello", description: "A friendly chat companion.", claimedCategory: "grid-trading" }));
    expect(a.category).not.toBe("grid-trading");
  });

  it("reads only the protocols it knows, in the crawl's spelling", () => {
    expect(protocolsOf({ services: [{ name: "a2a", endpoint: "" }, { name: "Web", endpoint: "" }, { name: "telegram", endpoint: "" }] })).toEqual(["A2A", "Web"]);
    expect(protocolsOf(null)).toEqual([]);
  });
});

describe("an owner setting a new card", () => {
  it("is the registry's URIUpdated event, and names the agent", () => {
    expect(URI_UPDATED_TOPIC).toBe(keccak256(toHex("URIUpdated(uint256,string,address)")));
    const upd = { topics: [URI_UPDATED_TOPIC, word((382582).toString(16)), word("7751be7b2ba4141d5e32ef14e9e5cc73e9d7bf0c")] };
    // A transfer in the same read is not a card update, and one agent updated twice is read again once.
    expect(decodeUriUpdates([upd, upd, { topics: [TRANSFER_TOPIC, ZERO, word("aa"), word("1")] }])).toEqual(["382582"]);
  });
});

describe("cards written in the forms registrants use", () => {
  const card = { type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1", name: "HermesScout", description: "Scouts yield." };

  it("reads a card written straight into the tokenURI", async () => {
    expect(await readCard(JSON.stringify(card))).toMatchObject({ card: { name: "HermesScout" }, source: "data-uri", error: null });
  });

  it("reads a gzip-compressed data: card", async () => {
    const uri = `data:application/json;enc=gzip;level=6;base64,${gzipSync(Buffer.from(JSON.stringify(card))).toString("base64")}`;
    expect(await readCard(uri)).toMatchObject({ card: { name: "HermesScout" }, source: "data-uri" });
  });

  it("still says so when there is no card to read", async () => {
    expect((await readCard("")).error).toBe("The registration carries no tokenURI.");
    expect((await readCard("{ not json")).source).toBe("unresolved");
    expect((await readCard('""')).source).toBe("unresolved");
  });
});

describe("a card that did not load", () => {
  const now = Date.parse("2026-10-25T06:00:00Z");

  it("is not taken as read: it waits 1 h, 6 h, 24 h, then a week", () => {
    expect(cardUnread(entry({ cardSource: "unresolved", cardError: "HTTP 503" }))).toBe(true);
    expect(cardUnread(entry({ cardSource: "http", name: "cfo Venus health factor monitor" }))).toBe(false);
    expect([1, 2, 3, 4, 9].map((n) => (Date.parse(retryAt(n, now)) - now) / 3_600_000)).toEqual([1, 6, 24, 168, 168]);
  });

  it("leaves a nameless, unfiled row to be read again after an hour, and never a row that has its card", () => {
    const blank = { name: null, category: null };
    expect(readAgain({ ...blank, lastSeen: "2026-10-24T13:23:23Z" }, now)).toBe(true);
    expect(readAgain({ ...blank, lastSeen: "2026-10-25T05:30:00Z" }, now)).toBe(false);
    expect(readAgain({ ...blank, lastSeen: undefined }, now)).toBe(true);
    expect(readAgain({ name: "cfo Venus health factor monitor", category: null, lastSeen: "2026-10-01T00:00:00Z" }, now)).toBe(false);
    expect(readAgain({ name: null, category: "health-factor", lastSeen: "2026-10-01T00:00:00Z" }, now)).toBe(false);
  });

  it("files #382582's card under health factor once it reads", () => {
    const a = agentFrom(
      "382582",
      entry({ tokenId: "382582", cardSource: "http", name: "cfo Venus health factor monitor", description: "Reads a Venus position's health factor and how far it is from liquidation.", x402Endpoint: "https://cfo.test/api/agent" }),
      {},
      "list",
    );
    expect(a.category).toBe("health-factor");
  });
});

describe("merging into the catalogue", () => {
  it("adds a new agent and overrides a crawled one by token id, without duplicating it", () => {
    const before = getAgentIndex().agents.length;
    const crawled = getAgentIndex().agents[0]!;
    putRegistryExtra({ ...crawled, name: "Renamed on chain" });
    putRegistryExtra({ ...crawled, tokenId: "999999999", name: "Brand new" });
    const after = getAgentIndex();
    expect(after.agents.length).toBe(before + 1);
    expect(after.agents.find((a) => a.tokenId === crawled.tokenId)?.name).toBe("Renamed on chain");
    expect(after.agents.find((a) => a.tokenId === "999999999")?.name).toBe("Brand new");
  });
});
