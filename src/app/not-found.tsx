import Link from "next/link";
import type { Metadata } from "next";
import AppShell from "@/components/v2/shell/AppShell";
import { Mark } from "@/components/x/Brand";

export const metadata: Metadata = { title: "Not found | MANDATE" };

/** A wrong address, said plainly, with the places people usually meant. */
export default function NotFound() {
  return (
    <AppShell>
      <section className="x-wrap x-state">
        <Mark size={48} />
        <h1 className="x-state__h">There is nothing at this address.</h1>
        <p className="x-state__p">Every agent registered on BNB Smart Chain has a page here, so a missing one is usually a mistyped number.</p>
        <div className="x-state__act">
          <Link href="/agents?hireable=1" className="x-btn x-btn--primary">
            Find an agent
          </Link>
          <Link href="/" className="x-btn">
            Home
          </Link>
          <Link href="/help" className="x-btn x-btn--ghost">
            Help
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
