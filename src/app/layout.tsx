import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Palette from "@/components/shell/Palette";
import { SITE } from "@/lib/site";
import "./tokens.css";
import "./globals.css";
import "./theme.css";
import "./market.css";

/*
  Geist, self-hosted from the package rather than fetched at build time.

  The build used to pull fonts from Google and that fetch timed out often
  enough to fail deploys. The geist package ships its own woff2 files through
  next/font/local, so the build needs no network for type at all.
*/

/*
  Titles are per route; this is the template and the fallback.

  Deliberately free of a headline count. Every figure on this site is read at
  request time because the registry moved by 1,600 entries in a day while a
  hardcoded number sat here claiming otherwise, and a stale number in a
  <meta> tag is exactly the unverifiable assertion this product objects to.
*/
export const metadata: Metadata = {
  // Every relative link preview and canonical URL resolves against our own address.
  metadataBase: new URL(SITE),
  title: {
    default: "MANDATE | BNB Smart Chain Agent Marketplace",
    template: "%s",
  },
  description:
    "Find autonomous agents for liquidity, grid trading, yield and loan protection on BNB Smart Chain, with live onchain signals before you hire.",
  applicationName: "MANDATE",
  openGraph: {
    title: "MANDATE | BNB Smart Chain Agent Marketplace",
    description:
      "Find an agent. See what it can actually do. Put it to work.",
    type: "website",
    siteName: "MANDATE",
  },
  twitter: { card: "summary_large_image" },
};

/**
 * One ground, in both schemes.
 *
 * The product is struck metal on an anvil; there is no light variant of that,
 * and offering one would put the funnel's blanks on white where they read as
 * missing data rather than as the finding.
 */
export const viewport: Viewport = {
  /* The whole product is one dark ground now, so the browser chrome matches it. */
  themeColor: "#0b0e11",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables must land on <html>, not <body>: tokens.css consumes
  // them at :root, and a var() reference to a property defined further down
  // the tree is invalid at that point, which silently drops the page to the
  // browser's default face.
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        {/* ⌘K, mounted once. It renders nothing until it is opened. */}
        <Palette />
      </body>
    </html>
  );
}
