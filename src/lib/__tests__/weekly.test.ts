import { describe, expect, it } from "vitest";
import { byWeek, weekOf } from "../market/weekly";

const OURS = "0x0000000000000000000000000000000000000001";
const team = (w: string) => w.toLowerCase() === OURS;

describe("outside jobs by week", () => {
  it("starts a week on Monday, UTC", () => {
    expect(weekOf("2026-11-08T23:59:00Z")).toBe("2026-11-02"); // a Sunday
    expect(weekOf("2026-11-09T00:00:00Z")).toBe("2026-11-09"); // a Monday
  });

  it("counts buyers' jobs and keeps ours apart", () => {
    const rows = [
      { client: "0xAAA", status: "COMPLETED", at: "2026-11-03T10:00:00Z" },
      { client: "0xaaa", status: "SUBMITTED", at: "2026-11-04T10:00:00Z" },
      { client: "0xBBB", status: "EXPIRED", at: "2026-11-05T10:00:00Z" },
      { client: OURS, status: "COMPLETED", at: "2026-11-05T11:00:00Z" },
      { client: "0xCCC", status: "OPEN", at: "2026-11-05T12:00:00Z" },
      { client: "0xCCC", status: "FUNDED", at: "2026-11-10T12:00:00Z" },
    ];
    expect(byWeek(rows, team)).toEqual([
      { week: "2026-11-09", jobs: 1, delivered: 0, buyers: 1, ours: 0 },
      { week: "2026-11-02", jobs: 3, delivered: 2, buyers: 2, ours: 1 },
    ]);
  });
});
