import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CATEGORY_LABEL, type Category } from "@/lib/config";
import { CATEGORY_PITCH, type CategoryStats } from "@/lib/market/catalogue";
import AgentArtwork from "./AgentArtwork";

/** One job, with its own geometry and the live counts behind it. */
export default function CategoryTile({ category, s, tall = false }: { category: Category; s: CategoryStats; tall?: boolean }) {
  return (
    <Link href={`/agents?category=${category}`} className={`x-cat x-cat--${category}${tall ? " x-cat--tall" : ""}`}>
      <span className="x-cat__art" aria-hidden="true">
        <AgentArtwork category={category} seed={`cat:${category}`} />
      </span>
      <span className="x-cat__body">
        <span className="x-cat__t">{CATEGORY_LABEL[category]}</span>
        <span className="x-cat__p">{CATEGORY_PITCH[category]}</span>
        <span className="x-cat__stats">
          <span>
            <strong className="x-mono">{s.live}</strong> reachable
          </span>
          <span>
            <strong className="x-mono">{s.priced}</strong> priced
          </span>
          <span>
            <strong className="x-mono x-accent">{s.hireable}</strong> hireable
          </span>
        </span>
        <span className="x-cat__foot">
          <span className="x-cat__from">{s.from !== null ? `From $${s.from.toFixed(2)} a call` : "Price varies"}</span>
          <span className="x-cat__go">
            Explore {CATEGORY_LABEL[category].split(" ")[0].toLowerCase()} <ArrowRight size={14} aria-hidden="true" />
          </span>
        </span>
      </span>
    </Link>
  );
}
