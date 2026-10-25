/**
 * The self-check, read now and printed, without saving or sending: what the
 * hourly job would flag.
 *
 *   npx tsx --env-file=.env --env-file-if-exists=.env.local src/scripts/self-check.ts
 */

import { checkDependencies, compare, latestSelfCheck } from "@/lib/ops/self-check";
import { warm } from "@/lib/data/snapshots";

(async () => {
  const deps = await checkDependencies();
  for (const d of deps) console.log(`${d.ok ? "up  " : "DOWN"} ${d.group.padEnd(13)} ${d.name.padEnd(26)} ${d.ms} ms  ${d.detail}`);
  await warm(["self-check"]);
  const last = latestSelfCheck();
  if (last?.reading) {
    const flags = compare(last.reading, last.history[0] ?? null, deps);
    console.log(`\nlast stored reading (${last.at}):`, JSON.stringify(last.reading));
    console.log(flags.length ? `would flag:\n${flags.map((f) => `  ${f.what}`).join("\n")}` : "nothing to flag on the services and the last reading");
  } else console.log("\nno stored reading yet");
  process.exit(0);
})();
