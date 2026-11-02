/**
 * Other builders' agents hired free on BNB Smart Chain testnet.
 *
 * On 25 Oct the testnet registry held 17 agents selling escrowed jobs with a
 * signed price for the testnet kernel, every one refused here only because
 * its quote was checked against mainnet. These hold the rules that make them
 * hireable: a fresh signed price, one listing per seller, a job taken on only
 * when the chain shows it matches the agent's own quote, and an endpoint's
 * network kept when its card is read.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const cards = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: vi.fn(async (url: string) => {
    const body = cards.get(url);
    return { status: body ? 200 : 404, headers: new Headers(), text: body ? JSON.stringify(body) : "", truncated: false, bytes: 0, finalUrl: url, redirects: 0 };
  }),
}));

const { hireableOnTestnet, listingsOf } = await import("../testnet/sellers");
const { outsideJobProblem } = await import("../testnet/outside-jobs");
const { escrowSeller } = await import("../escrow/a2a");
const { quoteAsSeller } = await import("../escrow/seller");
const { jobDescription, readSignedDescription, signerOf } = await import("../escrow/sdk");
const { ESCROW_TESTNET, ESCROW } = await import("../escrow/contracts");
type Seller = import("../testnet/sellers").TestnetSeller;

const NOW = Date.parse("2026-10-25T08:00:00Z");
const seller = (over: Partial<Seller> = {}): Seller => ({
  tokenId: "2554",
  name: "Venus Yield Keeper",
  what: null,
  category: "yield-optimisation",
  owner: "0x37fc1f94aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  a2a: "https://keeper.test/a2a",
  skill: "negotiate-erc8183-job",
  notify: true,
  example: null,
  ours: false,
  mainnetTokenId: null,
  readAt: "2026-10-25T07:00:00Z",
  quote: { provider: "0x6D3BD48b653beEeeEf6BBFd2DfCCf32B28049Cc5", price: "100000000000000000", etaSeconds: 120, unpayable: null, at: "2026-10-25T07:30:00Z", task: null, declined: null },
  ...over,
});

describe("an agent hireable on testnet", () => {
  it("has a fresh signed price and no job here left undelivered", () => {
    expect(hireableOnTestnet(seller(), NOW)).toEqual({ ok: true, why: null });
    expect(hireableOnTestnet(seller({ missedAt: "2026-10-25T07:50:00Z" }), NOW).ok).toBe(false);
    expect(hireableOnTestnet(seller({ quote: null }), NOW).ok).toBe(false);
    expect(hireableOnTestnet(seller({ quote: { ...seller().quote!, unpayable: "its quote is not signed" } }), NOW).why).toContain("its quote is not signed");
    expect(hireableOnTestnet(seller({ quote: { ...seller().quote!, price: "0" } }), NOW).ok).toBe(false);
    expect(hireableOnTestnet(seller({ quote: { ...seller().quote!, at: "2026-10-22T07:30:00Z" } }), NOW).why).toContain("two days old");
  });

  it("is listed once when one owner serves the same endpoint under two tokens, hireable first", () => {
    const list = listingsOf(
      [
        seller({ tokenId: "2054", name: "YieldRoute Provider", owner: "0x1007", a2a: "https://route.test/a2a" }),
        seller({ tokenId: "2053", name: "YieldRoute Provider", owner: "0x1007", a2a: "https://route.test/a2a/" }),
        seller({ tokenId: "2618", name: "Brinkwatch", quote: { ...seller().quote!, unpayable: "its quote is signed by a wallet this agent's registration does not name" } }),
      ],
      NOW,
    );
    expect(list.map((s) => s.tokenId)).toEqual(["2053", "2618"]);
    expect(list[0]!.hireable).toBe(true);
  });
});

describe("a testnet job opened here with another builder's agent", () => {
  const agent = privateKeyToAccount(keccak256(stringToHex("testnet outside seller")));
  const signed = async (chainId: number) => {
    const kernel = chainId === 97 ? ESCROW_TESTNET : ESCROW;
    const q = await quoteAsSeller(
      {
        task_description: "Rank the yield venues for 0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90, via mandatemarkets.com",
        terms: { deliverables: "A ranked list of yield venues", quality_standards: "Read from the chain at a stated block" },
      },
      { chainId, commerce: kernel.commerce, token: kernel.paymentToken, price: 100_000_000_000_000_000n, etaSeconds: 120, now: Math.floor(Date.now() / 1000), provider: agent.address, sign: (h: Hex) => agent.signMessage({ message: h }) },
    );
    if (!("negotiation_hash" in q)) throw new Error("the fixture seller declined");
    return jobDescription(q as unknown as Parameters<typeof jobDescription>[0]);
  };
  const job = (description: string, over: Partial<{ status: "FUNDED"; evaluator: string; hook: string; budget: bigint }> = {}) => ({
    status: "FUNDED" as const,
    evaluator: ESCROW_TESTNET.router,
    hook: ESCROW_TESTNET.router,
    budget: 100_000_000_000_000_000n,
    description,
    ...over,
  });

  it("is taken on when the chain holds the agent's own signed testnet quote, funded at its price", async () => {
    const d = await signed(97);
    expect(outsideJobProblem(job(d), await readSignedDescription(d), [agent.address])).toBeNull();
  });

  it("is refused when another wallet signed, the budget is short, it is not bound to the policy, or the quote is for mainnet", async () => {
    const d = await signed(97);
    const s = await readSignedDescription(d);
    expect(outsideJobProblem(job(d), s, ["0x0000000000000000000000000000000000000001"])).toContain("does not name");
    expect(outsideJobProblem(job(d, { budget: 1n }), s, [agent.address])).toContain("less than");
    expect(outsideJobProblem(job(d, { evaluator: "0x0000000000000000000000000000000000000002" }), s, [agent.address])).toContain("dispute policy");
    const m = await signed(56);
    expect(outsideJobProblem(job(m), await readSignedDescription(m), [agent.address])).not.toBeNull();
    expect(outsideJobProblem(job("guard my loan"), null, [agent.address])).toContain("no signed quote");
  });
});

describe("who signed a quote", () => {
  const agent = privateKeyToAccount(keccak256(stringToHex("a seller that signs the hash's bytes")));
  const hash = keccak256(stringToHex("a quote's content"));

  it("accepts a signature over the hash's 32 bytes from a wallet the registration names", async () => {
    // Pokter's agents and blacktoshi on 2 Nov: their own registered wallet, refused as a stranger when read only as text.
    const sig = await agent.signMessage({ message: { raw: hash } });
    expect(await signerOf(hash, sig, [agent.address])).toBe(agent.address);
  });

  it("reads the SDK's own form, a signature over the hash's text, as before", async () => {
    const sig = await agent.signMessage({ message: hash });
    expect(await signerOf(hash, sig, [agent.address])).toBe(agent.address);
    expect(await signerOf(hash, sig, [])).toBe(agent.address);
  });

  it("never turns a stranger's signature into a named wallet, whichever way it is read", async () => {
    const stranger = privateKeyToAccount(keccak256(stringToHex("not this agent")));
    for (const message of [hash, { raw: hash }] as const) {
      const sig = await stranger.signMessage({ message });
      expect((await signerOf(hash, sig, [agent.address])).toLowerCase()).not.toBe(agent.address.toLowerCase());
    }
  });
});

describe("a seller registered on a network-specific endpoint", () => {
  beforeEach(() => cards.clear());

  it("has its card read from the path, and keeps the network on the endpoint its card names", async () => {
    cards.set("https://www.mandatemarkets.test/a2a/range-1/.well-known/agent-card.json", {
      url: "https://www.mandatemarkets.test/a2a/range-1",
      skills: [{ id: "negotiate-erc8183-job" }, { id: "notify_funded" }],
    });
    const s = await escrowSeller([{ name: "A2A", endpoint: "https://www.mandatemarkets.test/a2a/range-1?chain=97" }]);
    expect(s).toMatchObject({ url: "https://www.mandatemarkets.test/a2a/range-1?chain=97", skill: "negotiate-erc8183-job", notify: true });
  });

  it("leaves an endpoint without a query as its card names it", async () => {
    cards.set("https://keeper.test/a2a/.well-known/agent-card.json", { url: "https://keeper.test/a2a", skills: [{ id: "negotiate" }] });
    expect((await escrowSeller([{ name: "A2A", endpoint: "https://keeper.test/a2a" }]))?.url).toBe("https://keeper.test/a2a");
  });
});
