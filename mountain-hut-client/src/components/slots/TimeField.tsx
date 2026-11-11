import { useState } from "react";
import { normalizeTime } from "../../utils/date.ts";

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  // id of a <datalist> with suggested times
  listId: string;
}

// Plain text field instead of <input type="time">: the time can be typed
// freely or picked from the suggestions, and is tidied up to "HH:MM" on blur
export default function TimeField({ label, value, onChange, listId }: TimeFieldProps) {
  const [editing, setEditing] = useState(false);
  const invalid = !editing && value !== "" && normalizeTime(value) === null;

  return (
    <label className="flex flex-col text-sm text-stone-700">
      {label}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        placeholder="hh:mm"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={() => {
          setEditing(false);
          onChange(normalizeTime(value) ?? value);
        }}
        aria-invalid={invalid}
        className={`w-28 border rounded px-3 py-2 text-lg bg-white ${
          invalid ? "border-red-500" : "border-stone-300 hover:border-green-600"
        }`}
      />
      {invalid && <span className="text-xs text-red-600">e.g. 12:30</span>}
    </label>
  );
}
