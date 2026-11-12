import { describe, expect, it } from "vitest";
import { registerHikeSchema, validateHikeChronology } from "../../../src/hikes/hike-validation.ts";

const now = new Date("2026-12-01T10:00:00.000Z");
const valid = {
  departureAt: "2026-12-03T08:00:00+01:00",
  expectedReturnAt: "2026-12-03T17:00:00+01:00",
  routeDescription: "Rifugio to summit via the marked trail",
};

describe("MH-139 hike registration rules", () => {
  it("accepts valid date-times with an explicit offset", () => {
    const result = registerHikeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(validateHikeChronology(valid, now)).toBeNull();
  });

  it("accepts Z timestamps and an optional emergency contact", () => {
    expect(registerHikeSchema.safeParse({
      ...valid,
      departureAt: "2026-12-03T07:00:00Z",
      emergencyContactPhone: "+393331234567",
    }).success).toBe(true);
  });

  it("rejects reversed or identical times", () => {
    const same = { ...valid, expectedReturnAt: valid.departureAt };
    expect(validateHikeChronology(same, now)).toBe("Expected return must be after departure");
    expect(validateHikeChronology({ ...valid, expectedReturnAt: "2026-12-03T06:00:00Z" }, now))
      .toBe("Expected return must be after departure");
  });

  it("rejects departure in the past or at the current time", () => {
    expect(validateHikeChronology({ ...valid, departureAt: now.toISOString() }, now))
      .toBe("Departure must be in the future");
    expect(validateHikeChronology({ ...valid, departureAt: "2026-11-30T09:00:00Z" }, now))
      .toBe("Departure must be in the future");
  });

  it.each([
    [{ ...valid, routeDescription: " " }, "empty route"],
    [{ ...valid, routeDescription: "x".repeat(2001) }, "too-long route"],
    [{ ...valid, departureAt: "2026-12-03 08:00" }, "no explicit timezone"],
    [{ ...valid, emergencyContactPhone: "a" }, "short contact"],
    [{ ...valid, userId: 777 }, "client-provided userId"],
  ])("rejects %s (%s)", (input, _reason) => {
    expect(registerHikeSchema.safeParse(input).success).toBe(false);
  });
});
