import { formatDay, openPicker, shiftDate } from "../utils/date.ts";

interface DayBarProps {
  date: string;
  onChange: (date: string) => void;
}

const dayButton =
  "px-3 py-1.5 rounded border border-stone-300 bg-white text-sm hover:border-green-600";

export default function DayBar({ date, onChange }: DayBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onChange(shiftDate(date, -1))}
        className={dayButton}
      >
        ←
      </button>
      <input
        type="date"
        aria-label="Day"
        value={date}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        onClick={(e) => openPicker(e.currentTarget)}
        className="border border-stone-300 rounded px-3 py-2 bg-white cursor-pointer hover:border-green-600"
      />
      <button
        type="button"
        aria-label="Next day"
        onClick={() => onChange(shiftDate(date, 1))}
        className={dayButton}
      >
        →
      </button>
      <p className="text-xl font-semibold sm:ml-auto">{formatDay(date)}</p>
    </div>
  );
}
