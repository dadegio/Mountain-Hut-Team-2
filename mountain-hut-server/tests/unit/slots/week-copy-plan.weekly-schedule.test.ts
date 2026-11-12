import { describe, expect, it } from "vitest";
import { addUtcDays, isMonday, planWeekCopy } from "../../../src/slots/week-copy-plan.ts";

const sourceSlots = [
  { id: 10, date: "2027-03-22", from: "12:00", to: "14:00" },
  { id: 11, date: "2027-03-28", from: "19:00", to: "21:00" },
];

describe("MH-144 weekly schedule date mapping", () => {
  it("recognizes Mondays", () => {
    expect(isMonday("2027-03-22")).toBe(true);
    expect(isMonday("2027-03-23")).toBe(false);
  });

  it("keeps dates correct across New Year", () => {
    expect(addUtcDays("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("preserves weekdays, times and source associations", () => {
    expect(planWeekCopy("2027-03-22", "2027-03-29", 1, sourceSlots)).toEqual([
      { sourceSlotId: 10, date: "2027-03-29", from: "12:00", to: "14:00" },
      { sourceSlotId: 11, date: "2027-04-04", from: "19:00", to: "21:00" },
    ]);
  });

  it("repeats the weekly template multiple times across daylight saving", () => {
    const planned = planWeekCopy("2027-03-22", "2027-03-29", 2, sourceSlots);
    expect(planned.map((s) => s.date)).toEqual([
      "2027-03-29", "2027-04-04", "2027-04-05", "2027-04-11",
    ]);
    expect(planned).toHaveLength(4);
  });

  it("allows an empty source slot list", () => {
    expect(planWeekCopy("2027-03-22", "2027-03-29", 2, [])).toEqual([]);
  });

  it("rejects slots outside the selected source week", () => {
    expect(() => planWeekCopy("2027-03-22", "2027-03-29", 1, [
      { id: 1, date: "2027-03-29", from: "10:00", to: "11:00" },
    ])).toThrow("source week");
  });
});
