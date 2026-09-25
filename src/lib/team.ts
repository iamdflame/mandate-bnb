/**
 * Every wallet MANDATE operates, declared.
 *
 * BNB counts the quest from real users, and a hire from one of our own wallets
 * is not one. These are declared in the Phase 2 submission and flagged as
 * `team` in every tracking answer, so nothing we do ourselves can be counted as
 * somebody else's activity, even by accident.
 */

import { referenceRegistrations } from "@/lib/house";

const FIXED: Record<string, string> = {
  "0x54c06cc2623aaa2dcc38b17fa07ad2e99b363c90": "Market owner, our demo account, our house agents' account",
  "0x6f29b50ebaf733d980eadfeb3253347d8a12a69c": "Market adjudicator",
  "0xd6d11aa5046dc5c7be8d63b9223b60d7ad94cbe9": "House keeper A, and the sponsor of free trial calls",
  "0x090d19610cdb4d6bb011d9eb579910ac3296bb0a": "House keeper B",
  "0x003911a1dd39d21de18a4a54a8af8692cb62a301": "End-to-end test wallet",
};

/** Every team wallet, lowercase, with what it is for. */
export function teamWallets(): Record<string, string> {
  const out = { ...FIXED };
  for (const [slug, r] of Object.entries(referenceRegistrations())) {
    if (r.owner) out[r.owner.toLowerCase()] = `Owner of ${slug}'s ERC-8004 identity (#${r.tokenId})`;
  }
  return out;
}

export const isTeam = (wallet: string | null | undefined): boolean => Boolean(wallet && teamWallets()[wallet.toLowerCase()]);
