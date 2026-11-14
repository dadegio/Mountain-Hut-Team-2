// Dates are "YYYY-MM-DD", the format of <input type="date"> and of the API.
// Always built from the local date: toISOString() is UTC and right after
// midnight would give yesterday.
export function toDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

function parseDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDate(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// "long": "Monday 2 November 2026", "short": "Mon 2 Nov"
export function formatDay(date: string, style: "long" | "short" = "long"): string {
  return parseDate(date).toLocaleDateString(
    "en-GB",
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { weekday: "short", day: "numeric", month: "short" },
  );
}

// True once the start time of the slot has passed. UX hint only, the backend decides
export function slotHasStarted(date: string, from: string, now: Date = new Date()): boolean {
  return new Date(`${date}T${from}`).getTime() <= now.getTime();
}

// Accepts what people type ("12:30", "12.30", "1230", "930", "9") and returns
// "HH:MM", or null when it is not a valid time
export function normalizeTime(input: string): string | null {
  const text = input.trim();
  const match =
    /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(text) ?? /^(\d{1,2})(\d{2})$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Opens the browser's date/time picker when the field is clicked anywhere,
// not only on its small icon
export function openPicker(input: HTMLInputElement) {
  try {
    input.showPicker();
  } catch {
    // Unsupported or already open: typing in the field still works
  }
}
