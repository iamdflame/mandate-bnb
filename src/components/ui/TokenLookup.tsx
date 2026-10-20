"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Hash } from "lucide-react";

/**
 * Look up any agent on BSC by its token id, including one you are being asked
 * to trust somewhere else. No wallet, no account, no permission from us.
 * Opens the agent's page, where each check is shown with its evidence.
 * Only /assay uses it; styles in src/styles/trust.css.
 */
export default function TokenLookup({
  label = "See any agent's checks",
  cta = "Open",
}: {
  label?: string;
  cta?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const id = value.trim().replace(/^#/, "");
    if (!/^\d+$/.test(id)) return;
    router.push(`/agent/${id}`);
  };

  return (
    <form className="tr-lookup" onSubmit={go}>
      <label className="k-label" htmlFor="lookup-input">
        {label}
      </label>
      <div className="k-field tr-lookup__field">
        <Hash size={18} aria-hidden="true" />
        <input
          id="lookup-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ERC-8004 token id, like 153776"
          autoComplete="off"
        />
        <button type="submit" className="k-btn k-btn--primary" disabled={!/^\d+$/.test(value.trim())}>
          {cta} <ArrowRight size={16} className="k-btn__go" aria-hidden="true" />
        </button>
      </div>
      <p className="k-small">Opens its page, with each check and the evidence behind it. No wallet needed.</p>
    </form>
  );
}
