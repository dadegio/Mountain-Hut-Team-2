import { describe, expect, it } from "vitest";

import { validateHikeChronology } from "#src/hikes/hike-validation";
import { registerHikeSchema } from "#src/hikes/hike-schema";

const now = new Date("2026-12-01T10:00:00.000Z");
const valid = {
  departureAt: "2026-12-03T08:00:00+01:00",
  expectedReturnAt: "2026-12-03T17:00:00+01:00",
  destination: "Monviso summit",
  routeDescription: "Rifugio to summit via the marked trail",
  intermediatePoints: ["Viso Mozzo", "Lago Chiaretto"],
};

describe("MH-139 hike registration rules", () => {
  it("accepts valid date-times with an explicit offset", () => {
    const result = registerHikeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(validateHikeChronology(valid, now)).toBeNull();
  });

  it("accepts a hike with no intermediate passage points", () => {
    const { intermediatePoints: _points, ...withoutPoints } = valid;
    expect(registerHikeSchema.safeParse(withoutPoints).success).toBe(true);
  });

  it("accepts Z timestamps and an optional emergency contact", () => {
    expect(
      registerHikeSchema.safeParse({
        ...valid,
        departureAt: "2026-12-03T07:00:00Z",
        emergencyContactPhone: "+393331234567",
      }).success,
    ).toBe(true);
  });

  it("accepts a hike of exactly 24 hours", () => {
    expect(
      validateHikeChronology({ ...valid, expectedReturnAt: "2026-12-04T08:00:00+01:00" }, now),
    ).toBeNull();
  });

  it("rejects a hike longer than 24 hours", () => {
    expect(
      validateHikeChronology({ ...valid, expectedReturnAt: "2026-12-04T08:01:00+01:00" }, now),
    ).toBe("A hike can last at most 24 hours");
    expect(
      validateHikeChronology({ ...valid, expectedReturnAt: "2027-12-03T17:00:00+01:00" }, now),
    ).toBe("A hike can last at most 24 hours");
  });

  it.each(["+39 333 123 4567", "3331234567", "+39 (011) 123-456"])(
    "accepts the emergency phone %s",
    (phone) => {
      expect(
        registerHikeSchema.safeParse({ ...valid, emergencyContactPhone: phone }).success,
      ).toBe(true);
    },
  );

  it("rejects reversed or identical times", () => {
    const same = { ...valid, expectedReturnAt: valid.departureAt };
    expect(validateHikeChronology(same, now)).toBe(
      "Expected return must be after departure",
    );
    expect(
      validateHikeChronology(
        { ...valid, expectedReturnAt: "2026-12-03T06:00:00Z" },
        now,
      ),
    ).toBe("Expected return must be after departure");
  });

  it("rejects departure in the past or at the current time", () => {
    expect(
      validateHikeChronology({ ...valid, departureAt: now.toISOString() }, now),
    ).toBe("Departure must be in the future");
    expect(
      validateHikeChronology(
        { ...valid, departureAt: "2026-11-30T09:00:00Z" },
        now,
      ),
    ).toBe("Departure must be in the future");
  });

  it.each([
    [{ ...valid, destination: " " }, "empty destination"],
    [
      {
        departureAt: valid.departureAt,
        expectedReturnAt: valid.expectedReturnAt,
        routeDescription: valid.routeDescription,
      },
      "missing destination",
    ],
    [{ ...valid, destination: "x".repeat(201) }, "too-long destination"],
    [{ ...valid, intermediatePoints: [""] }, "empty passage point"],
    [
      { ...valid, intermediatePoints: ["x".repeat(201)] },
      "too-long passage point",
    ],
    [
      { ...valid, intermediatePoints: Array(31).fill("point") },
      "too many passage points",
    ],
    [{ ...valid, routeDescription: " " }, "empty route"],
    [{ ...valid, routeDescription: "x".repeat(2001) }, "too-long route"],
    [{ ...valid, departureAt: "2026-12-03 08:00" }, "no explicit timezone"],
    [{ ...valid, emergencyContactPhone: "a" }, "short contact"],
    [{ ...valid, emergencyContactPhone: "abc" }, "letters as contact phone"],
    [{ ...valid, emergencyContactPhone: "+39 abc 123" }, "letters inside contact phone"],
    [{ ...valid, emergencyContactPhone: "++39333" }, "double plus in contact phone"],
    [{ ...valid, emergencyContactPhone: "12" }, "too-short contact phone"],
    [{ ...valid, userId: 777 }, "client-provided userId"],
  ])("rejects %s (%s)", (input, _reason) => {
    expect(registerHikeSchema.safeParse(input).success).toBe(false);
  });
});
