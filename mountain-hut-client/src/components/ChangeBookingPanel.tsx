import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getAvailability } from "../api/availability";
import { changeBooking } from "../api/bookings";
import { ApiError } from "../api/client";
import { slotStartMs } from "../utils/booking-rules";
import type { SlotAvailability } from "../types/availability";
import type { ChangeBookingRequest, MyBooking } from "../types/booking";

const MAX_PARTY_SIZE = 20; // same limit as the booking page
const SLOT_CUTOFF_MS = 2 * 60 * 60 * 1000;

function toDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fromDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function changeErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 401: return "Your session has ended. Please log in again.";
      case 404: return "This booking or slot no longer exists. Please refresh the page.";
      case 409: return err.message; // window expired, no seats, already booked that slot…
      case 400: return "Some details are invalid. Please check your changes.";
    }
  }
  return "Something went wrong. Please try again.";
}

interface LoadedAvailability {
  key: string;
  slots: SlotAvailability[];
  error: string | null;
}

interface ChangeBookingPanelProps {
  booking: MyBooking;
  onCancel: () => void;
  onChanged: () => void;
}

export default function ChangeBookingPanel({ booking, onCancel, onChanged }: ChangeBookingPanelProps) {
  const [date, setDate] = useState(booking.date);
  const [partySize, setPartySize] = useState(booking.partySize);
  const [slotId, setSlotId] = useState(booking.slotId);
  const [loaded, setLoaded] = useState<LoadedAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validParty = partySize >= 1 && partySize <= MAX_PARTY_SIZE;
  const key = validParty ? `${date}|${partySize}` : null;

  // load availability for the chosen date and party size
  useEffect(() => {
    if (partySize < 1 || partySize > MAX_PARTY_SIZE) return;

    const requestKey = `${date}|${partySize}`;
    let ignore = false;

    getAvailability(date, partySize)
      .then((data) => {
        if (ignore) return;
        const now = Date.now();
        // bookable slots, plus the booking's own slot:
        // availability counts our own seats as taken, the PATCH does not
         const usable = data.slots.filter(
            (s) =>
            s.slotId === booking.slotId ||
            (s.available && slotStartMs(date, s.from) - now >= SLOT_CUTOFF_MS),
        );
        setLoaded({ key: requestKey, slots: usable, error: null });
        })
      .catch((err: Error) => {
        if (!ignore) setLoaded({ key: requestKey, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date, partySize, booking.slotId]);

  const current = loaded && loaded.key === key ? loaded : null;
  const slotsLoading = key !== null && current === null;

  const slots = [...(current?.slots ?? [])];
  
  if (date === booking.date && !slots.some((s) => s.slotId === booking.slotId)) {
    slots.unshift({
      slotId: booking.slotId,
      from: booking.from,
      to: booking.to,
      availableSeats: 0,
      available: true,
      tables: [],
      allocation: null,
    });
  }

  function handleDateChange(d: Date | undefined) {
    if (!d) return;
    setDate(toDateString(d));
    setSlotId(0); // must pick a slot on the new date
    setError(null);
  }

  function handlePartySizeChange(value: number) {
    setPartySize(value);
    setError(null);
  }

  async function handleSave() {
    if (!validParty) return setError(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
    if (!slotId) return setError("Please choose a time slot.");

    // send only what actually changed
    const changes: ChangeBookingRequest = {};
    if (slotId !== booking.slotId) changes.slotId = slotId;
    if (partySize !== booking.partySize) changes.partySize = partySize;
    if (Object.keys(changes).length === 0) return setError("You haven't changed anything yet.");

    setError(null);
    setSaving(true);
    try {
      await changeBooking(booking.id, changes);
      onChanged();
    } catch (err) {
      setError(changeErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-stone-200 pt-4 space-y-5">
      <div className="grid gap-5 md:grid-cols-[auto_1fr] md:gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">New date</p>
          <DayPicker
            mode="single"
            selected={fromDateString(date)}
            onSelect={handleDateChange}
            disabled={{ before: new Date() }}
            defaultMonth={fromDateString(booking.date)}
            weekStartsOn={1}
          />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label
              htmlFor={`partySize-${booking.id}`}
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-green-700"
            >
              Party size
            </label>
            <input
              id={`partySize-${booking.id}`}
              type="number"
              min={1}
              max={MAX_PARTY_SIZE}
              value={partySize === 0 ? "" : partySize}
              onChange={(e) => handlePartySizeChange(Number(e.target.value))}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 shadow-xs transition focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/30"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-700">Time slot</p>

            {slotsLoading && (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-stone-200 animate-pulse" />
                ))}
              </div>
            )}

            {current?.error && (
              <p className="text-sm text-red-600">Could not load slots: {current.error}</p>
            )}

            {!slotsLoading && !current?.error && slots.length === 0 && (
              <p className="rounded-lg border border-dashed border-stone-300 px-4 py-4 text-center text-sm text-stone-500">
                No available slots for this date and party size.
              </p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 gap-2">
                {slots.map((s) => {
                  const selected = slotId === s.slotId;
                  const isCurrent = s.slotId === booking.slotId;
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSlotId(s.slotId)}
                      className={`flex flex-col items-center rounded-lg px-3 py-2 transition cursor-pointer ${
                        selected
                          ? "bg-green-600 text-white shadow-md ring-2 ring-green-600 ring-offset-2"
                          : "bg-white border border-stone-300 text-stone-800 hover:border-green-600 hover:text-green-700"
                      }`}
                    >
                      <span className="font-semibold">{s.from}–{s.to}</span>
                      <span className={`text-xs ${selected ? "text-green-100" : "text-stone-500"}`}>
                        {isCurrent ? "current slot" : `${s.availableSeats} seats free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-green-600 font-semibold text-white shadow-lg hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}