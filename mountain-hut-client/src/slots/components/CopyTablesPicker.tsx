import { useEffect, useState } from "react";
import { getSlots } from "../api/slots-api.ts";
import { formatDay, shiftDate } from "../../shared/utils/date.ts";
import type { TimeSlot } from "../types/slot.ts";

interface CopyTablesPickerProps {
  // Day of the slot being created: the picker starts from the day before
  targetDate: string;
  onPick: (slot: TimeSlot) => void;
  onClose: () => void;
}

interface SlotsResult {
  date: string;
  slots: TimeSlot[];
  error: string | null;
}

const arrow = "px-2 py-1 rounded border border-sky-200 bg-white text-sm hover:border-sky-500";

export default function CopyTablesPicker({ targetDate, onPick, onClose }: CopyTablesPickerProps) {
  const [date, setDate] = useState(() => shiftDate(targetDate, -1));
  const [result, setResult] = useState<SlotsResult | null>(null);

  useEffect(() => {
    let ignore = false;

    getSlots(date)
      .then((slots) => {
        if (!ignore) setResult({ date, slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setResult({ date, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date]);

  const loading = result?.date !== date;

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-sky-900">Copy from</span>
        <button
          type="button"
          aria-label="Previous day"
          onClick={() => setDate(shiftDate(date, -1))}
          className={arrow}
        >
          ←
        </button>
        <input
          type="date"
          aria-label="Day to copy from"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
          className="border border-sky-200 rounded px-2 py-1 bg-white text-sm"
        />
        <button
          type="button"
          aria-label="Next day"
          onClick={() => setDate(shiftDate(date, 1))}
          className={arrow}
        >
          →
        </button>
        <span className="text-sm text-sky-900">{formatDay(date, "short")}</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="ml-auto px-2 text-sky-900 hover:text-sky-600"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading…</p>
      ) : result.error ? (
        <p className="text-sm text-red-600">Error: {result.error}</p>
      ) : result.slots.length === 0 ? (
        <p className="text-sm text-stone-500">No slots on this day</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {result.slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              disabled={slot.tables.length === 0}
              onClick={() => onPick(slot)}
              className="px-3 py-2 rounded-lg border border-sky-300 bg-white text-left text-sm hover:border-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="block font-medium">
                {slot.from}–{slot.to} · {slot.totalSeats} seats
              </span>
              <span className="block text-xs text-stone-500">
                {slot.tables.length > 0
                  ? slot.tables.map((t) => t.code).join(", ")
                  : "No tables"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
