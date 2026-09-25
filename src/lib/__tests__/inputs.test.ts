import { describe, expect, it } from "vitest";
import { kindOf } from "../market/inputs";

describe("kindOf", () => {
  it("takes the field's name over its description", () => {
    // Range-1's wallet field describes the positions the wallet holds; it is still an address.
    expect(kindOf("wallet", "a BNB Smart Chain address: every PancakeSwap V3 position it holds")).toBe("wallet");
    expect(kindOf("position", "or one PancakeSwap V3 position id")).toBe("position");
  });
  it("falls back to the description when the name says nothing", () => {
    expect(kindOf("q", "the NFT id of your position")).toBe("position");
    expect(kindOf("target", "a 0x address to watch")).toBe("wallet");
    expect(kindOf("pair", "a trading pair")).toBe("text");
  });
});
