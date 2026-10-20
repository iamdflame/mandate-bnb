"use client";

import { useRef } from "react";
import { Check, ShieldOff } from "lucide-react";

/**
 * Ending an agent's access, with the consequences in front of you.
 *
 * A native modal dialog, so the page behind is inert, Escape cancels and focus
 * is held inside without any code of ours. The form inside is the same plain
 * POST the desk has always used (session id and operator token), so it works
 * the same way with or without this dialog: the route revokes the key on
 * chain and sends you back to the desk with the transaction.
 *
 * Keys on the demo account are revoked by its operator, who pays the gas.
 * The dialog says so rather than presenting a button a visitor cannot use.
 */
export default function RevokeDialog({ sessionId, agent, calls }: { sessionId: string; agent: string; calls: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="k-btn k-btn--sm ac-rv__open" onClick={() => dialog.current?.showModal()}>
        <ShieldOff size={15} aria-hidden="true" /> Revoke (operator)
      </button>
      <dialog ref={dialog} className="ac-dialog" aria-labelledby={`rv-${sessionId}`}>
        <form method="post" action="/api/desk/revoke" className="ac-dialog__body">
          <h2 id={`rv-${sessionId}`} className="k-h3">
            Revoke {agent}&rsquo;s access?
          </h2>
          <p className="k-label">This will revoke:</p>
          <ul className="ac-can">
            {[...calls, "Its session on the account", "Its spend allowance"].map((c) => (
              <li key={c}>
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="k-small">The agent will no longer be able to act. Revoking is one transaction on BNB Smart Chain and cannot be undone.</p>
          <input type="hidden" name="id" value={sessionId} />
          <label className="ac-dialog__field">
            <span className="k-label">Operator token</span>
            <input className="ac-dialog__input" type="password" name="token" autoComplete="off" required />
            <span className="k-small">Keys on the demo account are revoked by its operator, who pays the gas, so this asks for the operator&rsquo;s token.</span>
          </label>
          <div className="k-row ac-dialog__nav">
            <button type="button" className="k-btn k-btn--ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="k-btn k-btn--danger">
              Revoke access
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
