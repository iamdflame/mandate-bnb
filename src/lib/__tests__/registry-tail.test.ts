/**
 * The registry tail: mints decoded exactly, agents filed by what they say.
 *
 * The catalogue is only the registry's own answer if a mint cannot be misread
 * (a transfer between owners is not a new agent) and a card's own label is
 * never taken at its word. These hold both, and hold that an agent read from
 * the chain merges over the committed crawl instead of duplicating it.
 */

import { describe, expect, it } from "vitest";
import { TRANSFER_TOPIC, agentFrom, decodeMints, protocolsOf } from "../registry/tail";
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
