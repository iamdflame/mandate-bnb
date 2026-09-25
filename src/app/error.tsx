"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Mark } from "@/components/x/Brand";
import { SUPPORT } from "@/lib/site";

/**
 * When a page fails to render. Nothing on this site holds your money in a
 * page, so a failure here moved nothing; the page says so, offers another
 * try, and names who to tell.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="x-app">
      <section className="x-wrap x-state">
        <Mark size={48} />
        <h1 className="x-state__h">This page did not load.</h1>
        <p className="x-state__p">Nothing was signed and nothing moved. It is usually a slow read from the chain; trying again tends to work.</p>
        <div className="x-state__act">
          <button type="button" className="x-btn x-btn--primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="x-btn">
            Home
          </Link>
        </div>
        <p className="x-state__n">
          Still failing? Tell us in{" "}
          <a className="x-link" href={SUPPORT.telegram} target="_blank" rel="noreferrer">
            Telegram
          </a>{" "}
          or at{" "}
          <a className="x-link" href={`mailto:${SUPPORT.email}`}>
            {SUPPORT.email}
          </a>
          {error.digest ? (
            <>
              , quoting <span className="x-mono">{error.digest}</span>
            </>
          ) : null}
          .
        </p>
      </section>
    </main>
  );
}
