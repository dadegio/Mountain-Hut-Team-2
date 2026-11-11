/**
 * Rules from MH-01. The hut is assumed to operate in Italy, so date/time
 * comparisons must not depend on the server machine's timezone.
 */
export const HUT_TIME_ZONE = "Europe/Rome";
export const BOOKING_CUTOFF_MINUTES = 120;

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
export function hutSlotStartMs(date: string, from: string): number {
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

/** The cutoff is inclusive: exactly two hours before the slot is allowed. */
export function isSlotBookable(date: string, from: string, now: Date = new Date()): boolean {
  return hutSlotStartMs(date, from) - now.getTime() >= BOOKING_CUTOFF_MINUTES * 60_000;
}
