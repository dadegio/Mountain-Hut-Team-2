import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getAvailability } from "../api/availability-api.ts";
import { changeBooking } from "../api/bookings-api.ts";
import { ApiError } from "../../shared/api/client.ts";
import { isSlotChangeAllowed } from "../rules/booking-rules.ts";
import RequirementsFields from "./RequirementsFields";
import Icon from "../../shared/components/Icon.tsx";
import type { SlotAvailability } from "../types/availability.ts";
import type { ChangeBookingRequest, MyBooking } from "../types/booking.ts";

const MAX_PARTY_SIZE = 20; // same limit as the booking page

const sectionLabel = "mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-700";

// Decorative only: afternoon slots and later get a moon, earlier ones a sun
const isEvening = (from: string) => Number(from.slice(0, 2)) >= 16;

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
  const initialDescription = booking.description ?? "";
  const [date, setDate] = useState(booking.date);
  const [partySize, setPartySize] = useState(booking.partySize);
  const [slotId, setSlotId] = useState(booking.slotId);
  const [hasRequirements, setHasRequirements] = useState(Boolean(initialDescription.trim()));
  const [description, setDescription] = useState(initialDescription);
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
            isSlotChangeAllowed(date, s.from, now) &&
            (s.slotId === booking.slotId || s.available),
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

  if (date === booking.date && isSlotChangeAllowed(booking.date, booking.from) && !slots.some((s) => s.slotId === booking.slotId)) {
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

    const target = slots.find((s) => s.slotId === slotId);
    if (!isSlotChangeAllowed(booking.date, booking.from)) {
      return setError("Changes require at least 48 hours before the original slot.");
    }
    if (!target || !isSlotChangeAllowed(date, target.from)) {
      return setError("Choose a slot at least 48 hours in the future.");
    }

    // send only what actually changed
    const changes: ChangeBookingRequest = {};
    if (slotId !== booking.slotId) changes.slotId = slotId;
    if (partySize !== booking.partySize) changes.partySize = partySize;
    const originalDescription = booking.description?.trim() ? booking.description.trim() : null;
    const nextDescription = hasRequirements && description.trim() ? description.trim() : null;
    if (nextDescription !== originalDescription) changes.description = nextDescription;
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
    <div className="mt-5 rounded-2xl border border-green-100 bg-green-50/40 p-5 space-y-6 animate-fade-up">
      <p className="flex items-center gap-2 text-base font-semibold text-stone-900">
        <Icon name="pencil" className="w-5 h-5 text-green-700" />
        Change this booking
      </p>
      <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-8">
        <div>
          <p className={sectionLabel}>
            <Icon name="calendar" className="w-5 h-5" />
            New date
          </p>
          <div className="booking-calendar flex justify-center rounded-2xl border border-stone-200 bg-white p-3">
          <DayPicker
            mode="single"
            selected={fromDateString(date)}
            onSelect={handleDateChange}
            disabled={{ before: new Date() }}
            defaultMonth={fromDateString(booking.date)}
            weekStartsOn={1}
          />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label
              htmlFor={`partySize-${booking.id}`}
              className={sectionLabel}
            >
              <Icon name="users" className="w-5 h-5" />
              Party size
            </label>
            <input
              id={`partySize-${booking.id}`}
              type="number"
              min={1}
              max={MAX_PARTY_SIZE}
              value={partySize === 0 ? "" : partySize}
              onChange={(e) => handlePartySizeChange(Number(e.target.value))}
              className="w-full h-14 rounded-xl border border-stone-300 bg-white px-4 text-xl font-semibold text-stone-900 shadow-xs transition focus:outline-hidden focus:border-green-600 focus:ring-2 focus:ring-green-600/30"
            />
          </div>

          <div>
            <p className={sectionLabel}>
              <Icon name="clock" className="w-5 h-5" />
              Time slot
            </p>

            {slotsLoading && (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-stone-200 animate-pulse" />
                ))}
              </div>
            )}

            {current?.error && (
              <p className="flex items-center gap-2 text-sm text-red-600">
                <Icon name="warning" className="w-5 h-5" />
                Could not load slots: {current.error}
              </p>
            )}

            {!slotsLoading && !current?.error && slots.length === 0 && (
              <p className="rounded-xl border-2 border-dashed border-stone-300 bg-white px-4 py-6 text-center text-base text-stone-500">
                No available slots for this date and party size.
              </p>
            )}

            {!slotsLoading && slots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.map((s) => {
                  const selected = slotId === s.slotId;
                  const isCurrent = s.slotId === booking.slotId;
                  const evening = isEvening(s.from);
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSlotId(s.slotId)}
                      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3.5 transition-all cursor-pointer ${
                        selected
                          ? "bg-green-600 text-white shadow-md ring-2 ring-green-600 ring-offset-2"
                          : "bg-white border border-stone-300 text-stone-800 hover:-translate-y-0.5 hover:shadow-md hover:border-green-600 hover:text-green-700"
                      }`}
                    >
                      <Icon
                        name={evening ? "moon" : "sun"}
                        className={`w-6 h-6 ${selected ? "text-white" : evening ? "text-indigo-500" : "text-amber-500"}`}
                      />
                      <span className="text-lg font-semibold">{s.from}–{s.to}</span>
                      <span className={`text-sm ${selected ? "text-green-100" : "text-stone-500"}`}>
                        {isCurrent ? "current slot" : `${s.availableSeats} seats free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <RequirementsFields
            textareaId={`description-${booking.id}`}
            enabled={hasRequirements}
            onToggle={(checked) => {
              setHasRequirements(checked);
              setError(null);
            }}
            description={description}
            onDescriptionChange={(value) => {
              setDescription(value);
              setError(null);
            }}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <Icon name="warning" className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-stone-300 bg-white font-semibold text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 font-semibold text-white shadow-lg hover:bg-green-500 active:bg-green-700 disabled:opacity-50 transition-all hover:shadow-xl cursor-pointer"
        >
          <Icon name="check" className="w-5 h-5" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}