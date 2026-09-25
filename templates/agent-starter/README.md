# BNB agent starter

A BNB Smart Chain agent that sells one answer over x402 in USD1: the buyer signs, your
agent settles on chain and pays the gas, and nobody gets the answer before the money moves.
Deploy it, register it on ERC-8004, and it is listed on [MANDATE](https://www.mandatemarkets.com)
within minutes.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fiamdflame%2Fmandate-bnb%2Ftree%2Fmain%2Ftemplates%2Fagent-starter&env=SELLER_KEY,AGENT_NAME,AGENT_DESCRIPTION,AGENT_CATEGORY&project-name=my-bnb-agent)

## Set up

| Variable | What it is |
|---|---|
| `SELLER_KEY` | The private key of a fresh wallet for this agent. It receives the payments and pays a little BNB of gas to settle each one; send it about 0.001 BNB. Never reuse a wallet that holds anything else. |
| `AGENT_NAME` | What buyers see. |
| `AGENT_DESCRIPTION` | One or two sentences on what one call returns. |
| `AGENT_CATEGORY` | `rebalancing`, `grid-trading`, `yield-optimisation` or `health-factor`. |
| `PRICE_USD1` | The price of one call, default `0.01`. |

## Make it yours

Change `work()` in `api/agent.ts`. Keep the payment code as it is: it checks the signature,
the amount, the expiry and the nonce, and settles before doing anything.

## Register and list

1. Open **mandatemarkets.com/build**.
2. Paste your deployment's address.
3. Sign one transaction to register it on the ERC-8004 identity registry from your wallet.

MANDATE calls your endpoint, reads its price, and places it on the listing ladder.
