import "@/styles/builders.css";
import type { Metadata } from "next";
import { Check, Download, X } from "lucide-react";
import AppShell from "@/components/v2/shell/AppShell";
import Agent, { type CharacterState } from "@/components/characters/Agent";
import BuildersNav from "@/components/builders/BuildersNav";
import CopyHex from "@/components/builders/CopyHex";
import { FOUNDERS } from "@/components/builders/house";
import { CATEGORY_LABEL } from "@/lib/config";

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

/** The four job colours: they belong to the agents and their jobs, never to the interface. */
const JOB_COLOURS = [
  { job: "rebalancing", hex: "#3CC4B4", token: "var(--c-cat-rebalance)" },
  { job: "grid-trading", hex: "#E8A33A", token: "var(--c-cat-grid)" },
  { job: "yield-optimisation", hex: "#6FCF6A", token: "var(--c-cat-yield)" },
  { job: "health-factor", hex: "#EF7A6A", token: "var(--c-cat-health)" },
] as const;

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

/** Every pose a character can take, and the fact each one states (lib/view/state.ts). */
const POSES: { state: CharacterState; t: string; d: string }[] = [
  { state: "awake", t: "Awake", d: "Answered our call in the last 15 minutes" },
  { state: "ready", t: "Ready", d: "Can be hired: answered in the last day, with a price we can pay" },
  { state: "working", t: "Working", d: "Doing its job, in its job's own motion" },
  { state: "delivered", t: "Delivered", d: "Its work landed on chain" },
  { state: "dozing", t: "Dozing", d: "Listed, but not answering lately" },
  { state: "failed", t: "Failed", d: "Its answer did not match the chain" },
  { state: "graveyard", t: "Kept", d: "Took payment and did not deliver; kept on the record" },
  { state: "leashed", t: "Leashed", d: "On a buyer's leash, acting from their wallet" },
];

/** The brand kit: what to download, and the few rules that keep the seal a seal and a pose a fact. */
export default function BrandPage() {
  return (
    <AppShell>
      <div className="bd-page bd-brand">
        <BuildersNav current="brand" />

        <header className="bd-hero bd-brand__hero">
          <div className="bd-look__pool" aria-hidden="true" />
          <div className="k-wrap bd-hero__in">
            <div className="bd-hero__copy">
              <h1 className="k-display k-rise" style={{ ["--i" as string]: 0 }}>
                Brand kit
              </h1>
              <p className="k-lede k-rise" style={{ ["--i" as string]: 1 }}>
                A notary seal around the M: every agent is checked on chain before you hire it. The agents themselves are the rest of the brand.
              </p>
              <div className="k-row k-rise" style={{ ["--i" as string]: 2 }}>
                <a className="k-btn k-btn--primary k-btn--lg" href={`${KIT}/mandate-brand-kit.zip`} download>
                  <Download size={16} aria-hidden="true" /> Download the kit
                </a>
                <a className="k-btn k-btn--lg k-btn--ghost" href="#characters">
                  Meet the characters
                </a>
              </div>
              <p className="k-small k-rise" style={{ ["--i" as string]: 3 }}>
                Logos, the seal, social images and the font licences, in one zip.
              </p>
            </div>
            <div className="bd-seal" aria-hidden="true">
              <div className="bd-seal__floor" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="bd-seal__mark" src={`${KIT}/mandate-mark.svg`} alt="" width={240} height={240} />
              {FOUNDERS.map((f, i) => (
                <span key={f.id} className={`bd-seal__f bd-seal__f--${i}`} style={{ ["--i" as string]: i }}>
                  <Agent job={f.job} seed={`brand-hero-${i}`} size={i === 0 ? 132 : 112} state="awake" view={i % 2 ? "three-quarter" : "front"} slot="seal" />
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="k-section k-section--tight" aria-labelledby="h-files">
          <div className="k-wrap">
            <h2 id="h-files" className="k-h2 bd-brand__h">
              Files
            </h2>
            <ul className="bd-files">
              {FILES.map((f) => (
                <li key={f.title} className="bd-file">
                  <div className={f.light ? "bd-file__preview bd-file__preview--light" : "bd-file__preview"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.preview} alt={f.title} loading="lazy" />
                  </div>
                  <div className="bd-file__body">
                    <p className="bd-file__t">{f.title}</p>
                    <p className="bd-file__dl">
                      {f.files.map((x) => (
                        <a key={x.href} className="k-chip bd-file__a" href={x.href} download>
                          <Download size={13} aria-hidden="true" /> {x.label}
                        </a>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band" aria-labelledby="h-colour">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-colour" className="k-h2">
                  Colour
                </h2>
                <p className="k-body">Ink, paper and one green. Press a swatch to copy its hex.</p>
              </div>
            </div>
            <ul className="bd-swatches">
              {COLOURS.map((c) => (
                <li key={c.name} className="bd-swatch">
                  <CopyHex hex={c.hex} name={c.name} token={c.token} />
                  <p className="bd-swatch__t">
                    <span>{c.name}</span> <span className="k-mono bd-swatch__hex">{c.hex}</span>
                  </p>
                  <p className="bd-swatch__use">{c.use}</p>
                </li>
              ))}
            </ul>
            <div className="bd-jobcolours">
              <p className="bd-jobcolours__k">The four job colours belong to the agents and their jobs, never to buttons or text.</p>
              <ul>
                {JOB_COLOURS.map((c) => (
                  <li key={c.job} data-job={c.job}>
                    <CopyHex hex={c.hex} name={CATEGORY_LABEL[c.job]} token={c.token} />
                    <span className="bd-jobcolours__t">{CATEGORY_LABEL[c.job]}</span>
                    <span className="k-mono bd-swatch__hex">{c.hex}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="k-section k-section--tight" aria-labelledby="h-type">
          <div className="k-wrap">
            <h2 id="h-type" className="k-h2 bd-brand__h">
              Type
            </h2>
            <ul className="bd-type">
              <li className="bd-type__row">
                <p className="bd-type__sample bd-type__sample--display">Hire an agent you can check.</p>
                <p className="bd-type__use">
                  <strong>Instrument Sans</strong> for the wordmark and headings
                </p>
              </li>
              <li className="bd-type__row">
                <p className="bd-type__sample bd-type__sample--text">Every agent is checked on chain before you pay, and can only take what you sign.</p>
                <p className="bd-type__use">
                  <strong>Inter</strong> for everything read
                </p>
              </li>
              <li className="bd-type__row">
                <p className="bd-type__sample bd-type__sample--mono k-mono">0x8004A169FB4a3325136EB29fA0ceB6D2e539a432</p>
                <p className="bd-type__use">
                  <strong>JetBrains Mono</strong> for addresses and hashes only
                </p>
              </li>
            </ul>
          </div>
        </section>

        <section className="k-section k-section--tight bd-band bd-chars" id="characters" aria-labelledby="h-chars">
          <div className="k-wrap">
            <div className="k-shead">
              <div className="k-shead__copy">
                <h2 id="h-chars" className="k-h2">
                  The characters
                </h2>
                <p className="k-body">
                  Every agent is drawn. Its family and colour come from its job, its face from its token id, so no two agents look alike and the same agent always looks the same.
                </p>
              </div>
            </div>
            <ul className="bd-founders">
              {FOUNDERS.map((f, i) => (
                <li key={f.id} className="bd-founder" data-job={f.job} style={{ ["--i" as string]: i }}>
                  <span className="bd-founder__art" aria-hidden="true">
                    <Agent job={f.job} seed={f.id} house size={150} state="ready" slot="founder" />
                  </span>
                  <span className="bd-founder__name">{f.name}</span>
                  <span className="bd-founder__job">{CATEGORY_LABEL[f.job]}, ours</span>
                </li>
              ))}
            </ul>
            <p className="k-small bd-chars__note">Our own four are the founders of each job&apos;s family and wear the seal. They are drawn here in the default pose, as a model sheet; on a live page every agent wears the state we last read.</p>

            <div className="bd-poses">
              <div className="bd-poses__head">
                <h3 className="k-h3">A pose is a fact</h3>
                <p className="k-body">An agent is drawn in the pose our last reading found, never for mood. Drawings that stand for no real agent use a neutral face.</p>
              </div>
              <ul className="bd-poses__grid">
                {POSES.map((p, i) => (
                  <li key={p.state} className="bd-pose" style={{ ["--i" as string]: i }}>
                    <span className="bd-pose__art" aria-hidden="true">
                      <Agent job="rebalancing" seed="brand-sheet" size={96} state={p.state} slot={`pose${i}`} />
                    </span>
                    <span className="bd-pose__t">{p.t}</span>
                    <span className="bd-pose__d">{p.d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="k-section k-section--tight" aria-labelledby="h-use">
          <div className="k-wrap">
            <h2 id="h-use" className="k-h2 bd-brand__h">
              Use
            </h2>
            <ul className="bd-rules">
              <li className="bd-rules__do">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> Leave clear space of half the seal on every side.
              </li>
              <li className="bd-rules__dont">
                <X size={16} strokeWidth={3} aria-hidden="true" /> Keep the seal green on ink or paper. Do not recolour, rotate, outline or stretch it.
              </li>
              <li className="bd-rules__do">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> Below 24 pixels, use the seal without its inner ring (the favicon).
              </li>
              <li className="bd-rules__dont">
                <X size={16} strokeWidth={3} aria-hidden="true" /> Do not pose a character for mood. On a live page, a real agent&apos;s pose is its real state.
              </li>
              <li className="bd-rules__do">
                <Check size={16} strokeWidth={3} aria-hidden="true" /> The fonts are under the SIL Open Font Licence; the licences are in the kit.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
