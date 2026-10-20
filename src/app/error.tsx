"use client";
import "@/styles/account.css";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import Agent from "@/components/characters/Agent";
import { Mark } from "@/components/x/Brand";
import { SUPPORT } from "@/lib/site";

/**
 * When a page fails to render. Nothing on this site holds your money in a
 * page, so a failure here moved nothing; the page says so, offers another
 * try, and names who to tell. The dozing agent is decorative (a neutral
 * seed): a slow read from the chain, not any real agent's state.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="ac-err">
      <Link href="/" className="ac-err__brand" aria-label="MANDATE, home">
        <Mark size={30} />
        <span>Mandate</span>
      </Link>
      <section className="ac-err__in" aria-labelledby="ac-err-h">
        <div className="ac-err__art" aria-hidden="true">
          <div className="ac-err__floor" />
          <Agent job="grid-trading" seed="error-page" size={168} state="dozing" slot="err" />
        </div>
        <h1 className="k-display ac-err__h k-rise" id="ac-err-h" style={{ ["--i" as string]: 0 }}>
          This page did not load.
        </h1>
        <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
          Nothing was signed and nothing moved. It is usually a slow read from the chain, and trying again tends to work.
        </p>
        <div className="k-row ac-err__act k-rise" style={{ ["--i" as string]: 2 }}>
          <button type="button" className="k-btn k-btn--primary" onClick={reset}>
            <RotateCw size={16} aria-hidden="true" /> Try again
          </button>
          <Link href="/" className="k-btn">
            Home
          </Link>
        </div>
        <p className="k-small ac-err__n k-rise" style={{ ["--i" as string]: 3 }}>
          Still failing? Tell us in{" "}
          <a className="k-link" href={SUPPORT.telegram} target="_blank" rel="noreferrer">
            Telegram
          </a>{" "}
          or at{" "}
          <a className="k-link" href={`mailto:${SUPPORT.email}`}>
            {SUPPORT.email}
          </a>
          {error.digest ? (
            <>
              , quoting <span className="k-mono">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
      </section>
    </main>
  );
}
