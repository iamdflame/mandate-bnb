/**
 * Taking our own escrowed jobs to their end, on the day they mature.
 *
 * An ERC-8183 job does not finish itself. A provider that delivered is paid
 * only when somebody calls settle after the dispute window, and a provider
 * that never delivered keeps the escrow until somebody claims the refund. Both
 * of those days fall whenever they fall, which is no use if the only person
 * who can act is asleep, so the scheduled tick does it.
 *
 * The rules are the ones the site publishes:
 *   - a deliverable is checked against its on-chain commitment first, and a
 *     job whose commitment nobody can reproduce is never settled;
 *   - a job we disputed is left alone;
 *   - money only ever moves back to us, or to a provider that delivered.
 *
 * Capped per run, and it reports what it did so the schedule's record shows
 * the money moving rather than a claim that it did.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Address, Hex } from "viem";
import { verifyDeliverable } from "@/lib/market/deliverable";

const HIRES = join(process.cwd(), "src/data/hires.json");
/** The policy's optimistic window: a provider is paid this long after submitting. */
const DISPUTE_WINDOW_S = 604_800;

interface Hire {
  jobId: string;
  who?: string;
  delivery?: { url?: string };
  deliverable?: { url?: string };
  disputed?: { at: string };
}

export interface SweepAction {
  jobId: string;
  who: string;
  did: "refund" | "settle" | "nothing";
  why: string;
  tx?: string | null;
}

type Sdk = {
  BNB: unknown;
  signerFromPrivateKey: (k: Hex) => unknown;
  getErc8183Job: (n: unknown, id: bigint) => Promise<Record<string, unknown>>;
  getErc8183DeliverableUrl: (n: unknown, id: bigint) => Promise<string>;
  settleErc8183Job: (w: { address: Address }, s: unknown, p: { jobId: bigint; action?: "approve" | "dispute" }, o: { network: unknown }) => Promise<{ transactionHash?: Hex; status: string }>;
  buildClaimRefundCall: (chainId: number, jobId: bigint) => { to: Address; data: Hex; value?: bigint };
  createClient: (o: { chains: unknown[] }) => { execute: (o: Record<string, unknown>) => Promise<{ transactionHash?: Hex; status: string }> };
};

function hires(): Hire[] {
  try {
    return (JSON.parse(readFileSync(HIRES, "utf8")) as { hires?: Hire[] }).hires ?? [];
  } catch {
    return [];
  }
}

export function sweeperOn(): boolean {
  return (process.env.SWEEPER ?? "on").toLowerCase() !== "off" && Boolean(process.env.PRIVATE_KEY);
}

/**
 * Settles what has delivered and refunds what has expired, up to `max` actions.
 *
 * `dry` reads and decides without sending anything, which is what the plan
 * mode of the operator's script does and what the tick does when the sweeper
 * is switched off.
 */
export async function sweepOurJobs(opts: { max?: number; dry?: boolean } = {}): Promise<{ actions: SweepAction[]; checked: number }> {
  const max = opts.max ?? 2;
  const list = hires();
  const actions: SweepAction[] = [];
  if (!list.length) return { actions, checked: 0 };

  const key = process.env.PRIVATE_KEY;
  if (!key) return { actions: [{ jobId: "-", who: "-", did: "nothing", why: "no key on this deployment" }], checked: 0 };
  const pk = (key.startsWith("0x") ? key : `0x${key}`) as Hex;
  const sdk = (await import("@altananetwork/sdk")) as unknown as Sdk;
  const { privateKeyToAccount } = await import("viem/accounts");
  const me = privateKeyToAccount(pk).address;
  const now = Math.floor(Date.now() / 1000);
  let checked = 0;
  let sent = 0;

  for (const h of list) {
    if (sent >= max) break;
    const jobId = BigInt(h.jobId);
    const who = h.who ?? `job ${h.jobId}`;
    const job = await sdk.getErc8183Job(sdk.BNB, jobId).catch(() => null);
    if (!job) continue;
    checked += 1;
    const status = String(job.statusName ?? job.status);
    const expired = now > Number(job.expiredAt);
    const submittedAt = Number(job.submittedAt ?? 0);
    const windowPassed = submittedAt > 0 && now > submittedAt + DISPUTE_WINDOW_S;

    if (status === "FUNDED" && expired) {
      if (opts.dry) {
        actions.push({ jobId: h.jobId, who, did: "nothing", why: "expired and unfunded work: a refund is due" });
        continue;
      }
      const call = sdk.buildClaimRefundCall(56, jobId);
      const client = sdk.createClient({ chains: [sdk.BNB] });
      const r = await client.execute({ wallet: { address: me }, signer: sdk.signerFromPrivateKey(pk), calls: [call] }).catch((e: Error) => ({ transactionHash: undefined, status: e.message.split("\n")[0].slice(0, 120) }));
      sent += 1;
      actions.push({ jobId: h.jobId, who, did: "refund", why: "it expired without the provider submitting", tx: r.transactionHash ?? null });
      continue;
    }

    if (status === "SUBMITTED" && windowPassed && !h.disputed) {
      const url = (await sdk.getErc8183DeliverableUrl(sdk.BNB, jobId).catch(() => null)) ?? h.delivery?.url ?? h.deliverable?.url ?? null;
      const check = await verifyDeliverable(url, String(job.deliverable ?? ""));
      if (!check.matchedAs) {
        actions.push({ jobId: h.jobId, who, did: "nothing", why: check.error ? `its deliverable could not be read: ${check.error}` : "no reading of its deliverable reproduces the commitment, so it is not settled" });
        continue;
      }
      if (opts.dry) {
        actions.push({ jobId: h.jobId, who, did: "nothing", why: `delivered and verified (${check.matchedAs}); a settlement is due` });
        continue;
      }
      const r = await sdk
        .settleErc8183Job({ address: me }, sdk.signerFromPrivateKey(pk), { jobId, action: "approve" }, { network: sdk.BNB })
        .catch((e: Error) => ({ transactionHash: undefined, status: e.message.split("\n")[0].slice(0, 120) }));
      sent += 1;
      actions.push({ jobId: h.jobId, who, did: "settle", why: `its deliverable matches the commitment (${check.matchedAs})`, tx: r.transactionHash ?? null });
    }
  }

  return { actions, checked };
}
