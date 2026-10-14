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
  "0xa489017f4d8fb528c404041e6cb8497805a1310a": "Passkey wallet the leash test created from the test wallet",
  // Passkey wallets our own end-to-end runs made in a test browser on 11 Oct, funded with test tokens from the market owner: testnet jobs 1434 to 1439.
  "0xf8041c8e26b76f887ef62f25980aa60eb88a375a": "Passkey wallet from our passkey-ui test run (testnet jobs 1434, 1435)",
  "0x6d3f9293334f6d38cf975369748bf1939bfe3680": "Passkey wallet from our phone screenshot run (testnet jobs 1436, 1437)",
  "0x056c6bdcd2be6c7a469019c3a9e00a3a4134d2ce": "Passkey wallet from our phone screenshot run (testnet jobs 1438, 1439)",
  "0xf2e72df2d0a2ede03ce22d40ba1c70202e6ffcab": "Passkey wallet from an interrupted phone screenshot run (funded, no hires)",
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
