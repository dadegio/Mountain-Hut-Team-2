import { useState, type FormEvent } from "react";
import { createSlot } from "../api/slots";
import { formatDay, normalizeTime, todayString } from "../utils/date";
import CopyTablesPicker from "./CopyTablesPicker";
import Step from "./Step";
import TimeField from "./TimeField";
import type { Table, TimeSlot } from "../types/slot";

interface CreateSlotFormProps {
  date: string;
  tables: Table[];
  onCreated: (slot: TimeSlot) => void;
}

const PRESETS = [
  { label: "Lunch", from: "12:00", to: "14:00" },
  { label: "Dinner", from: "19:00", to: "21:00" },
];

// Suggestions for the time fields, every 30 minutes from 06:00 to 23:30
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

const chip =
  "px-3 py-1.5 rounded-full border border-stone-300 bg-white text-sm hover:border-green-600 hover:text-green-800";
const link = "text-sm hover:underline";

export default function CreateSlotForm({ date, tables, onCreated }: CreateSlotFormProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copiedFrom, setCopiedFrom] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Seats are never typed in: they follow from the selected tables
  const selectedSeats = tables
    .filter((t) => selectedTableIds.includes(t.id))
    .reduce((sum, t) => sum + t.seats, 0);
  const fromTime = normalizeTime(from);
  const toTime = normalizeTime(to);
  const isPast = date < todayString();

  function selectTables(tableIds: number[]) {
    setSelectedTableIds(tableIds);
    setCopiedFrom(null);
  }

  function toggleTable(tableId: number) {
    selectTables(
      selectedTableIds.includes(tableId)
        ? selectedTableIds.filter((id) => id !== tableId)
        : [...selectedTableIds, tableId],
    );
  }

  function copyTables(slot: TimeSlot) {
    setSelectedTableIds(slot.tables.map((t) => t.id));
    setCopiedFrom(`${formatDay(slot.date, "short")}, ${slot.from}–${slot.to}`);
    setPickerOpen(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!fromTime || !toTime) {
      setError("Check the times, e.g. 12:30");
      return;
    }

    setSubmitting(true);
    try {
      const slot = await createSlot({
        date,
        from: fromTime,
        to: toTime,
        tableIds: selectedTableIds,
      });
      onCreated(slot);
      setSuccess(`Slot ${slot.from}–${slot.to} created`);
      setFrom("");
      setTo("");
      selectTables([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Step number={1} title="Time">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setFrom(preset.from);
                setTo(preset.to);
              }}
              className={chip}
            >
              {preset.label} {preset.from}–{preset.to}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-3">
          <TimeField label="Start" value={from} onChange={setFrom} listId="slot-times" />
          <span className="pt-8 text-stone-400">–</span>
          <TimeField label="End" value={to} onChange={setTo} listId="slot-times" />
        </div>
        <datalist id="slot-times">
          {TIME_OPTIONS.map((time) => (
            <option key={time} value={time} />
          ))}
        </datalist>
      </Step>

      <Step
        number={2}
        title="Tables"
        actions={
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={`${link} text-sky-700`}
            >
              ⧉ Copy from another slot
            </button>
            <button
              type="button"
              onClick={() => selectTables(tables.map((t) => t.id))}
              className={`${link} text-green-700`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => selectTables([])}
              className={`${link} text-stone-600`}
            >
              None
            </button>
          </>
        }
      >
        {pickerOpen && (
          <CopyTablesPicker
            targetDate={date}
            onPick={copyTables}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {copiedFrom && (
          <p className="text-sm text-sky-800">⧉ Copied from {copiedFrom}</p>
        )}

        {tables.length === 0 ? (
          <p className="text-sm text-stone-500">No tables yet</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3">
            {tables.map((table) => {
              const selected = selectedTableIds.includes(table.id);
              return (
                <button
                  key={table.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTable(table.id)}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    selected
                      ? "border-green-600 bg-green-50"
                      : "border-stone-200 bg-white hover:border-stone-400"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{table.code}</span>
                    {selected && (
                      <span aria-hidden="true" className="text-green-700">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-stone-600">{table.seats} seats</span>
                </button>
              );
            })}
          </div>
        )}
      </Step>

      <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 pt-4">
        <p>
          <span className="text-2xl font-semibold">{selectedSeats}</span> seats
          <span className="text-sm text-stone-500"> · {selectedTableIds.length} tables</span>
        </p>
        <button
          type="submit"
          disabled={submitting || isPast}
          className="ml-auto px-5 py-2.5 rounded bg-green-700 text-white font-medium hover:bg-green-800 disabled:bg-stone-300"
        >
          {submitting
            ? "Creating…"
            : fromTime && toTime
              ? `Create slot ${fromTime}–${toTime}`
              : "Create slot"}
        </button>
      </div>

      {isPast && <p className="text-sm text-amber-700">This day is in the past</p>}
      {!isPast && selectedTableIds.length === 0 && (from || to) && (
        <p className="text-sm text-amber-700">0 seats: nobody can book this slot</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">✓ {success}</p>}
    </form>
  );
}
