// Pure rules for slots, no database access.
// Dates are "YYYY-MM-DD" and times "HH:MM": zero padded, so comparing
// the strings gives the same result as comparing the dates/times.

export interface TimeRange {
  from: string;
  to: string;
}

// Local date of the server as "YYYY-MM-DD"
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isPastDate(date: string, today: string): boolean {
  return date < today;
}

// Adjacent slots (12:00-13:00 and 13:00-14:00) do not overlap
export function slotsOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.from < b.to && b.from < a.to;
}

export function totalSeats(tables: { seats: number }[]): number {
  return tables.reduce((sum, table) => sum + table.seats, 0);
}
