import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPastDate,
  slotsOverlap,
  todayString,
  totalSeats,
} from "../../../src/slots/slot-rules.ts";

describe("todayString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a date as YYYY-MM-DD", () => {
    expect(todayString(new Date(2026, 10, 16))).toBe("2026-11-16");
  });

  it("pads month and day with a leading zero", () => {
    expect(todayString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses the local date, also right after midnight and late at night", () => {
    expect(todayString(new Date(2026, 10, 6, 0, 30))).toBe("2026-11-06");
    expect(todayString(new Date(2026, 10, 6, 23, 30))).toBe("2026-11-06");
  });

  it("uses the current date when no date is given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 25, 12, 0));

    expect(todayString()).toBe("2026-12-25");
  });
});

describe("isPastDate", () => {
  const today = "2026-11-06";

  it("is true for a day before today", () => {
    expect(isPastDate("2026-11-05", today)).toBe(true);
  });

  it("is false for today: a slot can still be created today", () => {
    expect(isPastDate(today, today)).toBe(false);
  });

  it("is false for a day after today", () => {
    expect(isPastDate("2026-11-07", today)).toBe(false);
  });

  it("works across month and year boundaries", () => {
    expect(isPastDate("2026-10-31", today)).toBe(true);
    expect(isPastDate("2025-12-31", today)).toBe(true);
    expect(isPastDate("2026-12-01", today)).toBe(false);
    expect(isPastDate("2027-01-01", today)).toBe(false);
  });
});

describe("slotsOverlap", () => {
  const lunch = { from: "12:00", to: "13:00" };

  it.each([
    ["partially, starting during the slot", { from: "12:30", to: "13:30" }],
    ["partially, ending during the slot", { from: "11:30", to: "12:30" }],
    ["when contained in the slot", { from: "12:15", to: "12:45" }],
    ["when containing the slot", { from: "11:00", to: "14:00" }],
    ["when identical", { from: "12:00", to: "13:00" }],
    ["with the same start and a later end", { from: "12:00", to: "14:00" }],
    ["with the same end and an earlier start", { from: "11:00", to: "13:00" }],
    ["by a single minute", { from: "12:59", to: "14:00" }],
  ])("overlaps %s", (_description, other) => {
    expect(slotsOverlap(lunch, other)).toBe(true);
    expect(slotsOverlap(other, lunch)).toBe(true);
  });

  it.each([
    ["starting when the slot ends", { from: "13:00", to: "14:00" }],
    ["ending when the slot starts", { from: "11:00", to: "12:00" }],
    ["later in the day", { from: "19:00", to: "21:00" }],
    ["earlier in the day", { from: "08:00", to: "09:00" }],
  ])("does not overlap %s", (_description, other) => {
    expect(slotsOverlap(lunch, other)).toBe(false);
    expect(slotsOverlap(other, lunch)).toBe(false);
  });

  it("compares hours correctly thanks to the zero padding", () => {
    expect(
      slotsOverlap({ from: "09:00", to: "10:00" }, { from: "10:00", to: "11:00" }),
    ).toBe(false);
    expect(
      slotsOverlap({ from: "09:00", to: "12:00" }, { from: "10:00", to: "11:00" }),
    ).toBe(true);
  });

  it("accepts objects with extra fields, such as database rows", () => {
    const row = { id: 1, date: "2026-11-06", from: "12:30", to: "13:30" };

    expect(slotsOverlap(row, lunch)).toBe(true);
  });
});

describe("totalSeats", () => {
  it("is 0 for a slot without tables", () => {
    expect(totalSeats([])).toBe(0);
  });

  it("is the seats of the table when there is only one", () => {
    expect(totalSeats([{ seats: 4 }])).toBe(4);
  });

  it("adds up the seats of all the tables", () => {
    expect(totalSeats([{ seats: 2 }, { seats: 4 }, { seats: 6 }])).toBe(12);
  });

  it("only looks at the seats of tables with extra fields", () => {
    const tables = [
      { id: 1, code: "T1", seats: 2 },
      { id: 2, code: "T2", seats: 8 },
    ];

    expect(totalSeats(tables)).toBe(10);
  });
});
