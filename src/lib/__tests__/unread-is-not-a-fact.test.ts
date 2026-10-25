/**
 * A read that failed is not an answer.
 *
 * The 25 Oct audit found the same mistake in a dozen places: a record that
 * could not be read stood in as an empty one, and an empty one is a finding
 * (no hires, no agent wallet, nothing spent today). These hold the fixes that
 * guard money and what we tell people.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContractFunctionRevertedError, parseAbi } from "viem";

const m = vi.hoisted(() => ({
  listPaidCalls: vi.fn(),
  payAndCall: vi.fn(),
  readContract: vi.fn(),
  getBlockNumber: vi.fn(async () => 1n),
}));

vi.mock("@/lib/market/paid-calls", async (orig) => ({ ...(await orig<typeof import("@/lib/market/paid-calls")>()), listPaidCalls: m.listPaidCalls }));
vi.mock("@/lib/x402/pay-server", () => ({ payAndCall: m.payAndCall }));
vi.mock("@/lib/chain/market", async (orig) => ({ ...(await orig<typeof import("@/lib/chain/market")>()), marketClient: { readContract: m.readContract, getBlockNumber: m.getBlockNumber } }));
vi.mock("@/lib/data/live", () => ({ live: async () => undefined }));

const { testBuys } = await import("../market/test-buys");
const { quoteSigners } = await import("../escrow/signers");
const { RegistryUnreadable } = await import("../sources/registry");
const { trackingAnswer } = await import("../api/tracking-route");

const OWNER = "0x7751bE7B2BA4141D5E32Ef14e9E5cc73e9D7bf0C";
const AGENT_WALLET = "0xAC8BFF07f2B518d91fEE8D7e2Fa3fCB3e7fEf1b3";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AGENT_A_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
});

describe("spending", () => {
  it("spends nothing when the record of what was spent today cannot be read", async () => {
    m.listPaidCalls.mockRejectedValue(new Error("connection reset"));
    expect(await testBuys({ budgetMs: 5_000 })).toMatch(/could not be read; nothing spent/);
    expect(m.payAndCall).not.toHaveBeenCalled();
  });
});

describe("who may sign an agent's quote", () => {
  it("is unreadable, not 'no agent wallet', when the registry cannot be reached", async () => {
    m.readContract.mockRejectedValue(new Error("fetch failed"));
    await expect(quoteSigners("382582", { owner: OWNER })).rejects.toBeInstanceOf(RegistryUnreadable);
  });

  it("names the on-chain agent wallet when there is one, and only the owner when the registry says there is none", async () => {
    m.readContract.mockResolvedValue(AGENT_WALLET);
    expect(await quoteSigners("382582", { owner: OWNER })).toEqual([OWNER, AGENT_WALLET]);
    m.readContract.mockRejectedValue(new ContractFunctionRevertedError({ abi: parseAbi(["function getAgentWallet(uint256) view returns (address)"]), functionName: "getAgentWallet", message: "execution reverted" }));
    expect(await quoteSigners("382582", { owner: OWNER })).toEqual([OWNER]);
  });
});

describe("quest progress, which BNB Chain reads", () => {
  const req = () => new Request("http://localhost/api/v1/quest/x", { headers: { "x-forwarded-for": "203.0.113.9" } });

  it("asks the caller to try again rather than serve a count read in part", async () => {
    const r = await trackingAnswer(req(), OWNER, async () => ({ unread: ["escrowed jobs"], agentsHired: [] }));
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBe("30");
    expect(((await r.json()) as { error: string }).error).toContain("escrowed jobs");
  });

  it("answers as before when every record was read", async () => {
    const r = await trackingAnswer(req(), OWNER, async () => ({ agentsHired: [{ agentId: "1" }] }));
    expect(r.status).toBe(200);
  });
});
