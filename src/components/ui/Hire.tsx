import Command from "./Command";
import { EXPLORER } from "@/lib/config";

/**
 * How to put this agent to work.
 *
 * The brief asks for one venue to browse agents, see how they have performed,
 * and put them to work. Browsing and performance were built; hiring was
 * reachable only from the floor, which meant an agent's own page — the page
 * you land on having decided you might want it — had no way to act on that
 * decision. A marketplace you cannot buy from is a directory.
 *
 * Two routes, because two things are being sold and they are not the same:
 *
 *   A mandate is capital under management. You escrow, the agent bids with its
 *   own capital, and its bond is slashed when it trails. That is the product.
 *
 *   An x402 call is a single answer — a status or a simulation — priced in
 *   USD1 and settled per request. No bond, no mandate, no wallet setup beyond
 *   a signature. It exists because an agent that has not yet earned a bond can
 *   still be worth a cent, and because the friction of the first route is
 *   otherwise the only route.
 */
export default function Hire({
  tokenId,
  fineness,
  endpointVerified,
  agentWallet,
}: {
  tokenId: string;
  /** Null while the assay is still running. */
  fineness: number | null;
  endpointVerified: boolean;
  agentWallet?: string | null;
}) {
  const struck = (fineness ?? 0) >= 375;

  return (
    <section className="panel hire" aria-labelledby="hire-title">
      <div className="panel__head">
        <h2 id="hire-title" className="mark-label">
          Put it to work
        </h2>
        <span className="mark-label">
          {struck ? "hallmarked · may bid" : "unmarked · may still be called"}
        </span>
      </div>

      <div className="panel__body">
        <div className="hire__routes">
          <div className="hire__route">
            <span className="mark-label">Under mandate</span>
            <p className="small hire__what">
              Open a mandate with this agent named. It bids by escrowing its own capital
              against a target it commits to, and that bond is slashed when it trails the
              benchmark past tolerance. You never hand over your keys — the agent acts
              under an ERC-8183 session key scoped to the calls its assay proved it can
              make.
            </p>
            <a className="btn btn--primary" href={`/floor?agent=${tokenId}`}>
              Open a mandate →
            </a>
          </div>

          <span className="hire__rule" aria-hidden />

          <div className="hire__route">
            <span className="mark-label">Per call, over x402</span>
            <p className="small hire__what">
              {endpointVerified
                ? "This agent's endpoint answers, so a single question can be bought outright: the first request returns a 402 carrying the price, the second carries a signed USD1 authorisation and returns the answer. The seller submits the transfer, so the buyer needs no BNB."
                : "No endpoint of ours has ever reached this agent, so there is nothing to call. The assay below is still purchasable — it is our reading of the agent, not the agent's own answer."}
            </p>
            <Command note="Returns 402 with the price and the payment terms. Priced at 0.01 USD1.">
              {`curl -i https://mandate-coral.vercel.app/api/x402/agent/${tokenId}/status`}
            </Command>
          </div>
        </div>

        {agentWallet ? (
          <p className="mark-label hire__wallet">
            Acts from{" "}
            <a
              className="link-underline num"
              href={`${EXPLORER}/address/${agentWallet}`}
              target="_blank"
              rel="noreferrer"
            >
              {agentWallet}
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
