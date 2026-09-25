/**
 * The key our agent acts with on one user's wallet.
 *
 * Derived from a master secret and the wallet and agent, so it is the same on
 * every server and never stored: the browser grants a session to its public
 * key, and its private key never leaves our servers. A different wallet or
 * agent gets an unrelated key, so one leash can never be used on another.
 */

import { concat, keccak256, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

export function sessionKeyFor(wallet: Address, slug: string): Hex | null {
  const master = process.env.LEASH_MASTER_KEY;
  if (!master || !/^0x[0-9a-fA-F]{64}$/.test(master)) return null;
  const seed = BigInt(keccak256(concat([master as Hex, wallet.toLowerCase() as Hex, stringToHex(`mandate-leash:${slug}`)])));
  const k = (seed % (N - 1n)) + 1n;
  return `0x${k.toString(16).padStart(64, "0")}`;
}

/** What the browser needs to grant: the session key's address and public key, and no more. */
export function sessionPublicFor(wallet: Address, slug: string): { address: Address; publicKey: Hex; keyId: Hex } | null {
  const key = sessionKeyFor(wallet, slug);
  if (!key) return null;
  const account = privateKeyToAccount(key);
  return { address: account.address, publicKey: account.publicKey, keyId: keccak256(account.publicKey) };
}
