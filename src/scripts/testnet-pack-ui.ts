/**
 * The free testnet pack on /quest, driven in a real browser with a stand-in
 * wallet that signs with the test wallet on BNB Smart Chain testnet.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/testnet-pack-ui.ts [--base https://www.mandatemarkets.com] [--candidate <url>] [--agent <testnet id>]
 *
 * The stand-in is an EIP-1193 provider in the page whose every request is
 * answered here: accounts and the chain it says it is on, a switch of network,
 * transactions signed with TEST_WALLET_KEY and sent to testnet, every other
 * call passed to that chain's node. It cannot batch, so the pack takes its
 * one-step-at-a-time path, the longer one. Testnet only: it refuses to send a
 * transaction while the page has it on any other chain.
 */

import { chromium, type Page } from "playwright-core";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

const baseIdx = process.argv.indexOf("--base");
const BASE = (baseIdx > -1 ? process.argv[baseIdx + 1]! : "https://www.mandatemarkets.com").replace(/\/$/, "");
const RPC: Record<number, string> = { 56: "https://bsc-dataseed.bnbchain.org", 97: "https://bsc-testnet-rpc.publicnode.com" };

/*
  A candidate deployment, served under the live address: a passkey is bound to
  mandatemarkets.com, so the browser stays there while every page and API
  request is answered by the candidate (with the protection bypass, if set).
*/
const candIdx = process.argv.indexOf("--candidate");
const CANDIDATE = candIdx > -1 ? process.argv[candIdx + 1]!.replace(/\/$/, "") : null;
async function serveCandidate(target: Pick<Page, "route">, base: string) {
  if (!CANDIDATE) return;
  await target.route(`${base}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const headers = { ...req.headers(), ...(process.env.VERCEL_BYPASS ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS } : {}) };
    delete (headers as Record<string, string>).host;
    await route.fulfill({ response: await route.fetch({ url: CANDIDATE + u.pathname + u.search, headers }) });
  });
}
const key = process.env.TEST_WALLET_KEY!;
const account = privateKeyToAccount((key.startsWith("0x") ? key : `0x${key}`) as Hex);
const wallet = createWalletClient({ account, chain: bscTestnet, transport: http(RPC[97]) });

async function main() {
  let chainId = 56;
  const sent: string[] = [];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await serveCandidate(page, BASE);

  await page.exposeFunction("__wallet", async (method: string, params: unknown[]) => {
    switch (method) {
      case "eth_requestAccounts":
      case "eth_accounts":
        return [account.address];
      case "eth_chainId":
        return `0x${chainId.toString(16)}`;
      case "wallet_switchEthereumChain": {
        chainId = Number.parseInt(String((params[0] as { chainId: string }).chainId), 16);
        setTimeout(() => void page.evaluate((hex) => (window as unknown as { __emit: (e: string, v: unknown) => void }).__emit("chainChanged", hex), `0x${chainId.toString(16)}`), 50);
        return null;
      }
      case "wallet_addEthereumChain":
        return null;
      case "wallet_getCapabilities":
        return {};
      case "eth_sendTransaction": {
        if (chainId !== 97) throw new Error(`refusing: the page asked for a transaction on chain ${chainId}`);
        const tx = params[0] as { to: Hex; data?: Hex; value?: Hex };
        const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : 0n });
        sent.push(hash);
        console.log(`  signed ${sent.length}: https://testnet.bscscan.com/tx/${hash}`);
        return hash;
      }
      default: {
        const r = await fetch(RPC[chainId] ?? RPC[56]!, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        const j = (await r.json()) as { result?: unknown; error?: { message: string } };
        if (j.error) throw new Error(j.error.message);
        return j.result;
      }
    }
  });
  // As text: a function would carry the TypeScript runner's helpers into the page, where they do not exist.
  await page.addInitScript(`
    (() => {
      const listeners = {};
      const provider = {
        isMetaMask: true,
        request: ({ method, params }) => window.__wallet(method, params || []),
        on: (e, f) => { (listeners[e] = listeners[e] || []).push(f); },
        removeListener: (e, f) => { listeners[e] = (listeners[e] || []).filter((x) => x !== f); },
      };
      window.ethereum = provider;
      window.__emit = (e, v) => (listeners[e] || []).forEach((f) => f(v));
    })();
  `);

  await page.goto(`${BASE}/quest`, { waitUntil: "networkidle" });

  // --agent <testnet id>: one other builder's agent hired from its card in the quest's testnet section, instead of the pack.
  const agentIdx = process.argv.indexOf("--agent");
  if (agentIdx > -1) {
    const id = process.argv[agentIdx + 1]!;
    const card = page.locator("section#testnet li", { hasText: `testnet #${id}` });
    await card.waitFor();
    console.log(`found testnet #${id}: ${(await card.locator(".bd-tnet__name").textContent())?.trim()}`);
    await card.getByRole("button", { name: /Hire free/ }).click();
    await card.getByRole("button", { name: /Connect your campaign wallet/ }).click();
    await card.getByRole("button", { name: /Switch to BNB Smart Chain testnet/ }).click();
    const go = card.getByRole("button", { name: /^Hire for/ });
    await go.waitFor({ timeout: 30_000 });
    console.log(`button: "${(await go.textContent())?.trim()}"`);
    await go.click();
    await card.locator(".bd-tnhire__job").waitFor({ timeout: 240_000 });
    console.log(`funded after ${sent.length} signatures: ${(await card.locator(".bd-tnhire__job").textContent())?.replace(/\s+/g, " ").trim()}`);
    await card.locator(".bd-tnhire__job", { hasText: /delivered/ }).waitFor({ timeout: 300_000 });
    console.log(`delivered: ${(await card.locator(".bd-tnhire__job").textContent())?.replace(/\s+/g, " ").trim()}`);
    await page.screenshot({ path: process.env.SHOT ?? "/tmp/testnet-hire.png", clip: (await card.boundingBox()) ?? undefined });
    await browser.close();
    process.exit(0);
  }

  const pack = page.locator("section.bd-pack--testnet");
  await pack.waitFor();
  console.log("found the testnet pack");
  await pack.getByRole("button", { name: /Connect your campaign wallet/ }).click();
  await pack.getByRole("button", { name: /Switch to BNB Smart Chain testnet/ }).click();
  const hire = pack.getByRole("button", { name: /Hire both free/ });
  await hire.waitFor({ timeout: 30_000 });
  console.log(`button: "${(await hire.textContent())?.trim()}"`);
  await hire.click();
  await pack.getByText(/Both testnet jobs are funded/).waitFor({ timeout: 240_000 });
  console.log(`funded after ${sent.length} signatures`);
  // A job line, not the pack's own description, which also says "delivered on chain".
  await pack.locator(".bd-pack__job", { hasText: /delivered/ }).first().waitFor({ timeout: 180_000 });
  const jobs = await pack.locator(".bd-pack__job").allTextContents();
  console.log("jobs:", jobs.map((t) => t.replace(/\s+/g, " ").trim()).join(" | "));
  await page.screenshot({ path: process.env.SHOT ?? "/tmp/testnet-pack.png", fullPage: false, clip: (await pack.boundingBox()) ?? undefined });
  await browser.close();
  process.exit(0);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
