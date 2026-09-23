/**
 * Three of the six locked tasks, asked again of the chain as it is right now.
 *
 * The locked report measures a fixed 24,000 block window and needs an archive
 * node, which a request from a browser cannot use inside a function's time
 * budget. These three need no history: they are the same questions asked of
 * the head block, so a reader can watch the measurement happen instead of
 * trusting a file from earlier in the month. /proof runs them on a button, and
 * the definition of done runs them on the clock.
 *
 * Everything here is a read. No transaction is sent and nothing is signed.
 */

import { parseAbi, type Address } from "viem";
import { marketClient } from "@/lib/chain/market";
import { diagnose } from "@/lib/diagnose";
import { readVenus } from "@/lib/diagnose/positions";
import { RECIPIENT_BOUND, SWAP_BOUND, POSITION_MANAGER, SWAP_ROUTER } from "@/lib/chain/leash";
import { listSessions } from "@/lib/chain/session-store";
import { GUARD } from "@/lib/house/venus";
import { VUSDT } from "@/lib/venus/rates";
import { DEMO_ADDRESS } from "@/lib/demo";
import { withTimeout } from "@/lib/cache";

const BOUND = parseAbi(["function principal() view returns (address)"]);

/*
  Venus calls that can only act for the account that sends them: repay its
  own loan, supply for itself, withdraw to itself. None takes an address.
*/
const SELF_ONLY = new Set([`${VUSDT.toLowerCase()}:repayBorrow(uint256)`, `${VUSDT.toLowerCase()}:mint(uint256)`, `${VUSDT.toLowerCase()}:redeemUnderlying(uint256)`]);

export interface Check {
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

export interface Rerun {
  at: string;
  block: number | null;
  note: string;
  checks: Check[];
}

export async function rerunChecks(): Promise<Rerun> {
  const block = await withTimeout(marketClient.getBlockNumber().catch(() => null), 6_000);

  const checks = await Promise.all([
    timed(
      "T1",
      "Liquidity that has stopped earning",
      "Right now, how much of this account's PancakeSwap liquidity is outside its range and earning nothing?",
      async () => {
        const d = await diagnose(DEMO_ADDRESS);
        if (!d) return { verdict: "inconclusive" as const, finding: "The position reader returned nothing.", evidence: [] };
        const out = d.findings.filter((f) => f.kind === "out-of-range");
        const total = d.findings.filter((f) => f.kind === "out-of-range" || f.kind === "in-range").length;
        const at = Number(d.blockNumber).toLocaleString("en-GB");
        return {
          verdict: "pass" as const,
          finding: out.length
            ? `${out.length} of ${total} open positions on this account are out of range at block ${at}. Each one earns no fees until somebody moves it, which is the job a rebalancing agent is hired for.`
            : total
              ? `All ${total} open positions on this account are in range at block ${at}, so a rebalancing agent has nothing to do this second.`
              : `This account holds no open PancakeSwap position at block ${at}.`,
          evidence: [
            { label: "Account", value: DEMO_ADDRESS },
            { label: "Block", value: at },
            ...out.slice(0, 3).map((f, i) => ({ label: `Out of range ${i + 1}`, value: f.title })),
          ],
        };
      },
    ),

    timed(
      "T4",
      "Being early against being liquidated",
      "What is this account's Venus health factor at the head block, and would Guard-1 act on it?",
      async () => {
        const v = await readVenus(DEMO_ADDRESS as Address);
        if (!v) return { verdict: "inconclusive" as const, finding: "Venus did not answer.", evidence: [] };
        const hf = v.healthFactor;
        if (hf === null || hf === undefined) {
          return {
            verdict: "pass" as const,
            finding: "This account has no Venus debt right now, so it has no health factor. That is not the same as being healthy, and it is not printed as a number.",
            evidence: [{ label: "Markets entered", value: String(v.assetsIn) }],
          };
        }
        return {
          verdict: "pass" as const,
          finding:
            hf < GUARD.trigger
              ? `The health factor is ${hf.toFixed(4)}, under Guard-1's ${GUARD.trigger.toFixed(2)} trigger, so it repays part of this account's own loan on its next turn. Repaying costs a few cents of gas. Being liquidated costs a share of the seized collateral.`
              : `The health factor is ${hf.toFixed(4)}, above Guard-1's ${GUARD.trigger.toFixed(2)} trigger, so it does nothing. It acts only under the trigger, and all it can do is repay.`,
          evidence: [
            { label: "Health factor now", value: hf.toFixed(6) },
            { label: "Guard-1's trigger", value: GUARD.trigger.toFixed(2) },
            { label: "Spare borrowing power", value: `$${v.liquidityUsd.toFixed(4)}` },
            { label: "Shortfall", value: `$${v.shortfallUsd.toFixed(4)}` },
          ],
        };
      },
    ),

    timed(
      "Leash",
      "An agent's leash cannot be pointed at a stranger",
      "Could an agent holding a live session on this account send its money anywhere else?",
      async () => {
        const [rbPrincipal, sbPrincipal] = await Promise.all([
          marketClient.readContract({ address: RECIPIENT_BOUND, abi: BOUND, functionName: "principal" }) as Promise<Address>,
          marketClient.readContract({ address: SWAP_BOUND, abi: BOUND, functionName: "principal" }) as Promise<Address>,
        ]);
        const sessions = await listSessions();
        const live = sessions.filter((s) => !s.revokedAt && s.expiry * 1000 > Date.now() && s.walletAddress?.toLowerCase() === DEMO_ADDRESS.toLowerCase());
        const allowed = live.flatMap((s) => (s.allowlist ?? []).map((c) => ({ to: c.to.toLowerCase(), sig: c.signature })));

        /*
          The attack this design exists to prevent. PancakeSwap's position
          manager and router both take the address to pay as an argument, and
          a session grant can fix which function is called but never what it
          is called with. A session allowed to call them directly could name
          anyone. The leash contracts read the beneficiary from immutable
          storage instead, and the Venus calls act only for the sender.
        */
        const leashed = new Set([RECIPIENT_BOUND.toLowerCase(), SWAP_BOUND.toLowerCase()]);
        const direct = allowed.filter((c) => c.to === POSITION_MANAGER.toLowerCase() || c.to === SWAP_ROUTER.toLowerCase());
        const unknown = allowed.filter((c) => !leashed.has(c.to) && !SELF_ONLY.has(`${c.to}:${c.sig}`) && !direct.includes(c));
        const bound = rbPrincipal.toLowerCase() === DEMO_ADDRESS.toLowerCase() && sbPrincipal.toLowerCase() === DEMO_ADDRESS.toLowerCase();
        const held = !direct.length && !unknown.length && bound;
        const viaLeash = allowed.filter((c) => leashed.has(c.to)).length;

        return {
          verdict: held ? ("pass" as const) : ("fail" as const),
          finding: !live.length && bound
            ? "No session on this account is live right now, so no agent can move anything from it."
            : held
            ? `No live session on this account can pay anyone but the account. ${viaLeash} of the ${allowed.length} calls its ${live.length} live sessions may make go through a leash contract that pays ${rbPrincipal} and has no recipient argument; the other ${allowed.length - viaLeash} are Venus calls that can only repay, supply or withdraw for the account itself.`
            : direct.length
              ? `A live session may call ${direct.map((c) => c.sig).join(", ")} on a PancakeSwap contract that takes a recipient argument. That is the hole the leash contracts exist to close.`
              : unknown.length
                ? `A live session may call ${unknown.map((c) => c.sig).join(", ")}, which this check does not recognise as bound to the account.`
                : `A leash contract pays ${rbPrincipal.toLowerCase() === DEMO_ADDRESS.toLowerCase() ? sbPrincipal : rbPrincipal}, which is not this account.`,
          evidence: [
            { label: "RecipientBound pays", value: rbPrincipal },
            { label: "SwapBound pays", value: sbPrincipal },
            { label: "Live sessions on this account", value: String(live.length) },
            { label: "Calls they may make", value: [...new Set(allowed.map((c) => c.sig.split("(")[0]))].join(", ") || "none" },
            { label: "Calls reaching PancakeSwap directly", value: String(direct.length) },
          ],
        };
      },
    ),
  ]);

  return {
    at: new Date().toISOString(),
    block: block ? Number(block) : null,
    note: "Every check here is a read of the head block. Nothing was signed and no transaction was sent.",
    checks,
  };
}
