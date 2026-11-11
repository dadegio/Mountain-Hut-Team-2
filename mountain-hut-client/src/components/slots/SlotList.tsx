import type { TimeSlot } from "../../types/slot.ts";

interface SlotListProps {
  slots: TimeSlot[];
}

export default function SlotList({ slots }: SlotListProps) {
  if (slots.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">
        No slots yet
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {slots.map((slot) => (
        <li
          key={slot.id}
          className="bg-white border border-stone-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex justify-between items-center gap-4">
            <p className="text-lg font-semibold">
              {slot.from}–{slot.to}
            </p>
            <span
              className={`px-2 py-1 rounded text-sm ${
                slot.totalSeats > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {slot.totalSeats} seats
            </span>
          </div>

          {slot.tables.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {slot.tables.map((table) => (
                <li
                  key={table.id}
                  className="text-sm px-2 py-0.5 rounded border border-stone-300 text-stone-700"
                >
                  {table.code} · {table.seats}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
