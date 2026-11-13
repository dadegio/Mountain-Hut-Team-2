/** MH-06: a booking may be changed for up to 48 hours after it was created. */
export const BOOKING_CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * SQLite CURRENT_TIMESTAMP is UTC but has no timezone suffix.
 * Interpret it explicitly as UTC, never as the machine's local timezone.
 */
export function isBookingChangeAllowed(
  createdAt: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(createdAt)) {
    return false;
  }

  const normalized = createdAt.replace(" ", "T");
  const explicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized);
  const createdMs = Date.parse(explicitTimezone ? normalized : `${normalized}Z`);
  if (!Number.isFinite(createdMs)) return false;

  const elapsed = now.getTime() - createdMs;
  return elapsed >= 0 && elapsed <= BOOKING_CHANGE_WINDOW_MS;
}
