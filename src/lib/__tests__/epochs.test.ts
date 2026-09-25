import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ sql: null, db: null, hasDb: false }));

describe("the epoch clock", () => {
  it("keeps the opening mark for Hold and LiquidationAvoided, and grows it at the passive rate for BestPassiveRate", async () => {
    const { benchmarkNow } = await import("../market/epochs");
    const prev = 1_000_000_000_000_000n;
    expect(benchmarkNow(0, prev, 3600n, 500n)).toBe(prev);
    expect(benchmarkNow(2, prev, 3600n, 500n)).toBe(prev);
    // 5% a year for one hour: prev * 0.05 * 3600 / 31536000.
    expect(benchmarkNow(1, prev, 3600n, 500n)).toBe(prev + (prev * 500n * 3600n) / (10_000n * 365n * 24n * 3600n));
    expect(benchmarkNow(1, prev, 3600n, null)).toBe(prev);
    // The first import loads the chain modules.
  }, 60_000);

  it("never reaches our September test jobs, #0 to #4", async () => {
    const { EPOCHS_FROM } = await import("../market/epochs");
    expect(EPOCHS_FROM).toBeGreaterThanOrEqual(5);
  });
});
