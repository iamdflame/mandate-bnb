/**
 * Runs an agent.
 *
 *   npm run agent -- grid --dry          observe and print, send nothing
 *   npm run agent -- health --dry
 *   npm run agent -- grid --mandate 2    act, through that mandate's session
 *
 * Dry is the default. A strategy that has never been read in dry mode should
 * not be trusted with a session key, and the printed output is deliberately
 * verbose about *why* each action was chosen — that reasoning is what the tape
 * and the Advantage Report quote later.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { encodeFunctionData, type Address } from "viem";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/config";
import { readPool, valueWallet } from "@/lib/chain/prices";
import { loadMeta } from "@/lib/chain/session";
import type { AgentContext, Decision, Strategy } from "./types";
import { gridStrategy } from "./grid";
import { healthStrategy } from "./health";
import { rebalanceStrategy } from "./rebalance";
import { yieldStrategy } from "./yield";

export const STRATEGIES: Record<Category, Strategy> = {
  "grid-trading": gridStrategy,
  "health-factor": healthStrategy,
  rebalancing: rebalanceStrategy,
  "yield-optimisation": yieldStrategy,
};

/** Short names, so the command line is not a category slug. */
const ALIASES: Record<string, Category> = {
  grid: "grid-trading",
  "grid-trading": "grid-trading",
  health: "health-factor",
  "health-factor": "health-factor",
  rebalance: "rebalancing",
  rebalancing: "rebalancing",
  yield: "yield-optimisation",
  "yield-optimisation": "yield-optimisation",
};

const STATE_DIR = ".agent-state";
const statePath = (c: Category) => `${STATE_DIR}/${c}.json`;

function loadState(c: Category): Record<string, unknown> {
  const p = statePath(c);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveState(c: Category, state: Record<string, unknown>) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(c), JSON.stringify(state, null, 2));
}

export async function buildContext(opts: {
  category: Category;
  wallet: Address;
  capWei: bigint;
  mandateId: number;
}): Promise<AgentContext> {
  const [price, valuation] = await Promise.all([readPool(), valueWallet(opts.wallet)]);
  return {
    mandateId: opts.mandateId,
    category: opts.category,
    wallet: opts.wallet,
    capWei: opts.capWei,
    price,
    valuation,
    state: loadState(opts.category),
    now: Date.now(),
  };
}

export function printDecision(strategy: Strategy, ctx: AgentContext, d: Decision) {
  const rule = "─".repeat(74);
  console.log(rule);
  console.log(`${strategy.name}  ·  ${CATEGORY_LABEL[strategy.id]}`);
  console.log(rule);
  console.log(strategy.describe());
  console.log();
  console.log(`  wallet     ${ctx.wallet}`);
  console.log(`  managing   ${ctx.valuation.bnb.toFixed(8)} BNB  ($${ctx.valuation.usd.toFixed(2)})`);
  console.log(`  spend cap  ${(Number(ctx.capWei) / 1e18).toFixed(8)} BNB`);
  console.log(`  BNB price  $${ctx.price.token0PerToken1.toFixed(2)}  (tick ${ctx.price.tick})`);
  console.log();
  console.log(`  observed   ${d.observed}`);
  console.log();

  if (d.actions.length === 0) {
    console.log("  no action this epoch");
  } else {
    for (const [i, a] of d.actions.entries()) {
      console.log(`  action ${i + 1}  ${a.kind.toUpperCase()}`);
      console.log(`    why      ${a.reason}`);
      console.log(`    expect   ${a.expect}`);
      console.log(`    to       ${a.call.address}`);
      console.log(`    call     ${a.call.functionName}`);
      if (a.value) console.log(`    value    ${(Number(a.value) / 1e18).toFixed(8)} BNB`);
      // Derived from the same call that will be sent, not a second encoding.
      const data = encodeFunctionData({
        abi: a.call.abi,
        functionName: a.call.functionName,
        args: a.call.args as never,
      });
      console.log(`    calldata ${data.slice(0, 34)}… (${(data.length - 2) / 2} bytes)`);
    }
  }
  console.log(rule);
}

// ---------------------------------------------------------------------------

const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const which = process.argv[2];
const dry = !process.argv.includes("--live");
const mandateId = Number(arg("--mandate") ?? 0);

if (!which || which.startsWith("--")) {
  console.error("usage: npm run agent -- <grid|health|rebalance|yield> [--mandate N] [--live]");
  console.error(`  strategies: ${CATEGORIES.join(", ")}`);
  process.exit(1);
}

const category = ALIASES[which];
if (!category) {
  console.error(`unknown strategy "${which}". one of: ${Object.keys(ALIASES).join(", ")}`);
  process.exit(1);
}

const strategy = STRATEGIES[category];

// The wallet the agent manages: the mandate's session wallet if one has been
// granted, otherwise the principal's own address for observation.
const session = mandateId ? loadMeta(mandateId) : null;
const wallet = (session?.walletAddress ??
  process.env.AGENT_A_ADDR ??
  "0x54c06cC2623aAA2Dcc38B17fA07aD2e99b363C90") as Address;
const capWei = session ? BigInt(session.capWei) : BigInt(process.env.AGENT_CAP_WEI ?? "500000000000000");

if (session) {
  const left = session.expiry - Math.floor(Date.now() / 1000);
  console.log(
    `session for mandate ${mandateId}: key ${session.sessionKey.slice(0, 12)}… · ` +
      `${session.allowlist.length} allowed calls · expires in ${Math.max(0, Math.round(left / 60))}min` +
      `${session.registered ? " · registered in KeyStore" : " · ephemeral"}\n`,
  );
} else if (mandateId) {
  console.log(`no session on file for mandate ${mandateId}; observing only\n`);
}

const ctx = await buildContext({ category, wallet, capWei, mandateId });
const decision = await strategy.evaluate(ctx);
printDecision(strategy, ctx, decision);
saveState(category, decision.state);

if (dry) {
  console.log("\ndry run — nothing was sent. add --live with a granted session to act.\n");
  process.exit(0);
}

if (!session) {
  console.error("refusing to act: --live needs a granted session (--mandate N).");
  process.exit(1);
}

console.error(
  "live execution through the session key is wired in the next step; " +
    "the actions above are what it will send.",
);
