/**
 * Calling a URL a stranger wrote into a registry, held to one rule.
 *
 * Every endpoint the probe, the quote reader and the payer call came out of
 * an ERC-8004 card. These hold the ways such a URL has been used to reach a
 * private network: the address written out, a name that resolves to one, and
 * a public host that redirects to one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The guard resolves A and AAAA records directly; tests answer both from one table.
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  resolve4: async (host: string) => ((await dns.lookup(host)) as { address: string; family: number }[]).filter((x) => x.family === 4).map((x) => x.address),
  resolve6: async (host: string) => ((await dns.lookup(host)) as { address: string; family: number }[]).filter((x) => x.family === 6).map((x) => x.address),
}));

const { whyUnsafe, whyUnsafeHost, isPrivateAddress, safeFetch, RefusedUrl } = await import("../net/safe-fetch");

const fetchMock = vi.fn();
beforeEach(() => {
  dns.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const res = (status: number, body = "", headers: Record<string, string> = {}) => new Response(status === 302 || status === 301 ? null : body, { status, headers });

describe("whether a URL may be called at all", () => {
  it("refuses anything but https", () => {
    expect(whyUnsafe("http://agent.example/x")).toMatch(/only call https/);
    expect(whyUnsafe("ftp://agent.example/x")).toMatch(/only call https/);
    expect(whyUnsafe("not a url")).toMatch(/not a URL/);
  });

  it("refuses our own network, written out, in v4 and v6", () => {
    for (const u of [
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://172.16.0.1/x",
      "https://192.168.1.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://100.64.0.1/x",
      "https://[::1]/x",
      "https://[fd00::1]/x",
      "https://[fe80::1]/x",
      "https://[::ffff:10.0.0.1]/x",
      "https://metadata.internal/x",
    ]) {
      expect(whyUnsafe(u), u).not.toBeNull();
    }
    expect(whyUnsafe("https://agent.example/x")).toBeNull();
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
  });

  it("refuses a public name that resolves to a private address", async () => {
    const table: Record<string, { address: string; family: number }[]> = {
      "sneaky-one.example": [{ address: "10.0.0.5", family: 4 }],
      // Public over v4, private over v6: one private record is enough to refuse.
      "sneaky-two.example": [{ address: "93.184.216.34", family: 4 }, { address: "fd12::1", family: 6 }],
    };
    dns.lookup.mockImplementation(async (host: string) => table[host] ?? [{ address: "93.184.216.34", family: 4 }]);
    expect(await whyUnsafeHost("sneaky-one.example")).toMatch(/resolves to a private/);
    expect(await whyUnsafeHost("sneaky-two.example")).toMatch(/resolves to a private/);
    expect(await whyUnsafeHost("fine.example")).toBeNull();
  });
});

describe("safeFetch", () => {
  it("reads a public answer", async () => {
    fetchMock.mockResolvedValueOnce(res(200, '{"ok":true}'));
    const r = await safeFetch("https://agent.example/x");
    expect(r).toMatchObject({ status: 200, text: '{"ok":true}', truncated: false, redirects: 0 });
  });

  it("refuses a public host that redirects to the metadata address", async () => {
    fetchMock.mockResolvedValueOnce(res(302, "", { location: "https://169.254.169.254/latest/meta-data" }));
    await expect(safeFetch("https://agent.example/x")).rejects.toBeInstanceOf(RefusedUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a name that resolves privately, checked at the hop", async () => {
    fetchMock.mockResolvedValueOnce(res(302, "", { location: "https://inside.example/admin" }));
    dns.lookup.mockImplementation(async (host: string) => (host === "inside.example" ? [{ address: "192.168.0.10", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]));
    await expect(safeFetch("https://agent-two.example/x")).rejects.toThrow(/resolves to a private/);
  });

  it("never follows a redirect on its own: each hop is checked here", async () => {
    fetchMock.mockResolvedValueOnce(res(200, "x"));
    await safeFetch("https://agent-three.example/x");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("stops reading a body past its cap", async () => {
    fetchMock.mockResolvedValueOnce(res(200, "a".repeat(5_000)));
    const r = await safeFetch("https://agent-four.example/x", { maxBytes: 1_000 });
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(1_000);
  });
});
