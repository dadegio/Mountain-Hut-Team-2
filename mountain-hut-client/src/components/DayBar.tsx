import { formatDay, openPicker, shiftDate, todayString } from "../utils/date";

interface DayBarProps {
  date: string;
  onChange: (date: string) => void;
}

const dayButton =
  "px-3 py-1.5 rounded border border-stone-300 bg-white text-sm hover:border-green-600";

export default function DayBar({ date, onChange }: DayBarProps) {
  const today = todayString();

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
      <button type="button" onClick={() => onChange(today)} className={dayButton}>
        Today
      </button>
      <button type="button" onClick={() => onChange(shiftDate(today, 1))} className={dayButton}>
        Tomorrow
      </button>
      <p className="text-xl font-semibold sm:ml-auto">{formatDay(date)}</p>
    </div>
  );
}
