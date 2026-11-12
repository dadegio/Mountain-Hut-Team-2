// Helpers for the hike form. A datetime-local input gives "YYYY-MM-DDTHH:MM"
// in the browser's local time; the API wants ISO 8601 instants.

const HOUR_MS = 60 * 60 * 1000;

export function localInputToIso(value: string): string | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// Date -> "YYYY-MM-DDTHH:MM" in local time
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// The next full hour, as a datetime-local value: a sensible first departure
export function nextFullHour(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d);
}

// "" when the value is not a valid date-time
export function addHours(value: string, hours: number): string {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? toLocalInput(new Date(ms + hours * HOUR_MS)) : "";
}

// 34200000 -> "9 h 30 min"
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.join(" ") || "0 min";
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// "Sun 20 Dec, 17:00"
export function formatHikeTime(value: string): string {
  const d = new Date(value);
  return `${dayLabel(d)}, ${timeLabel(d)}`;
}

// Same day: "Sun 20 Dec · 08:00 → 17:00". Otherwise both days are shown.
export function formatHikeRange(departure: string, expectedReturn: string): string {
  const from = new Date(departure);
  const to = new Date(expectedReturn);
  if (dayLabel(from) === dayLabel(to)) {
    return `${dayLabel(from)} · ${timeLabel(from)} → ${timeLabel(to)}`;
  }
  return `${dayLabel(from)}, ${timeLabel(from)} → ${dayLabel(to)}, ${timeLabel(to)}`;
}

export type HikePhase = "upcoming" | "ongoing" | "past";

export function hikePhase(
  hike: { departureAt: string; expectedReturnAt: string },
  nowMs: number,
): HikePhase {
  if (nowMs < Date.parse(hike.departureAt)) return "upcoming";
  if (nowMs < Date.parse(hike.expectedReturnAt)) return "ongoing";
  return "past";
}

export interface HikeFormValues {
  route: string;
  departure: string;
  expectedReturn: string;
  phone: string;
}

// The same rules as the backend, so the hiker gets the message right away.
// Returns the first problem, or null when the form can be sent.
export function validateHikeForm(values: HikeFormValues, nowMs: number): string | null {
  const route = values.route.trim();
  const phone = values.phone.trim();
  const departure = Date.parse(values.departure);
  const expectedReturn = Date.parse(values.expectedReturn);

  if (!route) return "Describe your route.";
  if (route.length > 2000) return "The route description is too long (max 2000 characters).";
  if (!Number.isFinite(departure)) return "Choose your departure date and time.";
  if (!Number.isFinite(expectedReturn)) return "Choose when you expect to be back.";
  if (departure <= nowMs) return "Departure must be in the future.";
  if (expectedReturn <= departure) return "Expected return must be after departure.";
  if (phone && (phone.length < 3 || phone.length > 40)) {
    return "The emergency contact must be between 3 and 40 characters.";
  }
  return null;
}