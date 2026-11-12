/** Compute ISO Monday using UTC date arithmetic to avoid DST shifts. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  const weekday = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((weekday + 6) % 7));
  return d.toISOString().slice(0, 10);
}
