/**
 * Drives the market so the floor has something real to show.
 *
 * This is not mock data. It opens real mandates, posts real bonds from real
 * agent accounts, settles real epochs and slashes real balances against a
 * deployed contract. On anvil it runs against a local chain; point it at BSC
 * and the same script drives mainnet.
 *
 *   npm run floor
 *
 * Agents are given distinct temperaments — a steady outperformer, a volatile
 * one, one that decays — because a floor where everyone performs identically
 * shows nothing. The alpha each produces is drawn from its own distribution,
 * then reported by the adjudicator exactly as a real settlement would be.
 */

import { formatEther, parseEther, type Address, type Hex } from "viem";
import {
  MANDATE_MARKET_ABI,
  MARKET_ADDRESS,
  bnb,
  marketChain,
  marketClient,
  readLiveMandates,
  walletFor,
} from "@/lib/chain/market";

if (!MARKET_ADDRESS) {
  console.error("MARKET_ADDRESS is not set. Deploy the contract first:");
  console.error("  cd contracts && forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast");
  process.exit(1);
}

/** anvil's deterministic accounts. On a real chain these come from env. */
const ANVIL_KEYS: Hex[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // 0 deployer / adjudicator
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // 1 principal
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // 2 agent
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // 3 agent
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // 4 agent
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", // 5 agent
];

const key = (i: number): Hex => (process.env[`KEY_${i}`] as Hex) ?? ANVIL_KEYS[i];

const adjudicator = walletFor(key(0));
const principal = walletFor(key(1));

interface Persona {
  name: string;
  wallet: ReturnType<typeof walletFor>;
  /** Mean alpha in bps per epoch. */
  mean: number;
  /** Standard deviation in bps. */
  sigma: number;
  /** Per-epoch drift applied to the mean, for agents that decay or improve. */
  drift: number;
  target: number;
  bond: bigint;
}

const AGENTS: Persona[] = [
  {
    name: "Meridian",
    wallet: walletFor(key(2)),
    mean: 180,
    sigma: 90,
    drift: 0,
    target: 150,
    bond: parseEther("2"),
  },
  {
    name: "Corvus",
    wallet: walletFor(key(3)),
    mean: 220,
    sigma: 420,
    drift: 0,
    target: 300,
    bond: parseEther("3"),
  },
  {
    name: "Halcyon",
    wallet: walletFor(key(4)),
    mean: 260,
    sigma: 120,
    drift: -90, // decays: strong early, then gives it back
    target: 250,
    bond: parseEther("2.5"),
  },
  {
    name: "Ferrous",
    wallet: walletFor(key(5)),
    mean: 60,
    sigma: 70,
    drift: 12,
    target: 80,
    bond: parseEther("1.5"),
  },
];

const CATEGORIES = [0, 1, 2, 3] as const;
const CATEGORY_NAMES = ["Rebalancing", "Grid Trading", "Yield Optimisation", "Health Factor"];

const EPOCH_SECONDS = 60;
const isLocal = marketChain.id === 31337;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** Box-Muller, so alpha is drawn from a distribution rather than a shuffle. */
function gaussian(mean: number, sigma: number) {
  const u = Math.max(Math.random(), 1e-9);
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.round(mean + z * sigma);
}

async function advanceTime(seconds: number) {
  if (!isLocal) return; // real chains keep their own time
  await marketClient.request({
    method: "evm_increaseTime" as never,
    params: [seconds] as never,
  });
  await marketClient.request({ method: "evm_mine" as never, params: [] as never });
}

async function send(
  wallet: ReturnType<typeof walletFor>,
  functionName: string,
  args: unknown[],
  value?: bigint,
) {
  const hash = await wallet.writeContract({
    address: MARKET_ADDRESS,
    abi: MANDATE_MARKET_ABI,
    functionName,
    args,
    value,
    chain: marketChain,
    account: wallet.account!,
  } as never);
  return marketClient.waitForTransactionReceipt({ hash });
}

async function openAndStaff(category: number, capital: bigint, holderIndex: number) {
  const receipt = await send(
    principal,
    "openMandate",
    [category, 200, 2_000, 2_500, EPOCH_SECONDS, 8],
    capital,
  );
  const count = await marketClient.readContract({
    address: MARKET_ADDRESS,
    abi: MANDATE_MARKET_ABI,
    functionName: "mandateCount",
  });
  const id = Number(count) - 1;
  log(
    `mandate ${id} opened · ${CATEGORY_NAMES[category]} · ${formatEther(capital)} BNB` +
      ` · block ${receipt.blockNumber}`,
  );

  // Every agent bids. Losing bids stay live as the succession queue, which is
  // what makes dismissal instant rather than a re-tender.
  for (const a of AGENTS) {
    await send(a.wallet, "bid", [BigInt(id), a.target], a.bond);
    log(`  ${a.name} bids ${formatEther(a.bond)} BNB @ +${(a.target / 100).toFixed(2)}%`);
  }

  // A different manager per mandate. Awarding purely on the highest committed
  // target hands every mandate to the same agent, which is a market with one
  // participant — the succession queue is where the competition lives.
  const idx = holderIndex % AGENTS.length;
  await send(principal, "award", [BigInt(id), BigInt(idx)]);
  log(`  awarded to ${AGENTS[idx].name}`);
  return id;
}

function personaFor(agentAddress: string): Persona | undefined {
  return AGENTS.find(
    (a) => a.wallet.account!.address.toLowerCase() === agentAddress.toLowerCase(),
  );
}

async function settleAll(epochIndex: number) {
  const { live: mandates } = await readLiveMandates();
  for (const m of mandates) {
    if (m.state !== 1) continue; // Active only
    if (m.epochsSettled >= m.epochsTotal) continue;

    const persona = personaFor(m.agent);
    if (!persona) continue;

    // Drift is a tendency, not a ramp. Left uncapped it compounded across
    // hundreds of epochs into alpha no market would produce.
    const drift = Math.max(-600, Math.min(600, persona.drift * (epochIndex % 12)));
    const mean = persona.mean + drift;
    const alpha = Math.max(-9_000, Math.min(9_000, gaussian(mean, persona.sigma)));

    try {
      const receipt = await send(adjudicator, "settleEpoch", [BigInt(m.id), BigInt(alpha)]);
      const dismissed = receipt.logs.length > 1;
      log(
        `  mandate ${m.id} · ${persona.name} · ${alpha >= 0 ? "+" : ""}${(alpha / 100).toFixed(2)}%` +
          (dismissed ? "  ← settled with consequences" : ""),
      );
    } catch (error) {
      log(`  mandate ${m.id} settle failed: ${String(error).slice(0, 90)}`);
    }
  }
}

async function report() {
  const { live: mandates, total } = await readLiveMandates();
  const active = mandates.filter((m) => m.state === 1);
  const capital = mandates.reduce((s, m) => s + m.capital, 0n);
  const bonded = mandates.reduce((s, m) => s + m.bond, 0n);
  log(
    `— ${active.length} active · ${total} opened all-time · ` +
      `${bnb(capital)} BNB under mandate · ${bnb(bonded)} BNB bonded`,
  );
}

// ---------------------------------------------------------------------------

log(`floor simulation · chain ${marketChain.id} · market ${MARKET_ADDRESS}`);

const { total: existing } = await readLiveMandates();
if (existing === 0) {
  log("no mandates yet — opening one per category");
  for (const c of CATEGORIES) {
    await openAndStaff(c, parseEther(String(8 + c * 4)), c);
  }
}

/**
 * Retires finished mandates and opens replacements, so the floor is a running
 * market rather than one cohort that plays out and stops. A completed term
 * returns capital to the principal and releases every bond; the replacement
 * re-tenders from scratch.
 */
async function recycle(nextCategory: number) {
  const { live: mandates } = await readLiveMandates();
  let opened = 0;
  for (const m of mandates) {
    const finished = m.epochsSettled >= m.epochsTotal;
    const stalled = m.state === 0; // dismissed with nobody to take over
    if (m.state === 2 || m.state === 3) continue;
    if (!finished && !stalled) continue;
    try {
      await send(principal, "closeMandate", [BigInt(m.id)]);
      log(`  mandate ${m.id} closed · capital returned, bonds released`);
      const c = (nextCategory + opened) % 4;
      await openAndStaff(c, parseEther(String(6 + Math.floor(Math.random() * 14))), c);
      opened += 1;
    } catch (error) {
      log(`  recycle failed for ${m.id}: ${String(error).slice(0, 80)}`);
    }
  }
  return opened;
}

let epoch = 0;
for (;;) {
  await advanceTime(EPOCH_SECONDS + 5);
  log(`epoch ${epoch}`);
  await settleAll(epoch);
  await recycle(epoch);
  await report();
  epoch += 1;

  // On a local chain, keep the floor moving. On a real chain, epochs are real.
  await new Promise((r) => setTimeout(r, isLocal ? 4_000 : EPOCH_SECONDS * 1000));
}
