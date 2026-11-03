import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getAvailability } from "../api/availability";
import { createBooking } from "../api/bookings";
import { ApiError } from "../api/client";
import type { SlotAvailability } from "../types/availability";
import type { BookingResult } from "../types/booking";

const MAX_PARTY_SIZE = 20; // TODO: confirm with PO (backend allows up to 1000)
const BOOKING_DEADLINE_MS = 2 * 60 * 60 * 1000; // 2h before slot start

// Date -> "YYYY-MM-DD" in local time
function toDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "YYYY-MM-DD" -> Date at local midnight (new Date("YYYY-MM-DD") would use UTC)
function fromDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const today = () => toDateString(new Date());

function formatLongDate(s: string): string {
  return fromDateString(s).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// UX hint only: the backend enforces the real deadline
function isTooLate(date: string, from: string): boolean {
  const start = new Date(`${date}T${from}`);
  return start.getTime() - Date.now() < BOOKING_DEADLINE_MS;
}

function bookingErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401: return "Please log in to book a table.";
      case 403: return "Only hikers can book a table.";
      case 404: return "This slot no longer exists. Please refresh and try again.";
      case 409: return err.message; // no seats / deadline passed / already booked
      case 400: return "Some booking details are invalid. Please check the form.";
    }
  }
  return "Something went wrong. Please try again.";
}

// Result of one availability request, tagged with the inputs it was loaded for
interface LoadedAvailability {
  key: string;
  slots: SlotAvailability[];
  error: string | null;
}

export default function BookingPage() {
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [slotId, setSlotId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState<LoadedAvailability | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  const validParty = partySize >= 1 && partySize <= MAX_PARTY_SIZE;
  const key = date && validParty ? `${date}|${partySize}` : null;

  // fetch availability when date or party size changes;
  // state is only set in async callbacks, never synchronously in the effect body
  useEffect(() => {
    if (!date || partySize < 1 || partySize > MAX_PARTY_SIZE) return;

    const requestKey = `${date}|${partySize}`;
    let ignore = false;

    getAvailability(date, partySize)
      .then((data) => {
        if (!ignore) setLoaded({ key: requestKey, slots: data.slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setLoaded({ key: requestKey, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date, partySize]);

  // derived from state: no extra useState needed
  const current = loaded && loaded.key === key ? loaded : null;
  const slotsLoading = key !== null && current === null;
  const slots = current?.slots ?? [];
  const slotsError = current?.error ?? null;
  const bookableSlots = slots.filter((s) => s.available && !isTooLate(date, s.from));

  function handleDateChange(d: Date | undefined) {
    setDate(d ? toDateString(d) : "");
    setSlotId(""); // previous choice may no longer be valid
  }

  function handlePartySizeChange(value: number) {
    setPartySize(value);
    setSlotId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!date || date < today()) return setFormError("Please choose today or a future date.");
    if (!validParty) return setFormError(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
    if (!slotId) return setFormError("Please choose a time slot.");

    setFormError(null);
    setSubmitting(true);
    try {
      setResult(await createBooking(Number(slotId), partySize));
    } catch (err) {
      setFormError(bookingErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Confirmation view ----
  if (result) {
    const slot = slots.find((s) => s.slotId === result.slotId);
    const tableCode = (tableId: number) =>
      slot?.tables.find((t) => t.tableId === tableId)?.code ?? `#${tableId}`;

    return (
      <div className="max-w-md bg-white border border-green-200 rounded-lg p-6 space-y-2">
        <h1 className="text-2xl font-semibold text-green-800">Booking confirmed</h1>
        <p>
          {formatLongDate(date)}
          {slot && `, ${slot.from}–${slot.to}`}
        </p>
        <p>
          {result.partySize} {result.partySize === 1 ? "person" : "people"}
        </p>
        <p className="text-sm text-stone-600">
          Table{result.reservations.length > 1 ? "s" : ""}:{" "}
          {result.reservations.map((r) => `${tableCode(r.tableId)} (${r.seats})`).join(", ")}
        </p>
        <button onClick={() => setResult(null)} className="mt-4 text-green-700 underline">
          Make another booking
        </button>
      </div>
    );
  }

  // ---- Booking form ----
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Book a table</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white border border-stone-200 rounded-lg p-6"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2">Date</p>
            <DayPicker
              mode="single"
              selected={date ? fromDateString(date) : undefined}
              onSelect={handleDateChange}
              disabled={{ before: new Date() }}
              weekStartsOn={1}
            />
          </div>

          <div>
            <label htmlFor="partySize" className="block text-sm font-medium mb-2">
              Party size
            </label>
            <div className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-500 pointer-events-none"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              <input
                id="partySize"
                type="number"
                min={1}
                max={MAX_PARTY_SIZE}
                value={partySize}
                onChange={(e) => handlePartySizeChange(Number(e.target.value))}
                className="w-full border border-stone-300 rounded pl-10 pr-3 py-2"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Time slot</p>

          {date && <p className="text-sm text-stone-700 mb-2">{formatLongDate(date)}</p>}

          {!date && <p className="text-sm text-stone-500">Choose a date first.</p>}
          {slotsLoading && <p className="text-sm text-stone-500">Loading slots…</p>}
          {slotsError && (
            <p className="text-sm text-red-600">Could not load slots: {slotsError}</p>
          )}
          {date && !slotsLoading && !slotsError && bookableSlots.length === 0 && (
            <p className="text-sm text-stone-500">
              No available slots for this date and party size.
            </p>
          )}

          {!slotsLoading && bookableSlots.length > 0 && (
            <div role="group" aria-label="Time slot" className="flex flex-wrap gap-2">
              {bookableSlots.map((s) => {
                const selected = slotId === String(s.slotId);
                return (
                  <button
                    key={s.slotId}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSlotId(String(s.slotId))}
                    className={
                      selected
                        ? "px-4 py-2 rounded bg-green-700 text-white font-medium"
                        : "px-4 py-2 rounded border border-green-700 text-green-800 hover:bg-green-50"
                    }
                  >
                    {s.from}–{s.to}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-700 text-white rounded py-2 font-medium hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? "Booking…" : "Book"}
        </button>
      </form>
    </div>
  );
}