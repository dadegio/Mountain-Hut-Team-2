import { describe, expect, it } from "vitest";
import {
  addHours,
  formatDuration,
  formatHikeRange,
  formatHikeTime,
  hikePhase,
  localInputToIso,
  nextFullHour,
  toLocalInput,
  validateHikeForm,
} from "../../../src/hikes/utils/hike-time.ts";

const HOUR = 60 * 60 * 1000;

describe("MH-140 hike time helpers", () => {
  describe("datetime-local values", () => {
    it("turns a local value into the same instant in ISO format", () => {
      expect(localInputToIso("2030-06-15T08:00")).toBe(
        new Date(2030, 5, 15, 8, 0).toISOString(),
      );
    });

    it.each([[""], ["not a date"]])("gives null for %j", (value) => {
      expect(localInputToIso(value)).toBeNull();
    });

    it("formats a date as a local datetime-local value", () => {
      expect(toLocalInput(new Date(2030, 0, 5, 7, 3))).toBe("2030-01-05T07:03");
    });

    it("adds hours, also across midnight", () => {
      expect(addHours("2030-06-15T08:00", 5)).toBe("2030-06-15T13:00");
      expect(addHours("2030-06-15T22:00", 3)).toBe("2030-06-16T01:00");
    });

    it("gives an empty value when there is nothing to add to", () => {
      expect(addHours("", 3)).toBe("");
    });
  });

  describe("next full hour", () => {
    it("rounds up to the next hour", () => {
      expect(nextFullHour(new Date(2030, 5, 15, 19, 42, 10))).toBe("2030-06-15T20:00");
    });

    it("moves on from an exact hour, so the departure is in the future", () => {
      expect(nextFullHour(new Date(2030, 5, 15, 20, 0, 0))).toBe("2030-06-15T21:00");
    });

    it("goes to the next day late in the evening", () => {
      expect(nextFullHour(new Date(2030, 5, 15, 23, 30))).toBe("2030-06-16T00:00");
    });
  });

  describe("formatting", () => {
    it.each([
      [9 * HOUR, "9 h"],
      [9.5 * HOUR, "9 h 30 min"],
      [26 * HOUR, "1 d 2 h"],
      [45 * 60 * 1000, "45 min"],
      [0, "0 min"],
    ])("shows %d ms as %s", (ms, text) => {
      expect(formatDuration(ms)).toBe(text);
    });

    it("shows the day once when the hike ends on the same day", () => {
      expect(formatHikeRange("2030-06-15T08:00", "2030-06-15T17:00")).toMatch(
        /^Sat,? 15 Jun · 08:00 → 17:00$/,
      );
    });

    it("shows both days for an overnight hike", () => {
      expect(formatHikeRange("2030-06-15T20:00", "2030-06-16T06:00")).toMatch(
        /15 Jun, 20:00 → .*16 Jun, 06:00$/,
      );
    });

    it("shows a single date and time", () => {
      expect(formatHikeTime("2030-06-15T17:00")).toMatch(/15 Jun, 17:00$/);
    });
  });

  describe("phase of a hike", () => {
    const hike = {
      departureAt: "2030-06-15T06:00:00.000Z",
      expectedReturnAt: "2030-06-15T15:00:00.000Z",
    };
    const at = (iso: string) => Date.parse(iso);

    it.each([
      ["2030-06-15T05:59:00.000Z", "upcoming"],
      ["2030-06-15T06:00:00.000Z", "ongoing"],
      ["2030-06-15T10:00:00.000Z", "ongoing"],
      ["2030-06-15T15:00:00.000Z", "past"],
      ["2030-06-16T00:00:00.000Z", "past"],
    ])("at %s the hike is %s", (now, phase) => {
      expect(hikePhase(hike, at(now))).toBe(phase);
    });
  });

  describe("form validation", () => {
    const now = Date.parse("2030-06-15T07:00");
    const valid = {
      route: "Lake loop on trail 12",
      departure: "2030-06-15T08:00",
      expectedReturn: "2030-06-15T12:00",
      phone: "",
    };

    it("accepts a complete form, with or without a contact", () => {
      expect(validateHikeForm(valid, now)).toBeNull();
      expect(validateHikeForm({ ...valid, phone: "+39 333 123 4567" }, now)).toBeNull();
      expect(validateHikeForm({ ...valid, phone: "   " }, now)).toBeNull();
    });

    it.each([
      [{ route: "   " }, "Describe your route."],
      [{ route: "x".repeat(2001) }, "The route description is too long (max 2000 characters)."],
      [{ departure: "" }, "Choose your departure date and time."],
      [{ expectedReturn: "" }, "Choose when you expect to be back."],
      [{ departure: "2030-06-15T07:00" }, "Departure must be in the future."],
      [{ departure: "2030-06-14T08:00" }, "Departure must be in the future."],
      [{ expectedReturn: "2030-06-15T08:00" }, "Expected return must be after departure."],
      [{ expectedReturn: "2030-06-15T07:30" }, "Expected return must be after departure."],
      [{ phone: "ab" }, "The emergency contact must be between 3 and 40 characters."],
      [{ phone: "1".repeat(41) }, "The emergency contact must be between 3 and 40 characters."],
    ])("refuses %j", (change, message) => {
      expect(validateHikeForm({ ...valid, ...change }, now)).toBe(message);
    });
  });
});