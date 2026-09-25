import type { Metadata } from "next";
import { Download } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";

export const metadata: Metadata = {
  title: "Brand | MANDATE",
  description: "The MANDATE logo, colours and type, to download.",
};

const KIT = "/brand-kit";

const COLOURS = [
  { name: "Signature", hex: "#13B98A", token: "var(--c-accent)", use: "The seal and the one primary action on a screen" },
  { name: "Deep", hex: "#0B7A5C", token: "var(--c-accent-lo)", use: "Pressed states and the seal's shade" },
  { name: "Ink", hex: "#0B0D0E", token: "var(--c-bg)", use: "The ground" },
  { name: "Night", hex: "#111417", token: "var(--c-surface)", use: "Surfaces" },
  { name: "Paper", hex: "#FAFAF8", token: "var(--c-text)", use: "Text on ink, and the light ground" },
  { name: "Slate", hex: "#5B6168", token: "var(--c-slate)", use: "Quiet detail" },
];

const FILES: { title: string; preview: string; light?: boolean; files: { label: string; href: string }[] }[] = [
  {
    title: "Logo, on dark",
    preview: `${KIT}/mandate-logo-on-dark.svg`,
    files: [
      { label: "SVG", href: `${KIT}/mandate-logo-on-dark.svg` },
      { label: "PNG", href: `${KIT}/mandate-logo-on-dark.png` },
    ],
  },
  {
    title: "Logo, on light",
    preview: `${KIT}/mandate-logo-on-light.svg`,
    light: true,
    files: [
      { label: "SVG", href: `${KIT}/mandate-logo-on-light.svg` },
      { label: "PNG", href: `${KIT}/mandate-logo-on-light.png` },
    ],
  },
  {
    title: "The seal",
    preview: `${KIT}/mandate-mark.svg`,
    files: [
      { label: "SVG", href: `${KIT}/mandate-mark.svg` },
      { label: "PNG 512", href: `${KIT}/mandate-mark-512.png` },
      { label: "PNG 1024", href: `${KIT}/mandate-mark-1024.png` },
    ],
  },
  {
    title: "Social",
    preview: `${KIT}/og-1200x630.png`,
    files: [
      { label: "X avatar", href: `${KIT}/x-avatar-400.png` },
      { label: "X header", href: `${KIT}/x-header-1500x500.png` },
      { label: "Telegram", href: `${KIT}/telegram-avatar-640.png` },
      { label: "Link preview", href: `${KIT}/og-1200x630.png` },
    ],
  },
];

/** The brand kit: what to download, and the few rules that keep the seal a seal. */
export default function BrandPage() {
  return (
    <AppShell>
      <section className="x-wrap x-mkt-head">
        <div className="x-mkt-head__row">
          <h1 className="x-mkt-head__h">Brand</h1>
          <p className="x-mkt-head__sub">A notary seal around the M: every agent is checked on chain before you hire it.</p>
        </div>
        <a className="x-btn x-btn--primary" href={`${KIT}/mandate-brand-kit.zip`} download>
          <Download size={16} aria-hidden="true" /> Download the kit
        </a>
      </section>

      <div className="x-wrap x-section--tight x-brandkit">
        <ul className="x-brandkit__files">
          {FILES.map((f) => (
            <li key={f.title} className="x-brandkit__file">
              <div className={f.light ? "x-brandkit__preview x-brandkit__preview--light" : "x-brandkit__preview"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview} alt={f.title} loading="lazy" />
              </div>
              <p className="x-brandkit__t">{f.title}</p>
              <p className="x-brandkit__dl">
                {f.files.map((x) => (
                  <a key={x.href} className="x-link" href={x.href} download>
                    {x.label}
                  </a>
                ))}
              </p>
            </li>
          ))}
        </ul>

        <h2 className="x-brandkit__h">Colour</h2>
        <ul className="x-brandkit__swatches">
          {COLOURS.map((c) => (
            <li key={c.name}>
              <span className="x-brandkit__chip" style={{ background: c.token }} aria-hidden="true" />
              <p className="x-brandkit__t">
                {c.name} <span className="x-mono x-brandkit__hex">{c.hex}</span>
              </p>
              <p className="x-brandkit__use">{c.use}</p>
            </li>
          ))}
        </ul>

        <h2 className="x-brandkit__h">Type</h2>
        <ul className="x-brandkit__type">
          <li>
            <p className="x-brandkit__sample x-brandkit__sample--display">Hire an agent you can check.</p>
            <p className="x-brandkit__use">Instrument Sans, for the wordmark and headings</p>
          </li>
          <li>
            <p className="x-brandkit__sample">Every agent is checked on chain before you pay, and can only take what you sign.</p>
            <p className="x-brandkit__use">Inter, for everything read</p>
          </li>
          <li>
            <p className="x-brandkit__sample x-mono">0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</p>
            <p className="x-brandkit__use">JetBrains Mono, for addresses and hashes only</p>
          </li>
        </ul>

        <h2 className="x-brandkit__h">Use</h2>
        <ul className="x-brandkit__rules">
          <li>Leave clear space of half the seal on every side.</li>
          <li>Keep the seal green on ink or paper. Do not recolour, rotate, outline or stretch it.</li>
          <li>Below 24 pixels, use the seal without its inner ring (the favicon).</li>
          <li>The fonts are under the SIL Open Font Licence; the licences are in the kit.</li>
        </ul>
      </div>
    </AppShell>
  );
}
