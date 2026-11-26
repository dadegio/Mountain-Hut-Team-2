import { hutSlotStartMs } from "./booking-rules.ts";

/** MH-06 / PO clarification #43: at least 48 hours before the meal. */
export const BOOKING_CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;

export function isBookingChangeAllowed(
  date: string,
  from: string,
  now: Date = new Date(),
): boolean {
  try {
    return hutSlotStartMs(date, from) - now.getTime() >= BOOKING_CHANGE_WINDOW_MS;
  } catch {
    return false;
  }
}
