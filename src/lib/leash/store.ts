/**
 * Leashes users granted, and what our agents did under them.
 *
 * A leash is recorded only after the chain shows it: the session key our
 * agent holds is valid in the KeyStore for that wallet, with the expiry the
 * user chose. A revoke is recorded only once the chain shows the key invalid.
 */

import type { Address } from "viem";
import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";
import { readKey } from "@/lib/chain/keystore";
import { sessionPublicFor } from "./keys";
import type { LeashSlug } from "./policy";

export interface UserLeash {
  id: string;
  wallet: string;
  slug: LeashSlug;
  owner: string | null;
  keyId: string;
  publicKey: string;
  dailyUsdt: string;
  expiry: number;
  grantedAt: string;
  revokedAt: string | null;
  revokeTx: string | null;
}

export interface LeashRun {
  at: string;
  outcome: string;
  reason: string;
  readings: Record<string, unknown>;
  txs: { step: string; tx: string }[];
}

type Row = {
  id: string;
  wallet: string;
  slug: string;
  owner: string | null;
  key_id: string;
  public_key: string;
  daily_usdt: string;
  expiry: string | number;
  granted_at: Date | string;
  revoked_at: Date | string | null;
  revoke_tx: string | null;
};
const iso = (d: Date | string) => (typeof d === "string" ? d : d.toISOString());
const toLeash = (r: Row): UserLeash => ({
  id: r.id,
  wallet: r.wallet,
  slug: r.slug as LeashSlug,
  owner: r.owner,
  keyId: r.key_id,
  publicKey: r.public_key,
  dailyUsdt: r.daily_usdt,
  expiry: Number(r.expiry),
  grantedAt: iso(r.granted_at),
  revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
  revokeTx: r.revoke_tx,
});

export const leashId = (wallet: string, slug: string) => `${slug}:${wallet.toLowerCase()}`;

/** Records a leash once the KeyStore shows our agent's key valid on the wallet. */
export async function recordLeash(opts: { wallet: Address; slug: LeashSlug; owner: Address | null; dailyUsdt: number }): Promise<{ leash: UserLeash } | { refused: string; status: number }> {
  if (!pg) return { refused: "This deployment keeps no database.", status: 503 };
  const pub = sessionPublicFor(opts.wallet, opts.slug);
  if (!pub) return { refused: "This deployment holds no leash key.", status: 503 };
  const entry = await readKey(opts.wallet, pub.keyId).catch(() => null);
  if (!entry) return { refused: "The KeyStore could not be read just now.", status: 503 };
  if (!entry.valid || !entry.expiry) return { refused: "The chain does not show this leash yet. Grant it first, then try again once it confirms.", status: 409 };
  await ensureTables();
  const id = leashId(opts.wallet, opts.slug);
  await pg`
    insert into user_leashes (id, wallet, slug, owner, key_id, public_key, daily_usdt, expiry)
    values (${id}, ${opts.wallet.toLowerCase()}, ${opts.slug}, ${opts.owner?.toLowerCase() ?? null}, ${pub.keyId}, ${pub.publicKey}, ${String(opts.dailyUsdt)}, ${entry.expiry})
    on conflict (id) do update set expiry = excluded.expiry, daily_usdt = excluded.daily_usdt, owner = coalesce(excluded.owner, user_leashes.owner),
      granted_at = now(), revoked_at = null, revoke_tx = null
  `;
  return { leash: (await leashById(id))! };
}

/** Marks a leash revoked, once the KeyStore agrees the key is no longer valid. */
export async function recordRevoke(wallet: Address, slug: LeashSlug, tx: string | null): Promise<{ leash: UserLeash } | { refused: string; status: number }> {
  if (!pg) return { refused: "This deployment keeps no database.", status: 503 };
  const pub = sessionPublicFor(wallet, slug);
  if (!pub) return { refused: "This deployment holds no leash key.", status: 503 };
  const entry = await readKey(wallet, pub.keyId).catch(() => null);
  if (!entry) return { refused: "The KeyStore could not be read just now.", status: 503 };
  if (entry.valid) return { refused: "The chain still shows this leash as valid.", status: 409 };
  await ensureTables();
  const id = leashId(wallet, slug);
  await pg`update user_leashes set revoked_at = coalesce(revoked_at, now()), revoke_tx = coalesce(revoke_tx, ${tx}) where id = ${id}`;
  const leash = await leashById(id);
  return leash ? { leash } : { refused: "No leash on record for that wallet.", status: 404 };
}

export async function leashById(id: string): Promise<UserLeash | null> {
  if (!pg) return null;
  await ensureTables();
  const [r] = (await pg`select * from user_leashes where id = ${id}`) as Row[];
  return r ? toLeash(r) : null;
}

/** Leashes on a wallet, or granted from an owner's main wallet. */
export async function leashesOf(address: string): Promise<UserLeash[]> {
  if (!pg) return [];
  await ensureTables();
  const a = address.toLowerCase();
  const rows = (await pg`select * from user_leashes where wallet = ${a} or owner = ${a} order by granted_at desc`) as Row[];
  return rows.map(toLeash);
}

export async function activeLeashes(): Promise<UserLeash[]> {
  if (!pg) return [];
  await ensureTables();
  const now = Math.floor(Date.now() / 1000);
  const rows = (await pg`select * from user_leashes where revoked_at is null and expiry > ${now} order by granted_at asc limit 200`) as Row[];
  return rows.map(toLeash);
}

export async function recordLeashRun(leashId: string, run: Omit<LeashRun, "at">): Promise<void> {
  if (!pg) return;
  await ensureTables();
  await pg`
    insert into leash_runs (leash_id, outcome, reason, readings, txs)
    values (${leashId}, ${run.outcome}, ${run.reason}, ${JSON.stringify(run.readings)}::jsonb, ${JSON.stringify(run.txs)}::jsonb)
  `;
}

export async function runsOfLeash(leashId: string, limit = 20): Promise<LeashRun[]> {
  if (!pg) return [];
  await ensureTables();
  const rows = (await pg`select at, outcome, reason, readings, txs from leash_runs where leash_id = ${leashId} order by at desc limit ${limit}`) as {
    at: Date | string;
    outcome: string;
    reason: string;
    readings: Record<string, unknown>;
    txs: { step: string; tx: string }[];
  }[];
  return rows.map((r) => ({ ...r, at: iso(r.at) }));
}

/** What its live turns moved in the last day, for the daily cap. */
export async function movedTodayOn(leashId: string): Promise<LeashRun[]> {
  if (!pg) return [];
  await ensureTables();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const rows = (await pg`select at, outcome, reason, readings, txs from leash_runs where leash_id = ${leashId} and outcome = 'acted' and at > ${since}`) as {
    at: Date | string;
    outcome: string;
    reason: string;
    readings: Record<string, unknown>;
    txs: { step: string; tx: string }[];
  }[];
  return rows.map((r) => ({ ...r, at: iso(r.at) }));
}
