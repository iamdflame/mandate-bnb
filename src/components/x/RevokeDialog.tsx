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
      <button type="button" className="x-btn x-btn--sm x-btn--danger-ghost" onClick={() => dialog.current?.showModal()}>
        <ShieldOff size={15} aria-hidden="true" /> Revoke (operator)
      </button>
      <dialog ref={dialog} className="x-dialog" aria-labelledby={`rv-${sessionId}`}>
        <form method="post" action="/api/desk/revoke" className="x-dialog__body">
          <h2 id={`rv-${sessionId}`} className="x-dialog__t">
            Revoke {agent}&rsquo;s access?
          </h2>
          <p className="x-hire__lede">This will revoke:</p>
          <ul className="x-can">
            {[...calls, "Its session on the account", "Its spend allowance"].map((c) => (
              <li key={c}>
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
          <p className="x-hire__lede">The agent will no longer be able to act. Revoking is one transaction on BNB Smart Chain and cannot be undone.</p>
          <input type="hidden" name="id" value={sessionId} />
          <label className="x-field">
            <span className="x-field__l">Operator token</span>
            <input className="x-input" type="password" name="token" autoComplete="off" required />
            <span className="x-pay__note">Keys on the demo account are revoked by its operator, who pays the gas, so this asks for the operator&rsquo;s token.</span>
          </label>
          <div className="x-hire__nav">
            <button type="button" className="x-btn x-btn--ghost" onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="x-btn x-btn--danger">
              Revoke access
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
