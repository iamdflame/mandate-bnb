/**
 * One sentence per task, in one place.
 *
 * The report script and the /proof page both print the six verdicts. If each
 * kept its own copy, the page and the report would drift apart the first
 * time a result was re-measured. These hold that there is one library, that
 * both readers use it, and that the committed report is what it renders.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { plain, readAdvantage, verdictFor } from "../advantage/report";

const root = process.cwd();
const script = readFileSync(join(root, "src/scripts/advantage-report.ts"), "utf8");
const report = readFileSync(join(root, "docs/AGENT_ADVANTAGE_REPORT.md"), "utf8");

describe("the verdicts", () => {
  it("say a task was not run rather than describe numbers nobody took", () => {
    expect(verdictFor("T4", null)).toEqual({ verdict: "inconclusive", line: "Not run in this window." });
  });

  it("are read from the locked results: six tasks, every one counted, the loss included", () => {
    const r = readAdvantage();
    expect(r).not.toBeNull();
    expect(r!.tasks.map((t) => t.id)).toEqual(["T1", "T2", "T3", "T4", "T5", "T6"]);
    const total = Object.values(r!.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(6);
    expect(r!.counts.loss).toBeGreaterThan(0);
    expect(r!.anchor.specHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("come from one library that the report script imports, with no second copy", () => {
    expect(script).toMatch(/import \{[^}]*verdictFor[^}]*\} from "@\/lib\/advantage\/report"/);
    // Phrases only the verdict sentences contain. Finding one in the script means a second copy.
    for (const phrase of ["Being early costs", "cards were contradicted", "sampled positions were past"]) expect(script).not.toContain(phrase);
  });

  it("are exactly what the committed report prints, so the page and the report agree", () => {
    const r = readAdvantage()!;
    for (const t of r.tasks) {
      const bolded = t.line.replace(/^Loss\./, "**Loss.**").replace(/loss on coverage\./, "**loss on coverage.**");
      expect(report, `${t.id} in docs/AGENT_ADVANTAGE_REPORT.md`).toContain(bolded);
    }
  });

  it("print the locked specification without dashes, while the file that is hashed keeps them", () => {
    const r = readAdvantage()!;
    for (const t of r.tasks) for (const s of [t.title, t.humanArm, t.agentArm, t.metric, t.line]) expect(s).not.toMatch(/—/);
    expect(report).not.toMatch(/—/);
    expect(readFileSync(join(root, "docs/advantage/INPUT_LOCK.json"), "utf8")).toMatch(/—/);
    expect(plain("a stand-in for a human — it is the benchmark")).toBe("a stand-in for a human, it is the benchmark");
  });
});
