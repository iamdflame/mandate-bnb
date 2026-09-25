/**
 * The network this deployment runs on, stated once.
 *
 * BNB's rules count an unstated network against a marketplace, so the badge in
 * the header and footer reads from here. No imports, so the browser bundle can
 * carry it.
 */
const id = Number(process.env.NEXT_PUBLIC_MARKET_CHAIN_ID ?? process.env.CHAIN_ID ?? 56);

export const NETWORK = {
  chainId: id,
  name: id === 97 ? "BNB Smart Chain testnet" : "BNB Smart Chain mainnet",
  short: id === 97 ? "Testnet" : "Mainnet",
} as const;
