/**
 * Whether buyers are offered escrowed jobs. Closed until one has run end to
 * end on mainnet from the test wallet: funded, delivered by our agent, and
 * read back here. Recorded jobs are delivered either way.
 */
export const ESCROW_OPEN = process.env.NEXT_PUBLIC_ESCROW_OPEN === "1";
