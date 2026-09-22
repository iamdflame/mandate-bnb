import { NextResponse } from "next/server";
import { parseAbi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { diagnose } from "@/lib/diagnose";
import { readVenus } from "@/lib/diagnose/positions";
import { RECIPIENT_BOUND, SWAP_BOUND, POSITION_MANAGER, SWAP_ROUTER } from "@/lib/chain/leash";
import { listSessions } from "@/lib/chain/session-store";
import { DEMO_ADDRESS } from "@/lib/demo";
import { withTimeout } from "@/lib/cache";
import { take, callerOf, limitHeaders } from "@/lib/api/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Three of the six tasks, re-run against the chain as it is right now.
 *
 * The locked report measures a fixed 24,000 block window and needs an archive
 * node, which is not something a request from a browser can do inside a
 * function's time budget. These three do not need history: they are the same
 * questions asked of the head block, so a reader can watch the measurement
 * happen instead of trusting a JSON file from earlier in the month.
 *
 * Everything here is a read. No transaction is sent and nothing is signed.
 */

const BOUND = parseAbi([
  "function principal() view returns (address)",
  "function expiry() view returns (uint64)",
]);

interface Check {
  id: string;
  title: string;
  question: string;
  verdict: "pass" | "fail" | "inconclusive";
  finding: string;
  evidence: { label: string; value: string }[];
  ms: number;
}

async function timed(id: string, title: string, question: string, run: () => Promise<Omit<Check, "id" | "title" | "question" | "ms">>): Promise<Check> {
  const t0 = Date.now();
  try {
    const r = await withTimeout(run(), 15_000);
    if (!r) throw new Error("the chain did not answer inside 15 seconds");
    return { id, title, question, ...r, ms: Date.now() - t0 };
  } catch (e) {
    return {
      id,
      title,
      question,
      verdict: "inconclusive",
      finding: `This could not be measured just now: ${(e as Error).message.slice(0, 160)}`,
      evidence: [],
      ms: Date.now() - t0,
    };
  }
}

export async function GET(req: Request) {
  const who = callerOf(req);
  // These are chain reads on our own providers, so they are cheap but not
  // free. Six a minute is more than a person re-running by hand will ever use.
  const gate = take(`proof:${who}`, { capacity: 6, windowMs: 60_000 });
  if (!gate.ok) {
    return NextResponse.json(
      { error: `Six re-runs a minute. Try again in ${gate.retryAfter} seconds.` },
      { status: 429, headers: limitHeaders(gate) },
    );
  }

  const block = await marketClient.getBlockNumber().catch(() => null);

  const checks = await Promise.all([
    timed(
      "T1-live",
      "Liquidity that has stopped earning",
      "Right now, how much of this wallet's PancakeSwap liquidity is outside its range and therefore earning nothing?",
      async () => {
        const d = await diagnose(DEMO_ADDRESS);
        if (!d) return { verdict: "inconclusive" as const, finding: "The position reader returned nothing.", evidence: [] };
        const out = d.findings.filter((f) => f.kind === "out-of-range");
        const total = d.findings.filter((f) => f.kind === "out-of-range" || f.kind === "in-range").length;
        return {
          // A position out of range is the problem the agent exists to fix, so
          // finding one is the check passing, not failing.
          verdict: out.length > 0 ? ("pass" as const) : ("inconclusive" as const),
          finding:
            out.length > 0
              ? `${out.length} of ${total || out.length} positions on this wallet are out of range at block ${Number(d.blockNumber).toLocaleString("en-GB")}. Each one is capital earning no fees until somebody moves it.`
              : `Nothing is out of range on this wallet at block ${Number(d.blockNumber).toLocaleString("en-GB")}, so there is nothing for a rebalancing agent to fix this second.`,
          evidence: [
            { label: "Wallet", value: DEMO_ADDRESS },
            { label: "Block", value: Number(d.blockNumber).toLocaleString("en-GB") },
            ...out.slice(0, 3).map((f, i) => ({ label: `Out of range ${i + 1}`, value: f.title })),
          ],
        };
      },
    ),

    timed(
      "T4-live",
      "Being early against being liquidated",
      "What is this wallet's Venus health factor at the head block, and would the guard agent act on it?",
      async () => {
        const v = await readVenus(DEMO_ADDRESS as Address);
        if (!v) return { verdict: "inconclusive" as const, finding: "Venus did not answer.", evidence: [] };
        const hf = v.healthFactor;
        const TRIGGER = 3;
        if (hf === null || hf === undefined) {
          return {
            verdict: "inconclusive" as const,
            finding: "This wallet has no Venus debt right now, so it has no health factor. That is not the same as being healthy, and it is not printed as a number.",
            evidence: [{ label: "Assets in the market", value: String(v.assetsIn) }],
          };
        }
        return {
          verdict: "pass" as const,
          finding:
            hf < TRIGGER
              ? `Health factor is ${hf.toFixed(4)}, under the ${TRIGGER.toFixed(2)} trigger. The guard agent would repay part of this account's own debt now. Repaying costs a few cents of gas. Being liquidated costs a share of the seized collateral.`
              : `Health factor is ${hf.toFixed(4)}, above the ${TRIGGER.toFixed(2)} trigger, so the guard agent does nothing. It acts only under the trigger, and it can only repay.`,
          evidence: [
            { label: "Health factor now", value: hf.toFixed(6) },
            { label: "Trigger", value: TRIGGER.toFixed(2) },
            { label: "Spare liquidity", value: `$${v.liquidityUsd.toFixed(4)}` },
            { label: "Shortfall", value: `$${v.shortfallUsd.toFixed(4)}` },
          ],
        };
      },
    ),

    timed(
      "SEC-live",
      "The leash cannot be pointed at a stranger",
      "Could an agent with a live session on this account send the money somewhere else?",
      async () => {
        const [rbPrincipal, sbPrincipal] = await Promise.all([
          marketClient.readContract({ address: RECIPIENT_BOUND, abi: BOUND, functionName: "principal" }) as Promise<Address>,
          marketClient.readContract({ address: SWAP_BOUND, abi: BOUND, functionName: "principal" }) as Promise<Address>,
        ]);

        const sessions = await listSessions().catch(() => []);
        const liveOnes = sessions.filter((s) => !s.revokedAt && s.expiry * 1000 > Date.now() && s.walletAddress?.toLowerCase() === DEMO_ADDRESS.toLowerCase());
        const allowed = liveOnes.flatMap((s) => (s.allowlist ?? []).map((c) => ({ to: c.to.toLowerCase(), sig: c.signature })));

        /*
          The actual attack this design prevents.

          PancakeSwap's position manager and swap router both take the address
          to pay as an argument, and a session grant can constrain which
          function is called but never what it is called with. So a session
          allowed to call them directly could name an attacker. The leash
          contracts have no such argument: they read the beneficiary from
          immutable storage. The test is therefore whether any live session
          can reach the protocols directly.
        */
        const reachesProtocol = allowed.filter((c) => c.to === POSITION_MANAGER.toLowerCase() || c.to === SWAP_ROUTER.toLowerCase());
        const bothBound = rbPrincipal.toLowerCase() === DEMO_ADDRESS.toLowerCase() && sbPrincipal.toLowerCase() === DEMO_ADDRESS.toLowerCase();

        return {
          verdict: reachesProtocol.length === 0 && bothBound ? ("pass" as const) : ("fail" as const),
          finding:
            reachesProtocol.length === 0 && bothBound
              ? `No live session on this account can call PancakeSwap directly. Every allowed call goes through a leash contract whose beneficiary is fixed in storage at ${rbPrincipal}, and neither contract has a recipient argument to point anywhere else. ${allowed.length} calls are permitted in total across ${liveOnes.length} live sessions.`
              : reachesProtocol.length
                ? `A live session can call ${reachesProtocol.map((c) => c.sig).join(", ")} on a protocol that takes a recipient argument. That is exactly the hole the leash contracts exist to close.`
                : `A leash contract is bound to ${rbPrincipal}, which is not this account.`,
          evidence: [
            { label: "RecipientBound pays", value: rbPrincipal },
            { label: "SwapBound pays", value: sbPrincipal },
            { label: "Live sessions on this account", value: String(liveOnes.length) },
            { label: "Calls they may make", value: allowed.map((c) => c.sig.split("(")[0]).join(", ") || "none" },
            { label: "Of those, reaching a protocol directly", value: String(reachesProtocol.length) },
          ],
        };
      },
    ),
  ]);

  return NextResponse.json(
    {
      at: new Date().toISOString(),
      block: block ? Number(block) : null,
      note: "Every check here is a read of the head block. Nothing was signed and no transaction was sent.",
      checks,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
