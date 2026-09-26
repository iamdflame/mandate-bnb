import Link from "next/link";
import { NETWORK } from "@/lib/network";

/** Which chain, in plain words, everywhere. It opens the list of contracts we read. */
export default function NetworkBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/contracts" className={`x-net${compact ? " x-net--compact" : ""}`} title={`${NETWORK.name}, chain ${NETWORK.chainId}. See every contract we read.`}>
      <span className="x-net__dot" aria-hidden="true" />
      <span>
        {/* A narrow header has room for the short name; the network is stated either way. */}
        <span className="x-net__full">BNB Smart Chain</span>
        <span className="x-net__abbr">BSC</span> <span className="x-net__sep">·</span> {NETWORK.short}
        {compact ? null : <span className="x-net__id x-mono"> {NETWORK.chainId}</span>}
      </span>
    </Link>
  );
}
