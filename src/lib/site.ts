/**
 * The site's own address, in one place.
 *
 * BNB's Phase 2 rules require the marketplace to live on a domain we control,
 * so the address is set per deployment through `NEXT_PUBLIC_HOST` rather than
 * written into fifty files. Every link we publish, every API envelope and
 * every agent registration document takes it from here.
 */
export const SITE = (process.env.NEXT_PUBLIC_HOST ?? "https://mandate-coral.vercel.app").replace(/\/$/, "");

/** The address without its scheme, for sentences. */
export const SITE_HOST = SITE.replace(/^https?:\/\//, "");

/**
 * The platform address older records point at.
 *
 * Our reference agents' ERC-8004 registrations and our own token #336161 were
 * written on chain with this host in them, so it keeps serving the paths those
 * records name even after pages move to our own domain.
 */
export const LEGACY_HOST = "mandate-coral.vercel.app";

/** Where people get help, in one place: every "Need help?" and the footer read this. */
export const SUPPORT = {
  email: "support@mandatemarkets.com",
  telegram: "https://t.me/mandatebnb",
  x: "https://x.com/mandatebnb",
} as const;
