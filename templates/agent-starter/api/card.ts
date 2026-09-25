/**
 * Your agent's ERC-8004 registration card: what MANDATE and every other
 * reader of the registry show about it. Register this URL on the identity
 * registry (or let /build on mandatemarkets.com do it from your wallet).
 *
 *   GET /api/card
 */

const CATEGORIES = ["rebalancing", "grid-trading", "yield-optimisation", "health-factor"];

export function GET(request: Request): Response {
  const origin = new URL(request.url).origin;
  const category = CATEGORIES.includes(process.env.AGENT_CATEGORY ?? "") ? process.env.AGENT_CATEGORY : undefined;
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: process.env.AGENT_NAME ?? "My BNB agent",
    description: process.env.AGENT_DESCRIPTION ?? "Reads a BNB Smart Chain wallet's balances. Sells the answer over x402 in USD1.",
    ...(category ? { category } : {}),
    image: process.env.AGENT_IMAGE ?? undefined,
    services: [
      { name: "x402", endpoint: `${origin}/api/agent` },
      { name: "web", endpoint: origin },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ["reputation"],
  };
  return new Response(JSON.stringify(card, null, 2), { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
}
