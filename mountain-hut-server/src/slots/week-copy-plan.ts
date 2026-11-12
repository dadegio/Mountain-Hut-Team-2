/** Date-only operations use UTC, so repeating schedules is immune to DST shifts. */
export function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isMonday(date: string): boolean {
  return new Date(`${date}T00:00:00.000Z`).getUTCDay() === 1;
}

export interface SourceWeekSlot {
  id: number;
  date: string;
  from: string;
  to: string;
}

export interface PlannedWeekSlot {
  sourceSlotId: number;
  date: string;
  from: string;
  to: string;
}

/**
 * Repeats the same weekday and time for each requested destination week.
 * The source week starts on Monday; weeks = 1 means one destination week.
 */
export function planWeekCopy(
  sourceWeekStart: string,
  targetWeekStart: string,
  weeks: number,
  slots: readonly SourceWeekSlot[],
): PlannedWeekSlot[] {
  const sourceMondayMs = Date.parse(`${sourceWeekStart}T00:00:00.000Z`);
  const dayMs = 24 * 60 * 60 * 1000;
  const result: PlannedWeekSlot[] = [];

  for (let week = 0; week < weeks; week++) {
    for (const slot of slots) {
      const dayOffset = Math.round(
        (Date.parse(`${slot.date}T00:00:00.000Z`) - sourceMondayMs) / dayMs,
      );
      if (dayOffset < 0 || dayOffset > 6) {
        throw new Error('The source slots must belong to the selected source week');
      }
      result.push({
        sourceSlotId: slot.id,
        date: addUtcDays(targetWeekStart, week * 7 + dayOffset),
        from: slot.from,
        to: slot.to,
      });
    }
  }

  return result;
}
