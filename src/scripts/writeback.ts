/**
 * Publishes assay results back into the ERC-8004 Reputation Registry.
 *
 *   npm run writeback -- 2410            one agent
 *   npm run writeback -- 2410 --dry      assay and show the record, send nothing
 *
 * We found this registry is manufactured — 3,000 records from 32 wallets, 99%
 * of them from a coordinated cohort. Rather than route around it, every assay
 * goes back in as feedback anyone can reproduce from public chain state.
 *
 * Each record carries the tag `mandate-assay`, so a reader who does not trust
 * us can filter every one of ours out in a single pass. That is deliberate: a
 * contribution that cannot be excluded is not a contribution, it is noise.
 */

import { assayAgent } from "@/lib/assay";
import { hallmarkFor } from "@/lib/assay/types";
import { buildWriteBack, publishFeedback, MANDATE_TAG, REPUTATION_REGISTRY } from "@/lib/chain/reputation";
import { marketClient } from "@/lib/chain/market";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry");
const CHAIN = Number(process.env.CHAIN_ID ?? 56);

if (args.length === 0) {
  console.error("usage: npm run writeback -- <tokenId> [--dry]");
  process.exit(1);
}

console.log(`\n  registry ${REPUTATION_REGISTRY}`);
console.log(`  tag      ${MANDATE_TAG} — every record we write carries it, so ours can be excluded\n`);

let failures = 0;

for (const tokenId of args) {
  process.stdout.write(`  assaying ${tokenId}…`);
  let report;
  try {
    report = await assayAgent(CHAIN, tokenId);
  } catch (e) {
    console.log(`\r  ${tokenId}: assay failed — ${String(e).slice(0, 90)}`);
    failures++;
    continue;
  }

  const findings = report.results.map((r) => `${r.id}:${r.verdict}:${r.score.toFixed(3)}`);
  const record = buildWriteBack({
    agentId: tokenId,
    fineness: report.fineness,
    hallmark: hallmarkFor(report.fineness).name,
    findings,
  });

  console.log(`\r  ${tokenId}  ${report.name ?? "unnamed"}`);
  console.log(`    fineness  ${record.fineness}/1000 (${record.hallmark}) → registry score ${record.score}/100`);
  console.log(`    findings  ${findings.join("  ")}`);
  console.log(`    filehash  ${record.filehash}`);
  console.log(`    uri       ${record.fileuri}`);

  if (DRY) {
    console.log(`    (dry — nothing sent)\n`);
    continue;
  }

  try {
    const hash = await publishFeedback(record);
    const r = await marketClient.waitForTransactionReceipt({ hash });
    if (r.status === "success") {
      console.log(`    published https://bscscan.com/tx/${hash}\n`);
    } else {
      console.log(`    REVERTED  https://bscscan.com/tx/${hash}\n`);
      failures++;
    }
  } catch (e) {
    console.log(`    failed    ${String(e).replace(/\s+/g, " ").slice(0, 200)}\n`);
    failures++;
  }
}

process.exit(failures > 0 ? 1 : 0);
