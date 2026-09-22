import Link from "next/link";

/**
 * The mark: an octagonal punch with an M knocked out of it.
 *
 * Deliberately not a variant of the BNB Chain logo. MANDATE is its own
 * product built on the chain, so the mark borrows the ecosystem's yellow and
 * nothing else.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" style={{ display: "block", flex: "none" }}>
      <path d="M9 0 H23 L32 9 V23 L23 32 H9 L0 23 V9 Z" fill="var(--c-accent)" />
      <path d="M9.4 23.4 V9.6 L16 17.4 L22.6 9.6 V23.4" fill="none" stroke="var(--c-accent-ink)" strokeWidth="3.1" strokeLinejoin="miter" />
    </svg>
  );
}

export default function Brand() {
  return (
    <Link href="/" className="x-brand" aria-label="MANDATE, home">
      <Mark />
      <span className="x-brand__word">MANDATE</span>
    </Link>
  );
}
