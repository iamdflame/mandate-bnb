import { LifeBuoy } from "lucide-react";
import { SUPPORT } from "@/lib/site";

/**
 * One line wherever money moves: who to ask, and what to send them.
 *
 * Support is a person in our Telegram group or at our support address, and
 * the line says what they will need, so the first message can be the one that
 * solves it. It also says what we will never ask for.
 */
export default function NeedHelp({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`x-help${compact ? " x-help--compact" : ""}`}>
      <LifeBuoy size={14} aria-hidden="true" />
      <span>
        Stuck?{" "}
        <a className="x-link" href={SUPPORT.telegram} target="_blank" rel="noreferrer">
          Ask in our Telegram
        </a>{" "}
        or email{" "}
        <a className="x-link" href={`mailto:${SUPPORT.email}`}>
          {SUPPORT.email}
        </a>
        {compact ? "." : " with your wallet address and the transaction. We never DM first and never ask for your seed phrase."}
      </span>
    </p>
  );
}
