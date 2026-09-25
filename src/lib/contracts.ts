/**
 * Every contract this marketplace reads from or asks you to sign against.
 *
 * BNB's Phase 2 rules ask a marketplace to show the addresses it reads, and a
 * buyer about to sign deserves the same list: what each contract is, what we
 * use it for, and where to check it. The addresses come from the modules that
 * use them, so this page cannot drift from the code that calls them.
 */

import { ERC8183_ADDRESSES } from "@altananetwork/sdk";
import { CHAIN_ID, IDENTITY_REGISTRY, PROTOCOLS } from "@/lib/config";
import { REPUTATION_REGISTRY } from "@/lib/chain/reputation";
import { MARKET_V2 } from "@/lib/chain/deployments";
import { KEYSTORE, KEYSTORE_CONTROLLER } from "@/lib/chain/keystore";
import { PERMIT2, X402_PERMIT2_PROXY } from "@/lib/x402/pay";
import { USD1 } from "@/lib/x402/index";
import { USDT, WBNB } from "@/lib/chain/leash";

export { NETWORK } from "@/lib/network";

export interface ContractEntry {
  name: string;
  /** The standard or product it belongs to. */
  kind: string;
  address: string;
  /** What this marketplace does with it, in one sentence. */
  role: string;
}

export interface ContractGroup {
  title: string;
  entries: ContractEntry[];
}

const escrow = ERC8183_ADDRESSES[56 as keyof typeof ERC8183_ADDRESSES];

export const CONTRACT_GROUPS: ContractGroup[] = [
  {
    title: "Agent identity and ratings",
    entries: [
      { name: "Identity registry", kind: "ERC-8004", address: IDENTITY_REGISTRY, role: "Every agent on this site is read from it: its id, its owner and its card." },
      { name: "Reputation registry", kind: "ERC-8004", address: REPUTATION_REGISTRY, role: "Ratings you give an agent after a hire are written here, from your wallet." },
    ],
  },
  {
    title: "Hiring",
    entries: [
      { name: "Mandate market", kind: "MANDATE", address: MARKET_V2, role: "Jobs with capital: your deposit, the agent's bond, and every epoch settled against a benchmark." },
      { name: "Agentic commerce", kind: "ERC-8183", address: escrow.commerce, role: "Escrowed jobs: your budget is held here until the agent delivers, and refunded if it does not." },
      { name: "Evaluator router", kind: "ERC-8183", address: escrow.router, role: "Decides when an escrowed job is complete." },
      { name: "Optimistic policy", kind: "ERC-8183", address: escrow.policy, role: "Holds a dispute window before an escrowed job pays out." },
      { name: "Permit2", kind: "Uniswap", address: PERMIT2, role: "The only approval a USDT payment asks for, and only for the exact amount." },
      { name: "x402 Permit2 proxy", kind: "x402", address: X402_PERMIT2_PROXY, role: "Moves a signed USDT payment to the seller you chose, never more than you signed." },
    ],
  },
  {
    title: "Leashes",
    entries: [
      { name: "Session KeyStore", kind: "Altana", address: KEYSTORE, role: "Sessions you grant an agent: the calls it may make, its caps, its expiry, and your revoke." },
      { name: "KeyStore controller", kind: "Altana", address: KEYSTORE_CONTROLLER, role: "Registers and revokes those sessions." },
      { name: "RecipientBound", kind: "MANDATE", address: PROTOCOLS.recipientBound, role: "Our range agent's leash: it can only pay the account it works for." },
      { name: "SwapBound", kind: "MANDATE", address: PROTOCOLS.swapBound, role: "Our grid agent's leash: swaps can only pay the account it works for." },
    ],
  },
  {
    title: "Tokens you pay with",
    entries: [
      { name: "USD1", kind: "EIP-3009", address: USD1, role: "Pay per call by signature, with no approval and no gas." },
      { name: "$U", kind: "EIP-3009", address: escrow.paymentToken, role: "Pay per call by signature, and the currency of escrowed jobs." },
      { name: "USDT", kind: "BEP-20", address: USDT, role: "Pay per call through Permit2, for the exact amount." },
      { name: "WBNB", kind: "BEP-20", address: WBNB, role: "Priced and traded by our grid and range agents." },
    ],
  },
  {
    title: "Protocols agents work on",
    entries: [
      { name: "PancakeSwap V3 positions", kind: "PancakeSwap", address: PROTOCOLS.pancakeV3PositionManager, role: "Where rebalancing agents read and move liquidity ranges." },
      { name: "Venus comptroller", kind: "Venus", address: PROTOCOLS.venusComptroller, role: "Where loan-protection agents read your health factor." },
      { name: "Venus vUSDT", kind: "Venus", address: PROTOCOLS.venusVUSDT, role: "Where yield agents supply and loan agents repay." },
    ],
  },
];

export const bscscan = (address: string) => `https://${CHAIN_ID === 97 ? "testnet." : ""}bscscan.com/address/${address}`;
