import type { MyBooking } from "../types/booking.ts";

export const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;

export const HUT_TIME_ZONE = "Europe/Rome";

const hutDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: HUT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function epochOfHutWallTime(epoch: number): number {
  const values = Object.fromEntries(
    hutDateTimeFormatter
      .formatToParts(new Date(epoch))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
}

/** Converts a hut-local date and HH:mm to a UTC timestamp in milliseconds. */
function hutSlotStartMs(date: string, from: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(from)) {
    throw new Error("Invalid slot date or time");
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = from.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new Error("Invalid slot time");
  }

  const desiredWallEpoch = Date.UTC(year, month - 1, day, hour, minute);
  const normalized = new Date(desiredWallEpoch);
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) {
    throw new Error("Invalid slot date");
  }

  // Convert calendar wall-time to the UTC instant, iteratively resolving the
  // timezone offset. Covers CET/CEST without relying on process.env.TZ.
  let timestamp = desiredWallEpoch;
  for (let i = 0; i < 4; i++) {
    const discrepancy = desiredWallEpoch - epochOfHutWallTime(timestamp);
    if (discrepancy === 0) return timestamp;
    timestamp += discrepancy;
  }
  throw new Error("Slot time is invalid or ambiguous in the hut timezone");
}

// "2026-11-04 14:14:03" (UTC, from SQLite) -> milliseconds
export function createdAtMs(createdAt: string): number {
  return new Date(createdAt.replace(" ", "T") + "Z").getTime();
}

// Use the hut's local timezone, regardless of the browser location.
export function slotStartMs(date: string, from: string): number {
  try { return hutSlotStartMs(date, from); } catch { return NaN; }
}

export function isSlotChangeAllowed(date: string, from: string, now = Date.now()): boolean {
  return slotStartMs(date, from) - now >= CHANGE_WINDOW_MS;
}

export function isPast(b: MyBooking, now = Date.now()): boolean {
  return slotStartMs(b.date, b.from) <= now;
}

export type ChangeBlockReason = "window-expired" | "not-placed" | null;

// why a booking can't be changed, or null if it can
export function changeBlockReason(b: MyBooking, now = Date.now()): ChangeBlockReason {
  if (b.status !== "PLACED") return "not-placed";
  if (!isSlotChangeAllowed(b.date, b.from, now)) return "window-expired";
  return null;
}