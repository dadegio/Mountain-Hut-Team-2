import { useState, type FormEvent } from "react";
import { createTable } from "../api/slots-api.ts";
import type { Table } from "../types/slot.ts";

interface AddTableFormProps {
  onCreated: (table: Table) => void;
}

// MH-89: keep in sync with the limit in the backend table schema
const MAX_TABLE_SEATS = 20;

const inputClass = "border border-stone-300 rounded px-2 py-1 bg-white";

export default function AddTableForm({ onCreated }: AddTableFormProps) {
  const [code, setCode] = useState("");
  // Kept as text so the field can be empty while typing
  const [seats, setSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const seatCount = Number(seats);
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > MAX_TABLE_SEATS) {
      setError(`Seats must be a whole number between 1 and ${MAX_TABLE_SEATS}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const table = await createTable({ code: code.trim(), seats: seatCount });
      onCreated(table);
      setCode("");
      setSeats("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-4 items-end">
        <label className="flex flex-col text-sm">
          Table code
          <input
            required
            maxLength={20}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col text-sm">
          Seats (1–{MAX_TABLE_SEATS})
          <input
            type="number"
            inputMode="numeric"
            required
            min={1}
            max={MAX_TABLE_SEATS}
            step={1}
            value={seats}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
            }}
            onChange={(e) => setSeats(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={`${inputClass} w-20`}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="px-3 py-1.5 rounded border border-green-700 text-green-700 hover:bg-green-50 disabled:text-stone-400 disabled:border-stone-300"
        >
          {submitting ? "Adding…" : "Add table"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
    </form>
  );
}