import type { RegisterHikeInput } from "#src/hikes/hike-schema";
// MH-183: agreed limit for one hike (change here if the team picks another value)
export const MAX_HIKE_HOURS = 24;
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
  if (expectedReturn - departure > MAX_HIKE_HOURS * 60 * 60 * 1000) {
    return `A hike can last at most ${MAX_HIKE_HOURS} hours`;
  }
  return null;
}
