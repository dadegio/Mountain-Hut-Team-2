import { z } from "zod";

/**
 * API uses ISO 8601 instants (Z or explicit offset) to avoid ambiguous
 * Europe/Rome DST transitions. Values are normalized to UTC when persisted.
 */
export const registerHikeSchema = z.object({
  departureAt: z.iso.datetime({ offset: true }),
  expectedReturnAt: z.iso.datetime({ offset: true }),
  routeDescription: z.string().trim().min(1).max(2000),
  emergencyContactPhone: z.string().trim().min(3).max(40).optional(),
}).strict();

export type RegisterHikeInput = z.infer<typeof registerHikeSchema>;

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
