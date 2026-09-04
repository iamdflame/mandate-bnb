import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
  Fonts are self-hosted rather than fetched by `next/font/google`.

  The Google fetch is a build-time network dependency, and it was intermittently
  timing out here — which fails the build in a way that surfaces as an unrelated
  null-context error during prerender. Self-hosting removes the dependency
  entirely, drops a third-party request at runtime, and makes the build
  reproducible offline.
*/

const display = localFont({
  src: "./fonts/InstrumentSerif-Regular.woff2",
  variable: "--font-display-loaded",
  display: "swap",
  weight: "400",
});

const mono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono-loaded",
  display: "swap",
});

const sans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-sans-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ASSAY — the assay office for on-chain agents",
  description:
    "301,207 agents claim BNB Smart Chain. Five can prove it. ASSAY tests every registry claim against the chain and publishes the evidence.",
  openGraph: {
    title: "ASSAY",
    description: "301,207 agents claim BNB Smart Chain. Five can prove it.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a09" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables must land on <html>, not <body>: globals.css consumes
  // them at :root, and a var() reference to a property defined further down
  // the tree is invalid at that point, which silently kills the whole
  // declaration and drops the page to Times New Roman.
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
