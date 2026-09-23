import { Check, Loader2, X } from "lucide-react";

/**
 * Where a payment is, in four words a buyer understands.
 *
 * The payment engine has more states than this (quoting, approving, signing,
 * settling), and those are the right states for the code. A person watching
 * their money move wants four: we are getting it ready, it is waiting for
 * you, it has been sent, it has landed.
 */

export type TxStep = "preparing" | "awaiting" | "submitted" | "confirmed";

const STEPS: { id: TxStep; label: string; note: string }[] = [
  { id: "preparing", label: "Preparing", note: "Reading the seller's current price" },
  { id: "awaiting", label: "Awaiting signature", note: "Approve it in your wallet" },
  { id: "submitted", label: "Submitted", note: "The seller is settling the payment on chain" },
  { id: "confirmed", label: "Confirmed", note: "Paid, and the agent answered" },
];

/** The engine's phase, mapped onto the four steps. Exported for the tests. */
export function txStepOf(at: string): TxStep | null {
  if (at === "quoting") return "preparing";
  if (at === "quoted" || at === "approving" || at === "signing") return "awaiting";
  if (at === "settling") return "submitted";
  if (at === "done") return "confirmed";
  return null;
}

export default function TxStatus({ step, failed = false }: { step: TxStep; failed?: boolean }) {
  const at = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="x-tx" aria-label="Payment progress">
      {STEPS.map((s, i) => {
        const state = i < at || (i === at && s.id === "confirmed" && !failed) ? "done" : i === at ? (failed ? "failed" : "now") : "next";
        return (
          <li key={s.id} className={`x-tx__step x-tx__step--${state}`} aria-current={state === "now" ? "step" : undefined}>
            <span className="x-tx__mark" aria-hidden="true">
              {state === "done" ? <Check size={14} strokeWidth={3} /> : state === "failed" ? <X size={14} strokeWidth={3} /> : state === "now" ? <Loader2 size={14} className="x-spin" /> : null}
            </span>
            <span className="x-tx__t">{s.label}</span>
            {state === "now" || state === "failed" ? (
              <span className="x-tx__n">
                {state !== "failed" ? s.note : s.id === "submitted" ? "Stopped here. The message below says what happened." : "Stopped here. Nothing was charged."}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
