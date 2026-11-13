import { useState, type FormEvent } from "react";
import { createTable } from "../api/slots-api.ts";
import type { Table } from "../types/slot.ts";

interface AddTableFormProps {
  onCreated: (table: Table) => void;
}

const inputClass = "border border-stone-300 rounded px-2 py-1 bg-white";

export default function AddTableForm({ onCreated }: AddTableFormProps) {
  const [code, setCode] = useState("");
  // Kept as text so the field can be empty while typing
  const [seats, setSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const table = await createTable({ code: code.trim(), seats: Number(seats) });
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
          Seats
          <input
            type="number"
            required
            min={1}
            step={1}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
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
