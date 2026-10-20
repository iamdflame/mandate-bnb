import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatEther } from "viem";
import { bscClient } from "@/lib/chain/rpc";
import AppShell from "@/components/v2/shell/AppShell";
import Empty from "@/components/x/Empty";
import { ReceiptCheck, ReceiptHead, ReceiptPaper, ReceiptPart } from "@/components/account/Receipt";
import { CATEGORIES } from "@/lib/config";
import { MANDATE_MARKET_ABI } from "@/lib/chain/abi";
import { DEPLOYMENTS, addressUrl, CANONICAL } from "@/lib/chain/deployments";
import { CATEGORY_NAMES, STATE_NAMES, MARKET_ADDRESS } from "@/lib/chain/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * A ledger on a deployment that is no longer canonical.
 *
 * This office has run three markets and every one of them still holds mandates
 * with settled epochs, including the grid mandate that lost 21%. The register
 * and the office pages link to all of them, so those links needed somewhere to
 * land; without this page they were dead ends, which is the one thing the
 * front of this site is not allowed to have.
 *
 * Deleting the older books instead would have been easier and would have meant
 * a market that stops displaying its worst result the moment it redeploys.
 */

const deploymentFor = (label: string) =>
  DEPLOYMENTS.find((d) => d.label === label.toLowerCase()) ?? null;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ deployment: string; id: string }>;
}): Promise<Metadata> {
  const { deployment, id } = await params;
  return {
    title: `Mandate ${id} on ${deployment}, the full record | Mandate`,
    description: `Mandate ${id} as it stands on the ${deployment} deployment of the market, read from the contract.`,
  };
}

export default async function SupersededLedger({
  params,
}: {
  params: Promise<{ deployment: string; id: string }>;
}) {
  const { deployment, id } = await params;
  const d = deploymentFor(deployment);
  if (!d || !/^\d{1,6}$/.test(id)) notFound();

  // The canonical deployment keeps the short URL; sending it here would give
  // the same mandate two addresses on this site.
  if (d.status === "canonical") notFound();

  const client = bscClient();

  interface MandateRead {
    principal: `0x${string}`;
    capital: bigint;
    agent: `0x${string}`;
    bond: bigint;
    category: number;
    state: number;
    epochsTotal: number;
    epochsSettled: number;
    cumulativeAlphaBps: bigint;
    strikes: number;
  }
  let m: MandateRead | null = null;
  let blockNumber: bigint | null = null;
  /*
    `notFound()` signals by throwing, so it must not sit inside the catch that
    handles an unreachable node. It did, and the catch swallowed it: a request
    for mandate 99 on a contract holding four rendered a page of blanks with a
    200 rather than a 404. The two outcomes are kept apart, a mandate that does
    not exist, and a chain that would not answer.
  */
  let exists: boolean | null = null;
  try {
    const count = Number(
      await client.readContract({
        address: d.address,
        abi: MANDATE_MARKET_ABI,
        functionName: "mandateCount",
      }),
    );
    exists = Number(id) < count;
    if (exists) {
      const [raw, bn] = await Promise.all([
        client.readContract({
          address: d.address,
          abi: MANDATE_MARKET_ABI,
          functionName: "getMandate",
          args: [BigInt(id)],
        }),
        client.getBlockNumber(),
      ]);
      m = raw as unknown as MandateRead;
      blockNumber = bn;
    }
  } catch {
    // Unreadable, which is not the same as absent.
    exists = null;
    m = null;
  }
  if (exists === false) notFound();

  const ZERO = "0x0000000000000000000000000000000000000000";

  const job = m ? (CATEGORIES[m.category] ?? null) : null;
  const alpha = m && m.epochsSettled > 0 ? Number(m.cumulativeAlphaBps) / 100 : null;
  const at = blockNumber ? <span className="k-src">BNB Smart Chain, block {blockNumber.toLocaleString("en-GB")}</span> : null;

  return (
    <AppShell>
      <ReceiptHead
        kind={`Mandate ${id}, on ${d.label}: a contract we replaced`}
        title={m ? `${CATEGORY_NAMES[m.category] ?? "Mandate"}, job #${id}` : `Mandate ${id}`}
        status={m ? `${STATE_NAMES[m.state] ?? `State ${m.state}`} on ${d.label}, where nothing will settle it again` : "The chain would not answer"}
        tone="warn"
        job={job}
        seed={`job:${d.label}:${id}`}
        pose="dozing"
        back={{ href: "/jobs", label: "All jobs" }}
        lede={
          <>
            {d.note} New mandates open on{" "}
            <a className="k-link" href={addressUrl(CANONICAL.address, CANONICAL.chainId)} target="_blank" rel="noreferrer">
              the canonical market
            </a>
            .
          </>
        }
      >
        <p className="k-small">This record is kept readable because the hours it settled really happened, and a market that hides its earlier books when it redeploys is doing the thing we exist to catch.</p>
      </ReceiptHead>

      <div className="k-wrap ac-rbody">
        {!m ? (
          <Empty title="The chain would not answer for this mandate just now" job="grid-trading" pose="dozing">
            So nothing is shown. No figure on this page is filled in from anywhere else.
          </Empty>
        ) : (
          <>
            <ReceiptPaper
              title="As it stands"
              note={at}
              rows={[
                { k: "State", v: STATE_NAMES[m.state] ?? String(m.state) },
                { k: "Job", v: CATEGORY_NAMES[m.category] ?? String(m.category) },
                { k: "Capital", v: <span className="k-num">{formatEther(m.capital)} BNB</span>, strong: true },
                { k: "Bond at risk", v: <span className="k-num">{m.bond > 0n ? `${formatEther(m.bond)} BNB` : "none"}</span> },
                { k: "Hours settled", v: <span className="k-num">{`${m.epochsSettled} of ${m.epochsTotal}`}</span> },
                {
                  k: "Against the benchmark",
                  v: alpha === null ? "not settled yet" : <span className={`k-num ${alpha > 0 ? "ac-alpha--up" : alpha < 0 ? "ac-alpha--down" : ""}`}>{`${alpha > 0 ? "+" : ""}${alpha.toFixed(2)}%`}</span>,
                  strong: true,
                },
                { k: "Strikes", v: <span className="k-num">{String(m.strikes)}</span> },
              ]}
            />
            <div className="ac-rbody__side">
              <ReceiptPart title="The parties">
                <dl className="k-facts">
                  <div>
                    <dt>Principal</dt>
                    <dd>
                      <a className="k-link k-mono" href={addressUrl(m.principal, d.chainId)} target="_blank" rel="noreferrer">
                        {m.principal}
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>Agent</dt>
                    <dd>
                      {m.agent === ZERO ? (
                        "not awarded, nobody has bid"
                      ) : (
                        <a className="k-link k-mono" href={addressUrl(m.agent, d.chainId)} target="_blank" rel="noreferrer">
                          {m.agent}
                        </a>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Market</dt>
                    <dd>
                      <a className="k-link k-mono" href={addressUrl(d.address, d.chainId)} target="_blank" rel="noreferrer">
                        {d.address}
                      </a>
                    </dd>
                  </div>
                </dl>
              </ReceiptPart>
              <ReceiptCheck
                note="The verifier knows every deployment we have run, by name."
                commands={[`npx mandate-verify --mandate ${id} --chain 56 --deployment ${d.label}`, `cast call ${d.address} "getMandate(uint256)" ${id} --rpc-url https://bsc-dataseed1.binance.org`]}
              />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
