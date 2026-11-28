import type { RegisterHikeInput } from "#src/hikes/hike-schema";

/** Return a readable validation error, or null when chronology is valid. */
export function validateHikeChronology(
  input: Pick<RegisterHikeInput, "departureAt" | "expectedReturnAt">,
  now: Date = new Date(),
): string | null {
  const departure = Date.parse(input.departureAt);
  const expectedReturn = Date.parse(input.expectedReturnAt);
  if (!Number.isFinite(departure) || !Number.isFinite(expectedReturn)) {
    return "Invalid departure or return date/time";
  }
  if (departure <= now.getTime()) {
    return "Departure must be in the future";
  }
  if (expectedReturn <= departure) {
    return "Expected return must be after departure";
  }
  return null;
}
