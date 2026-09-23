/**
 * What a session may do, in words a person reads in three seconds.
 *
 * A session grant is a contract address and a function selector. That is the
 * truth and it is unreadable, so each allowed call gets a plain sentence here,
 * and the selector stays one click away for anyone who wants to check it. The
 * CANNOT list is not decoration: each line is enforced by the leash contracts
 * (no recipient argument exists to point anywhere else), the session allowlist
 * (no other contract can be called), the account guard (daily caps) or the
 * session expiry.
 */

const CONTRACT: Record<string, string> = {
  "0x5863edaede7394470db19395ca05b1439662952e": "RecipientBound",
  "0x1cf9c5e9339e99e3bfd45f117ca17e6e1a4e59d1": "SwapBound",
  "0xfd5840cd36d94d7229439859c0112a4185bc0255": "Venus vUSDT",
};

const WORDS: Record<string, Record<string, string>> = {
  RecipientBound: {
    mint: "Open a new LP position, owned by you",
    increaseLiquidity: "Add liquidity to your LP position",
    decreaseLiquidity: "Take liquidity out of your LP position",
    collect: "Collect fees and tokens, paid to you",
  },
  SwapBound: {
    swap: "Swap WBNB and USDT, proceeds paid to you",
  },
  "Venus vUSDT": {
    mint: "Supply USDT to Venus",
    redeemUnderlying: "Withdraw your USDT from Venus",
    repayBorrow: "Repay your Venus USDT debt",
  },
};

export interface Allowed {
  /** The sentence. */
  words: string;
  /** Where and what exactly, for the reader who checks. */
  contract: string;
  address: string;
  signature: string;
}

export function allowedCalls(allowlist: { to: string; signature: string }[]): Allowed[] {
  return allowlist.map((c) => {
    const contract = CONTRACT[c.to.toLowerCase()] ?? `${c.to.slice(0, 6)}…${c.to.slice(-4)}`;
    const fn = c.signature.split("(")[0];
    return {
      words: WORDS[contract]?.[fn] ?? `Call ${fn} on ${contract}`,
      contract,
      address: c.to,
      signature: c.signature,
    };
  });
}

/** What no session granted here can do, whatever it is allowed to call. */
export const CANNOT = [
  "Send your funds to any other address",
  "Call any contract outside this list",
  "Spend more than its daily cap",
  "Act after the session expires",
];

/** Daily caps from a session's `permissions.spend`, as a person reads them. */
export function capsOf(permissions: unknown): string[] {
  const spend = ((permissions as { spend?: { limit?: string; token?: string; period?: string }[] } | null)?.spend ?? []) as {
    limit?: string;
    token?: string;
    period?: string;
  }[];
  const TOKEN: Record<string, string> = {
    "0x55d398326f99059ff775485246999027b3197955": "USDT",
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "WBNB",
  };
  return spend.map((s) => {
    const amount = Number(s.limit ?? 0) / 1e18;
    const unit = s.token ? (TOKEN[s.token.toLowerCase()] ?? `${s.token.slice(0, 6)}…`) : "BNB";
    return `${amount.toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${unit} a ${s.period ?? "day"}`;
  });
}
