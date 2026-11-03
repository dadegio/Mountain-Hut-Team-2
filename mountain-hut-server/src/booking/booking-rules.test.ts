import { describe, expect, it } from "vitest";
import { hutSlotStartMs, isSlotBookable } from "./booking-rules.ts";

describe("MH-01 booking cutoff (Europe/Rome)", () => {
  it("converts a winter date (CET)", () => {
    expect(hutSlotStartMs("2026-11-02", "12:00"))
      .toBe(Date.parse("2026-11-02T11:00:00Z"));
  });

  it("converts a summer date (CEST)", () => {
    expect(hutSlotStartMs("2026-06-20", "12:00"))
      .toBe(Date.parse("2026-06-20T10:00:00Z"));
  });

  it("allows a reservation exactly two hours before the slot", () => {
    expect(isSlotBookable("2026-11-02", "12:00", new Date("2026-11-02T09:00:00Z")))
      .toBe(true);
  });

  it("rejects a reservation after the two-hour deadline", () => {
    expect(isSlotBookable("2026-11-02", "12:00", new Date("2026-11-02T09:00:01Z")))
      .toBe(false);
  });

  it("rejects a past slot", () => {
    expect(isSlotBookable("2026-10-30", "12:00", new Date("2026-11-01T09:00:00Z")))
      .toBe(false);
  });

  it("validates date/time values", () => {
    expect(() => hutSlotStartMs("2026-02-31", "12:00")).toThrow();
    expect(() => hutSlotStartMs("2026-11-02", "25:00")).toThrow();
  });
});
