import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getAvailability } from "../api/availability";
import { createBooking } from "../api/bookings";
import { ApiError } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import AuthShell from "../components/AuthShell";
import type { SlotAvailability } from "../types/availability";
import type { BookingResult } from "../types/booking";

const MAX_PARTY_SIZE = 20; // TODO: confirm with PO (backend allows up to 1000)
const BOOKING_DEADLINE_MS = 2 * 60 * 60 * 1000; // 2h before slot start

const primaryButton =
  "w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer";

const secondaryButton =
  "w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors cursor-pointer";

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

function SectionLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  const className = "block text-xs font-semibold uppercase tracking-wider text-green-700 mb-2";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ) : (
    <p className={className}>{children}</p>
  );
}

export default function BookingPage() {
  const { user, loading: authLoading } = useAuth();

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
  const selectedSlot = bookableSlots.find((s) => String(s.slotId) === slotId);

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
      <AuthShell
        badge="Reservation"
        title="Booking confirmed"
        subtitle="We look forward to seeing you at the hut."
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-7 h-7 text-green-700"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <dl className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-stone-50/60 text-sm">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-stone-500">Date</dt>
              <dd className="font-medium text-stone-900 text-right">{formatLongDate(date)}</dd>
            </div>
            {slot && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="text-stone-500">Time</dt>
                <dd className="font-medium text-stone-900">{slot.from}–{slot.to}</dd>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-stone-500">Party</dt>
              <dd className="font-medium text-stone-900">
                {result.partySize} {result.partySize === 1 ? "person" : "people"}
              </dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="text-stone-500">Table{result.reservations.length > 1 ? "s" : ""}</dt>
              <dd className="font-medium text-stone-900">
                {result.reservations.map((r) => `${tableCode(r.tableId)} (${r.seats})`).join(", ")}
              </dd>
            </div>
          </dl>

          <div className="space-y-3">
            <Link to="/my-bookings" className={primaryButton}>
              My bookings
            </Link>
            <button type="button" onClick={() => setResult(null)} className={secondaryButton}>
              Make another booking
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // ---- Booking form ----
  return (
    <AuthShell
      width="4xl"
      badge="Reservations"
      title="Book a table"
      subtitle="Pick a date and your party size, then choose an available time slot."
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-8">
        {/* Left: calendar */}
        <div className="md:border-r md:border-stone-200 md:pr-8">
          <SectionLabel>Date</SectionLabel>
          <DayPicker
            mode="single"
            selected={date ? fromDateString(date) : undefined}
            onSelect={handleDateChange}
            disabled={{ before: new Date() }}
            weekStartsOn={1}
          />
        </div>

        {/* Right: party size, slots, summary, submit */}
        <div className="flex flex-col gap-6">
          <div>
            <SectionLabel htmlFor="partySize">Party size</SectionLabel>
            <div className="flex items-stretch rounded-lg border border-stone-300 bg-white shadow-xs overflow-hidden focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-600/30">
              <button
                type="button"
                aria-label="Decrease party size"
                onClick={() => handlePartySizeChange(Math.max(1, partySize - 1))}
                disabled={partySize <= 1}
                className="px-4 text-xl text-stone-600 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                −
              </button>
              <div className="relative flex-1 border-x border-stone-200">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400 pointer-events-none"
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
                  className="w-full h-full py-2.5 pl-10 pr-3 text-stone-900 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <button
                type="button"
                aria-label="Increase party size"
                onClick={() => handlePartySizeChange(Math.min(MAX_PARTY_SIZE, partySize + 1))}
                disabled={partySize >= MAX_PARTY_SIZE}
                className="px-4 text-xl text-stone-600 hover:bg-stone-100 disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <SectionLabel>Time slot</SectionLabel>
            {date && <p className="text-sm text-stone-700 mb-3">{formatLongDate(date)}</p>}

            {!date && (
              <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                Choose a date to see available slots.
              </p>
            )}

            {slotsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Loading slots">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-stone-200 animate-pulse" />
                ))}
              </div>
            )}

            {slotsError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                Could not load slots: {slotsError}
              </div>
            )}

            {date && !slotsLoading && !slotsError && bookableSlots.length === 0 && (
              <p className="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">
                No available slots for this date and party size.
              </p>
            )}

            {!slotsLoading && bookableSlots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bookableSlots.map((s) => {
                  const selected = slotId === String(s.slotId);
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSlotId(String(s.slotId))}
                      className={`flex flex-col items-center rounded-lg px-3 py-2.5 transition cursor-pointer ${
                        selected
                          ? "bg-green-600 text-white shadow-md ring-2 ring-green-600 ring-offset-2"
                          : "bg-white border border-stone-300 text-stone-800 hover:border-green-600 hover:text-green-700"
                      }`}
                    >
                      <span className="font-semibold">{s.from}–{s.to}</span>
                      <span className={`text-xs ${selected ? "text-green-100" : "text-stone-500"}`}>
                        {s.availableSeats} seats free
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary + submit pushed to the bottom of the right column */}
          <div className="mt-auto space-y-3">
            {selectedSlot && (
              <p className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm text-green-900">
                {formatLongDate(date)} · {selectedSlot.from}–{selectedSlot.to} · {partySize}{" "}
                {partySize === 1 ? "person" : "people"}
              </p>
            )}

            {formError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* guests can browse availability but must log in to book */}
            {!authLoading && !user ? (
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                <Link
                  to="/login"
                  state={{ from: "/booking" }}
                  className="font-semibold text-green-700 underline"
                >
                  Log in
                </Link>{" "}
                or{" "}
                <Link to="/register" className="font-semibold text-green-700 underline">
                  create an account
                </Link>{" "}
                to book a table.
              </div>
            ) : (
              <button type="submit" disabled={submitting || authLoading} className={primaryButton}>
                {submitting ? "Booking…" : "Book"}
              </button>
            )}
          </div>
        </div>
      </form>
    </AuthShell>
  );
}