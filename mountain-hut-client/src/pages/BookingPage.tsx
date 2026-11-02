import { useState } from "react";

const MAX_PARTY_SIZE = 10; // TODO: confirm with backend/PO

// today's date as "YYYY-MM-DD" in local time (toISOString would use UTC)
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function BookingPage() {
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slotId, setSlotId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // stop the browser reloading the page

    if (!date || date < today()) return setFormError("Please choose today or a future date.");
    if (partySize < 1 || partySize > MAX_PARTY_SIZE)
      return setFormError(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
    if (!slotId) return setFormError("Please choose a time slot.");

    setFormError(null);
    console.log({ date, partySize, slotId: Number(slotId) });
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Book a table</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-stone-200 rounded-lg p-6">
        <div>
          <label htmlFor="date" className="block text-sm font-medium mb-1">Date</label>
          <input
            id="date"
            type="date"
            min={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="partySize" className="block text-sm font-medium mb-1">Party size</label>
          <input
            id="partySize"
            type="number"
            min={1}
            max={MAX_PARTY_SIZE}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="slot" className="block text-sm font-medium mb-1">Time slot</label>
          <select
            id="slot"
            value={slotId}
            onChange={(e) => setSlotId(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          >
            <option value="">Choose a slot…</option>
            {/* filled from the availability API in MH-52 */}
          </select>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          className="w-full bg-green-700 text-white rounded py-2 font-medium hover:bg-green-800"
        >
          Book
        </button>
      </form>
    </div>
  );
}