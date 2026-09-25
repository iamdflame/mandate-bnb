/**
 * What the hire drawer offers for one listing, decided by the hire law.
 *
 * Shared by the agent page and the quest, so an agent is offered exactly the
 * same way wherever a buyer meets it: a paid call only when it quoted a price
 * we can settle, a job only when it bids in the market, and a refusal with its
 * reason otherwise.
 */

import { formatUnits } from "viem";
import AgentArtwork from "@/components/x/AgentArtwork";
import { priceParts } from "@/components/x/Price";
import type { HireOffer } from "@/components/x/HireDrawer";
import { CATEGORY_LABEL } from "@/lib/config";
import type { Listing } from "@/lib/market/listing";
import { previewFor } from "@/lib/market/quotes";
import { hirePath } from "@/lib/market/hire-law";
import { SPONSORED } from "@/lib/market/sponsored-targets";
import { houseSlug } from "@/lib/market/performance";
import { inputsFor } from "@/lib/market/inputs";
import { HOUSE_LEASHES } from "@/lib/chain/house";
import { allowedCalls, CANNOT } from "@/lib/chain/leash-words";
import { USDT, WBNB } from "@/lib/chain/leash";
import { HOUSE_BUDGET } from "@/lib/escrow/contracts";
import { providerFor } from "@/lib/escrow/jobs";
import { ESCROW_OPEN } from "@/lib/escrow/open";

const TOKEN: Record<string, string> = { [USDT.toLowerCase()]: "USDT", [WBNB.toLowerCase()]: "WBNB" };

export function offerFor(l: Listing): HireOffer {
  const preview = previewFor(l.tokenId);
  const verdict = hirePath(l);
  const perCall = verdict.rails.find((r) => r.kind === "x402");
  const jobRail = verdict.rails.some((r) => r.kind === "mandate");
  const sponsor = verdict.ok ? SPONSORED[l.tokenId] : undefined;
  const slug = houseSlug(l.tokenId);
  const leash = slug ? HOUSE_LEASHES.find((h) => h.slug === slug) : undefined;
  return {
    tokenId: l.tokenId,
    name: l.name,
    art: <AgentArtwork category={l.category} seed={`${l.tokenId}:${l.name}`} shape="square" />,
    categoryLabel: l.category ? CATEGORY_LABEL[l.category] : null,
    category: l.category,
    price: priceParts(l),
    latencyMs: l.probe?.answered ? (l.probe.latencyMs ?? null) : null,
    task: preview?.summary ?? l.quote?.description ?? (l.what ? l.what : `One call to ${l.name}`),
    x402:
      perCall && l.quote
        ? {
            path: SPONSORED[l.tokenId]?.url() ?? l.quote.endpoint,
            method: SPONSORED[l.tokenId]?.method ?? "GET",
            body: SPONSORED[l.tokenId]?.body,
            payTo: l.quote.payTo,
            network: l.quote.network,
            scheme: l.quote.scheme,
            asset: l.quote.asset,
            assetName: l.quote.assetName,
            header: l.quote.header,
            version: l.quote.x402Version,
            transferMethod: l.quote.transferMethod,
          }
        : null,
    inputs: inputsFor(l.tokenId, preview),
    job: jobRail
      ? {
          href: `/hire/${l.tokenId}`,
          can: leash ? allowedCalls(leash.calls).map((a) => a.words) : [],
          caps: leash ? leash.tokenSpend.map((t) => `${formatUnits(t.limit, 18)} ${TOKEN[t.token.toLowerCase()] ?? "tokens"} a day`) : [],
          cannot: CANNOT,
        }
      : null,
    // Our own agents take escrowed jobs, from their own wallets, once escrow is open.
    escrow: (() => {
      const p = ESCROW_OPEN && slug && verdict.ok ? providerFor(slug) : null;
      return p ? { provider: p.owner, budget: HOUSE_BUDGET.toString(), tokenId: l.tokenId, name: l.name } : null;
    })(),
    sponsored: sponsor ? { asks: sponsor.asks, checkWith: sponsor.checkWith, takesSubject: sponsor.takesSubject, price: l.priceLabel } : null,
    refuse: verdict.ok ? null : verdict.reason,
    alternatives: l.category ? `/agents?category=${l.category}&hireable=1` : "/agents?hireable=1",
  };
}
