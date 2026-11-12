import { useState, type FormEvent } from "react";
import { copyWeek } from "../api/slots-api.ts";
import { todayString } from "../../shared/utils/date.ts";
import { mondayOf } from "../utils/week-date.ts";

interface CopyWeekFormProps {
  selectedDate: string;
  onCopied: (targetWeekStart: string) => void;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function CopyWeekForm({ selectedDate, onCopied }: CopyWeekFormProps) {
  const [sourceDate, setSourceDate] = useState(selectedDate);
  const [targetDate, setTargetDate] = useState(addDays(mondayOf(selectedDate), 7));
  const [weeks, setWeeks] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceWeekStart = mondayOf(sourceDate);
  const targetWeekStart = mondayOf(targetDate);
  const sourceWeekEnd = addDays(sourceWeekStart, 6);
  const targetEnd = addDays(targetWeekStart, weeks * 7 - 1);
  const overlaps = sourceWeekStart <= targetEnd && targetWeekStart <= sourceWeekEnd;
  const invalid = !sourceWeekStart || !targetWeekStart || !Number.isInteger(weeks) || weeks < 1 || weeks > 12 ||
    targetWeekStart < todayString() || overlaps;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalid || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await copyWeek({ sourceWeekStart, targetWeekStart, weeks });
      onCopied(targetWeekStart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not copy the schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-stone-600">
        Repeat slots and their table assignments across up to 12 weeks. Existing bookings are never copied.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-stone-700">
          Source week
          <input
            aria-label="Source week"
            type="date"
            value={sourceDate}
            onChange={(event) => { setSourceDate(event.target.value); setError(null); }}
            className="mt-1 block w-full rounded border border-stone-300 bg-white p-2"
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">Monday {sourceWeekStart}</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          First destination week
          <input
            aria-label="First destination week"
            type="date"
            value={targetDate}
            onChange={(event) => { setTargetDate(event.target.value); setError(null); }}
            className="mt-1 block w-full rounded border border-stone-300 bg-white p-2"
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">Monday {targetWeekStart}</span>
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Number of weeks
          <input
            aria-label="Number of weeks"
            type="number"
            min={1}
            max={12}
            step={1}
            value={weeks}
            onChange={(event) => { setWeeks(event.target.valueAsNumber); setError(null); }}
            className="mt-1 block w-full rounded border border-stone-300 bg-white p-2"
            required
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">1–12 consecutive weeks</span>
        </label>
      </div>
      {targetWeekStart < todayString() && (
        <p className="text-sm text-amber-700">The destination week must not start in the past.</p>
      )}
      {overlaps && (
        <p className="text-sm text-amber-700">Source and destination weeks cannot overlap.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-stone-500">If any destination slot overlaps an existing slot, nothing is copied.</p>
        <button
          type="submit"
          disabled={invalid || submitting}
          className="rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:bg-stone-300"
        >
          {submitting ? "Copying…" : "Copy week"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
