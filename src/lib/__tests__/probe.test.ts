/**
 * The probe, speaking the protocols.
 *
 * "Answered" used to mean any HTTP reply, so a parked domain's 404 counted as
 * an agent answering. It now means an answer in a protocol we can use: a
 * price over x402, an MCP handshake, or an A2A card and call. These run each
 * path against a scripted server, and hold the two refusals: a URL we will
 * not call, and a redirect somewhere we will not follow.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// The guard resolves A and AAAA records directly; tests answer both from one table.
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => ({
  resolve4: async (host: string) => ((await dns.lookup(host)) as { address: string; family: number }[]).filter((x) => x.family === 4).map((x) => x.address),
  resolve6: async (host: string) => ((await dns.lookup(host)) as { address: string; family: number }[]).filter((x) => x.family === 6).map((x) => x.address),
}));

const { probe } = await import("../probe");

type Route = (url: string, init: RequestInit) => Response | null;
let routes: Route[] = [];
const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
  for (const r of routes) {
    const res = r(url, init);
    if (res) return res;
  }
  return new Response("not found", { status: 404 });
});

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const rpcMethod = (init: RequestInit) => {
  try {
    return (JSON.parse(String(init.body)) as { method?: string }).method ?? null;
  } catch {
    return null;
  }
};

beforeEach(() => {
  routes = [];
  fetchMock.mockClear();
  dns.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  vi.stubGlobal("fetch", fetchMock);
});

describe("the probe", () => {
  it("takes a price over x402 as an answer, in one request", async () => {
    routes.push((_u, init) => ((init.method ?? "GET") === "GET" ? json({ x402Version: 2, accepts: [] }, 402) : null));
    const r = await probe("1", "https://seller.example/api");
    expect(r).toMatchObject({ answered: true, status: 402, protocol: "x402" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("completes an MCP handshake and keeps the tools it lists", async () => {
    routes.push((_u, init) => ((init.method ?? "GET") === "GET" ? new Response("method not allowed", { status: 405 }) : null));
    routes.push((_u, init) =>
      rpcMethod(init) === "initialize" ? json({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2024-11-05" } }, 200, { "mcp-session-id": "s-1" }) : null,
    );
    routes.push((_u, init) => (rpcMethod(init) === "notifications/initialized" ? new Response(null, { status: 202 }) : null));
    routes.push((_u, init) =>
      rpcMethod(init) === "tools/list" && (init.headers as Record<string, string>)["mcp-session-id"] === "s-1"
        ? json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "get_position_range", description: "Reads a V3 range" }] } })
        : null,
    );
    const r = await probe("2", "https://mcp.example/mcp");
    expect(r).toMatchObject({ answered: true, protocol: "mcp" });
    expect(r.tools).toEqual([{ name: "get_position_range", description: "Reads a V3 range" }]);
    expect(r.transcript?.map((s) => s.request)).toEqual(["GET", "POST initialize", "POST tools/list"]);
  });

  it("recognises an A2A agent by its card and its answer to a no-effect call", async () => {
    routes.push((u, init) => ((init.method ?? "GET") === "GET" && u.endsWith("/.well-known/agent-card.json") ? json({ name: "A", skills: [{ id: "hf", name: "health factor" }] }) : null));
    routes.push((_u, init) => (rpcMethod(init) === "tasks/get" ? json({ jsonrpc: "2.0", id: 3, error: { code: -32001, message: "no such task" } }) : null));
    const r = await probe("3", "https://a2a.example/agent");
    expect(r).toMatchObject({ answered: true, protocol: "a2a" });
    expect(r.tools?.[0]?.name).toBe("health factor");
  });

  it("keeps a website that answers apart from an agent, and from silence", async () => {
    routes.push(() => new Response("<html>hello</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const r = await probe("4", "https://website.example/");
    expect(r).toMatchObject({ answered: false, status: 200, protocol: "http" });
    expect(r.error).toMatch(/not in MCP, A2A or x402/);
  });

  it("will not call plain http, and says so", async () => {
    const r = await probe("5", "http://seller.example/api");
    expect(r).toMatchObject({ answered: false, refused: true });
    expect(r.error).toMatch(/only call https/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("will not call a name that resolves to a private address", async () => {
    dns.lookup.mockImplementation(async (host: string) => (host === "inside.example" ? [{ address: "10.1.2.3", family: 4 }] : [{ address: "93.184.216.34", family: 4 }]));
    const r = await probe("6", "https://inside.example/api");
    expect(r).toMatchObject({ answered: false, refused: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("records a redirect to the metadata address as a refusal, not as silence", async () => {
    routes.push(() => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }));
    const r = await probe("7", "https://bouncer.example/api");
    expect(r).toMatchObject({ answered: false, refused: true });
    expect(r.error).toMatch(/private or reserved network/);
  });
});
