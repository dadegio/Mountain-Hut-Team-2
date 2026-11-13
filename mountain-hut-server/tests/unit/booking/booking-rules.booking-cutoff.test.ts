import { describe, expect, it } from "vitest";
import { hutSlotStartMs, isSlotBookable } from "../../../src/booking/rules/booking-rules.ts";

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
    expect(() => hutSlotStartMs("2026/11/02", "12:00")).toThrow(
      "Invalid slot date or time",
    );
    expect(() => hutSlotStartMs("2026-11-02", "12")).toThrow(
      "Invalid slot date or time",
    );
  });

  it("rejects a wall time skipped by the spring daylight-saving change", () => {
    expect(() => hutSlotStartMs("2026-03-29", "02:30")).toThrow(
      "Slot time is invalid or ambiguous in the hut timezone",
    );
  });

  it("resolves the repeated autumn wall time consistently", () => {
    expect(hutSlotStartMs("2026-10-25", "02:30")).toBe(
      Date.parse("2026-10-25T01:30:00Z"),
    );
  });

  it("allows valid times on both sides of the daylight-saving transition", () => {
    expect(hutSlotStartMs("2026-03-29", "01:30")).toBe(
      Date.parse("2026-03-29T00:30:00Z"),
    );
    expect(hutSlotStartMs("2026-03-29", "03:30")).toBe(
      Date.parse("2026-03-29T01:30:00Z"),
    );
  });
});
