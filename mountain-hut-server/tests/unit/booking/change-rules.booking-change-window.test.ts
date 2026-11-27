import { describe, expect, it } from "vitest";
import { BOOKING_CHANGE_WINDOW_MS, isBookingChangeAllowed } from "../../../src/booking/rules/change-rules.ts";

describe("MH-174 / MH-06: 48-hour booking change deadline", () => {
  const date = "2026-11-30";
  const from = "13:00";
  const deadline = Date.parse("2026-11-30T12:00:00Z") - BOOKING_CHANGE_WINDOW_MS;

  it("allows changes more than 48 hours before the slot", () => {
    expect(isBookingChangeAllowed(date, from, new Date(deadline - 1))).toBe(true);
  });
  it("allows changes exactly 48 hours before the slot", () => {
    expect(isBookingChangeAllowed(date, from, new Date(deadline))).toBe(true);
  });
  it("rejects changes one millisecond after the deadline", () => {
    expect(isBookingChangeAllowed(date, from, new Date(deadline + 1))).toBe(false);
  });
  it("rejects changes after the slot starts", () => {
    expect(isBookingChangeAllowed(date, from, new Date("2026-11-30T12:01:00Z"))).toBe(false);
  });
  it("handles summer time in Europe/Rome", () => {
    expect(isBookingChangeAllowed("2026-06-20", "12:00", new Date("2026-06-18T10:00:00Z"))).toBe(true);
    expect(isBookingChangeAllowed("2026-06-20", "12:00", new Date("2026-06-18T10:00:00.001Z"))).toBe(false);
  });
  it("fails closed for malformed slots", () => {
    expect(isBookingChangeAllowed("invalid", from)).toBe(false);
    expect(isBookingChangeAllowed("2026-02-31", from)).toBe(false);
    expect(isBookingChangeAllowed(date, "25:00")).toBe(false);
  });
});
