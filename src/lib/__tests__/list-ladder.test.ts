/**
 * The seller ladder: where an agent stands and the one thing that moves it.
 *
 * The advice is the product here. A seller who reads "not live" learns
 * nothing; a seller who reads "your endpoint answered 200 in none of MCP, A2A
 * or x402, so serve one of these" can fix it in an afternoon. These hold the
 * placement rule and the advice for each state the probe can report.
 */

import { describe, expect, it } from "vitest";
import { LIST_RUNGS, placeListing, type ListEvidence } from "../market/list-ladder";

const top: ListEvidence = {
  tokenId: "42",
  registered: true,
  card: { resolved: true, name: "Range keeper", description: "Keeps a PancakeSwap V3 range", error: null },
  endpoint: "https://agent.example/x402",
  probe: { answered: true, status: 402, protocol: "x402", refused: false, error: null },
  quote: { payable: true, unpayable: null, amount: "50000000000000000", decimals: 18, asset: "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d", assetName: "USD1", network: "eip155:56" },
  fineness: 420,
  settled: 2,
};
const at = (over: Partial<ListEvidence>) => placeListing({ ...top, ...over });

describe("placing a seller", () => {
  it("reaches the top only when every rung holds, and then has nothing left to do", () => {
    const p = placeListing(top);
    expect(p.rung).toBe(5);
    expect(p.name).toBe("Settled");
    expect(p.next).toBeNull();
    expect(p.rungs.map((r) => r.passed)).toEqual([true, true, true, true, true, true]);
  });

  it("counts a rung only when the rungs below it hold: settled work behind a silent endpoint is rung 1", () => {
    const p = at({ probe: { answered: false, status: null, protocol: null, refused: false, error: "no answer in 8s" } });
    expect(p.rung).toBe(1);
    expect(p.next?.name).toBe("Live");
    expect(p.rungs[5]!.passed).toBe(true);
  });

  it("says a token outside the registry is not registered, and how to fix that", () => {
    const p = at({ registered: false, card: { resolved: false, name: null, description: null, error: null } });
    expect(p.rung).toBe(-1);
    expect(p.name).toBe("Not registered");
    expect(p.next).toMatchObject({ rung: 0, name: "Registered" });
    expect(p.next!.todo).toMatch(/ERC-8004/);
  });

  it("tells an unresolved card to publish one, and a nameless card to name itself", () => {
    expect(at({ card: { resolved: false, name: null, description: null, error: "404" } }).next!.todo).toMatch(/Publish a JSON agent card/);
    const nameless = at({ card: { resolved: true, name: null, description: null, error: null } });
    expect(nameless.rung).toBe(0);
    expect(nameless.next!.todo).toMatch(/name and a description/);
  });

  it("gives advice for every way an endpoint can fail to be live", () => {
    expect(at({ endpoint: null }).next!.todo).toMatch(/Add an https endpoint/);
    expect(at({ probe: { answered: false, status: null, protocol: null, refused: true, error: "we only call https" } }).next!.todo).toMatch(/over https from a public address/);
    const website = at({ probe: { answered: false, status: 200, protocol: "http", refused: false, error: null } });
    expect(website.next!.todo).toMatch(/MCP initialize and tools\/list/);
    expect(website.rungs[2]!.saw).toMatch(/answered 200, but in none of MCP, A2A or x402/);
  });

  it("asks a priced but unpayable seller for a rail we settle, quoting what is wrong today", () => {
    const p = at({ quote: { ...top.quote!, payable: false, unpayable: "USDT without EIP-3009 or Permit2" } });
    expect(p.rung).toBe(2);
    expect(p.next!.todo).toMatch(/Today: USDT without EIP-3009 or Permit2/);
  });

  it("names the bar a seller below it has to reach, and the first paid job after that", () => {
    expect(at({ fineness: 300 }).next!.todo).toMatch(/from 300 to 375/);
    expect(at({ fineness: null }).next!.todo).toMatch(/Run the assay/);
    expect(at({ settled: 0 }).next).toMatchObject({ rung: 5, name: "Settled" });
  });

  it("has six rungs, numbered in order, each a test we run", () => {
    expect(LIST_RUNGS.map((r) => r.n)).toEqual([0, 1, 2, 3, 4, 5]);
    for (const r of LIST_RUNGS) expect(r.test).not.toMatch(/—/);
  });
});
