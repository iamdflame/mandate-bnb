import { formatUnits } from "viem";
import Agent from "@/components/characters/Agent";
import { CATEGORY_LABEL } from "@/lib/config";
import { ageOf } from "@/lib/data/snapshots";
import type { TestnetSeller } from "@/lib/testnet/sellers";
import TestnetHire from "./TestnetHire";

/**
 * Every other builder's agent a buyer can hire free on BNB Smart Chain
 * testnet, in the quest's own card: its face, its job, what its card says it
 * does, the price it last signed for the testnet kernel, and a hire that runs
 * in place. Ours are in the pack above, so they are left out here.
 */
export default function TestnetAgents({ agents, checkedAt }: { agents: (TestnetSeller & { hireable: boolean })[]; checkedAt: string }) {
  const hireable = agents.filter((a) => a.hireable && !a.ours && a.quote);
  if (!hireable.length) return null;
  return (
    <section className="bd-qjobs bd-tnet" aria-labelledby="h-tnet" id="testnet">
      <div className="k-shead">
        <div className="k-shead__copy">
          <h2 id="h-tnet" className="k-h2">
            {hireable.length} more agents, free on testnet
          </h2>
          <p className="k-body">
            Other builders&apos; agents that sell escrowed jobs on BNB Smart Chain testnet. Each one is a real job, paid in test $U and delivered on chain, and Set and Earn counts it.
          </p>
          <p className="k-src">Prices each agent signed for the testnet kernel, read {ageOf(checkedAt)}.</p>
        </div>
      </div>
      <ol className="bd-qjobs__list">
        {hireable.map((a, i) => (
          <li key={a.tokenId} className="bd-qjob" data-job={a.category} style={{ ["--i" as string]: i }}>
            <span className="bd-qjob__art" aria-hidden="true">
              {/* Awake when it answered our price request in the last 15 minutes, ready otherwise: every one here is hireable. */}
              <Agent job={a.category} seed={`97:${a.tokenId}`} size={104} state={Date.now() - Date.parse(a.quote!.at) <= 15 * 60_000 ? "awake" : "ready"} slot="testnet" />
            </span>
            <div className="bd-qjob__body">
              <h3 className="bd-qjob__job">{CATEGORY_LABEL[a.category]}</h3>
              <p className="bd-qjob__name">
                <span className="bd-tnet__name">{a.name}</span>
                <span className="k-tag">testnet #{a.tokenId}</span>
              </p>
              {a.what ? <p className="bd-tnet__what">{a.what}</p> : null}
              <p className="bd-qjob__price k-num">{formatUnits(BigInt(a.quote!.price), 18)} test $U</p>
              <TestnetHire tokenId={a.tokenId} name={a.name} price={a.quote!.price} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
