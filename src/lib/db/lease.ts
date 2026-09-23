/**
 * One holder at a time, across every serverless instance.
 *
 * Work that must not run twice at once (a house agent's turn, a chunk of a
 * log scan) takes a row in `leases` that expires on its own, so a function
 * killed mid-way never locks the work out for longer than its lease. Without
 * a database there is only one process, and the work simply runs.
 */

import { sql as pg } from "@/lib/db/client";
import { ensureTables } from "@/lib/db/tables";

/** Runs `fn` if the lease was free, and returns null without running it if another holder has it. */
export async function withLease<T>(name: string, seconds: number, fn: () => Promise<T>): Promise<T | null> {
  if (!pg) return fn();
  await ensureTables();
  const got = (await pg`
    insert into leases (name, until) values (${name}, now() + ${`${seconds} seconds`}::interval)
    on conflict (name) do update set until = excluded.until where leases.until < now()
    returning name
  `) as { name: string }[];
  if (!got.length) return null;
  try {
    return await fn();
  } finally {
    await pg`update leases set until = now() where name = ${name}`.catch(() => undefined);
  }
}
