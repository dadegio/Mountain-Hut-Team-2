import { describe, expect, it } from "vitest";
import { BOOKING_CHANGE_WINDOW_MS, isBookingChangeAllowed } from "../../../src/booking/change-rules.ts";

describe("MH-46 / MH-06: 48-hour booking change rule", () => {
  const createdAt = "2026-11-02 09:00:00"; // SQLite UTC timestamp
  const creationTime = Date.parse("2026-11-02T09:00:00Z");

  it("permits changes immediately after creation", () => {
    expect(isBookingChangeAllowed(createdAt, new Date(creationTime))).toBe(true);
  });

  it("permits changes exactly at the 48-hour boundary", () => {
    expect(isBookingChangeAllowed(createdAt, new Date(creationTime + BOOKING_CHANGE_WINDOW_MS))).toBe(true);
  });

  it("rejects changes one millisecond after the boundary", () => {
    expect(isBookingChangeAllowed(createdAt, new Date(creationTime + BOOKING_CHANGE_WINDOW_MS + 1))).toBe(false);
  });

  it("rejects changes before the creation date", () => {
    expect(isBookingChangeAllowed(createdAt, new Date(creationTime - 1))).toBe(false);
  });

  it("interprets a SQLite timestamp as UTC independent of the server timezone", () => {
    expect(isBookingChangeAllowed("2026-06-20 10:00:00", new Date("2026-06-22T10:00:00Z"))).toBe(true);
    expect(isBookingChangeAllowed("2026-06-20T12:00:00+02:00", new Date("2026-06-22T10:00:00Z"))).toBe(true);
  });

  it("fails closed for an invalid timestamp", () => {
    expect(isBookingChangeAllowed("invalid", new Date(creationTime))).toBe(false);
    expect(isBookingChangeAllowed("2026-11-02", new Date(creationTime))).toBe(false);
    expect(
      isBookingChangeAllowed("2026-02-31 09:00:00", new Date(creationTime)),
    ).toBe(false);
    expect(
      isBookingChangeAllowed("2026-99-99T99:99:99Z", new Date(creationTime)),
    ).toBe(false);
  });
});
