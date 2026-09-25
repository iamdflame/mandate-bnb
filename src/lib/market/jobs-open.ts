/**
 * Whether jobs with capital are open to buyers.
 *
 * A job on the market holds the buyer's capital until every epoch is settled,
 * and after the award the contract gives the buyer no way out before that. So
 * the form opens only once settlement runs on its own and a whole job has been
 * seen through on mainnet: set MANDATE_JOBS_OPEN=1 then, and not before.
 */
export const JOBS_OPEN = process.env.MANDATE_JOBS_OPEN === "1";
