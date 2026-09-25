/**
 * Your agent's paid endpoint, over x402, in USD1 on BNB Smart Chain.
 *
 *   GET /api/agent?wallet=0x…
 *
 * Asked without payment, it answers 402 with its price. Asked with an
 * X-PAYMENT header, it checks the buyer's signed EIP-3009 authorisation,
 * settles it on chain from SELLER_KEY's wallet (which pays the gas, so the
 * buyer needs no BNB), waits for the receipt, and only then does the work.
 *
 * Replace `work()` with what your agent does. Everything else is the payment.
 */

import { createPublicClient, createWalletClient, http, isAddress, parseAbi, parseGwei, recoverTypedDataAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const USD1: Address = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
const DOMAIN = { name: "World Liberty Financial USD", version: "1", chainId: 56, verifyingContract: USD1 } as const;
const TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
const TOKEN = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

const rpc = http(process.env.BSC_RPC_URL ?? "https://bsc-dataseed.bnbchain.org");
const chain = createPublicClient({ chain: bsc, transport: rpc });
const key = (process.env.SELLER_KEY ?? "") as Hex;
const seller = key ? privateKeyToAccount(key.startsWith("0x") ? key : (`0x${key}` as Hex)) : null;
const PRICE = BigInt(Math.round(Number(process.env.PRICE_USD1 ?? "0.01") * 1e6)) * 10n ** 12n;

/** What your agent does for one paid call. This one reads a wallet's balances; make it yours. */
async function work(input: { wallet: Address }) {
  const [block, bnb, usd1] = await Promise.all([
    chain.getBlockNumber(),
    chain.getBalance({ address: input.wallet }),
    chain.readContract({ address: USD1, abi: TOKEN, functionName: "balanceOf", args: [input.wallet] }),
  ]);
  return { wallet: input.wallet, block: block.toString(), bnb: bnb.toString(), usd1: usd1.toString() };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...headers } });

export async function GET(request: Request): Promise<Response> {
  if (!seller) return json({ error: "SELLER_KEY is not set on this deployment" }, 503);
  const url = new URL(request.url);
  const subject = url.searchParams.get("wallet") ?? "";
  if (!isAddress(subject)) return json({ error: "give ?wallet=0x… (a BNB Smart Chain address)", inputs: [{ name: "wallet", required: true, description: "a BNB Smart Chain address" }] }, 400);

  const header = request.headers.get("x-payment");
  if (!header) {
    return json(
      {
        x402Version: 1,
        error: "payment required",
        accepts: [
          {
            scheme: "exact",
            network: "eip155:56",
            asset: USD1,
            payTo: seller.address,
            maxAmountRequired: PRICE.toString(),
            resource: url.toString(),
            description: process.env.AGENT_DESCRIPTION ?? "One answer from this agent",
            mimeType: "application/json",
            maxTimeoutSeconds: 120,
            extra: { name: DOMAIN.name, version: DOMAIN.version, transferMethod: "eip3009" },
          },
        ],
      },
      402,
    );
  }

  // Every check fails closed: a payment that cannot be checked is not a payment.
  let a: { from: Address; to: Address; value: string; validAfter: string; validBefore: string; nonce: Hex };
  let signature: Hex;
  try {
    const p = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    a = p.payload.authorization;
    signature = p.payload.signature;
  } catch {
    return json({ error: "X-PAYMENT is not a base64 x402 payload" }, 402);
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (a.to.toLowerCase() !== seller.address.toLowerCase()) return json({ error: `pays ${a.to}, not ${seller.address}` }, 402);
  if (BigInt(a.value) < PRICE) return json({ error: `offers ${a.value}; the price is ${PRICE}` }, 402);
  if (BigInt(a.validAfter) > now || BigInt(a.validBefore) <= now) return json({ error: "authorisation not valid at this time" }, 402);
  const signer = await recoverTypedDataAddress({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "TransferWithAuthorization",
    message: { from: a.from, to: a.to, value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce },
    signature,
  }).catch(() => null);
  if (!signer || signer.toLowerCase() !== a.from.toLowerCase()) return json({ error: "the signature is not the payer's" }, 402);
  const [used, balance] = await Promise.all([
    chain.readContract({ address: USD1, abi: TOKEN, functionName: "authorizationState", args: [a.from, a.nonce] }),
    chain.readContract({ address: USD1, abi: TOKEN, functionName: "balanceOf", args: [a.from] }),
  ]);
  if (used) return json({ error: "this authorisation was already used" }, 402);
  if (balance < BigInt(a.value)) return json({ error: "the payer cannot cover it" }, 402);

  // Settle first, then work: nobody gets the answer before the money has moved.
  const r = `0x${signature.slice(2, 66)}` as Hex;
  const s = `0x${signature.slice(66, 130)}` as Hex;
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) v += 27;
  const quoted = await chain.getGasPrice();
  const floor = parseGwei("0.06");
  const settler = createWalletClient({ account: seller, chain: bsc, transport: rpc });
  const tx = await settler.writeContract({
    address: USD1,
    abi: TOKEN,
    functionName: "transferWithAuthorization",
    args: [a.from, a.to, BigInt(a.value), BigInt(a.validAfter), BigInt(a.validBefore), a.nonce, v, r, s],
    gasPrice: (quoted * 12n) / 10n > floor ? (quoted * 12n) / 10n : floor,
  });
  const receipt = await chain.waitForTransactionReceipt({ hash: tx, timeout: 40_000 });
  if (receipt.status !== "success") return json({ error: "settlement reverted; no work was done", transaction: tx }, 402);

  const answer = await work({ wallet: subject });
  return json({ ...answer, paid: { by: a.from, amount: a.value, transaction: tx } }, 200, {
    "x-payment-response": Buffer.from(JSON.stringify({ success: true, transaction: tx, network: "eip155:56" })).toString("base64"),
  });
}
