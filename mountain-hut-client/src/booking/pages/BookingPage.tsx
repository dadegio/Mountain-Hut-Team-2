import { useEffect, useState } from "react";
import { Link } from "react-router";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { getAvailability } from "../api/availability-api.ts";
import { createBooking } from "../api/bookings-api.ts";
import { ApiError } from "../../shared/api/client.ts";
import { useAuth } from "../../auth/hooks/useAuth.ts";
import AuthShell from "../../shared/components/AuthShell.tsx";
import Icon, { type IconName } from "../../shared/components/Icon.tsx";
import RequirementsFields from "../components/RequirementsFields.tsx";
import {
  clearBookingDraft,
  loadBookingDraft,
  saveBookingDraft,
} from "../storage/booking-draft.ts";
import type { SlotAvailability } from "../types/availability.ts";
import type { BookingResult } from "../types/booking.ts";

const MAX_PARTY_SIZE = 20; // TODO: confirm with PO (backend allows up to 1000)
const BOOKING_DEADLINE_MS = 2 * 60 * 60 * 1000; // 2h before slot start

const primaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-[0.99] disabled:opacity-50 cursor-pointer";

const secondaryButton =
  "w-full inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-xl transition-colors cursor-pointer";

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

function SectionLabel({ children, htmlFor, icon }: { children: string; htmlFor?: string; icon: IconName }) {
  const className = "flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-700 mb-3";
  const content = (
    <>
      <Icon name={icon} className="w-5 h-5" />
      {children}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>{content}</label>
  ) : (
    <p className={className}>{content}</p>
  );
}

// Decorative only: afternoon slots and later get a moon, earlier ones a sun
const isEvening = (from: string) => Number(from.slice(0, 2)) >= 16;

const emptyBox =
  "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center text-base text-stone-500";

export default function BookingPage() {
  const { user, loading: authLoading } = useAuth();

  const [date, setDate] = useState<string>(() => {
    const draft = loadBookingDraft();
    if (draft?.date) {
      if (draft.date >= today()) {
        return draft.date;
      }
      clearBookingDraft();
    }
    return "";
  });
  const [partySize, setPartySize] = useState<number>(() => {
    const draft = loadBookingDraft();
    if (draft?.partySize && draft.partySize >= 1 && draft.partySize <= MAX_PARTY_SIZE) {
      return draft.partySize;
    }
    return 2;
  });
  const [slotId, setSlotId] = useState<string>(() => {
    const draft = loadBookingDraft();
    if (draft?.date && draft.date >= today() && draft.slotId) {
      return draft.slotId;
    }
    return "";
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [loaded, setLoaded] = useState<LoadedAvailability | null>(null);

  // MH-05: optional allergies, intolerances and notes
  const [hasRequirements, setHasRequirements] = useState<boolean>(() => {
    const draft = loadBookingDraft();
    return Boolean(draft?.hasRequirements);
  });
  const [description, setDescription] = useState<string>(() => {
    const draft = loadBookingDraft();
    return draft?.description ?? "";
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  // MH-96: persist search/selection details in localStorage so users retain their research across login/register
  useEffect(() => {
    if (result) return;
    if (date) {
      saveBookingDraft({
        date,
        partySize,
        slotId,
        hasRequirements,
        description,
      });
    } else {
      clearBookingDraft();
    }
  }, [date, partySize, slotId, hasRequirements, description, result]);

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

  function startNewBooking() {
    clearBookingDraft();
    setResult(null);
    setDate("");
    setPartySize(2);
    setSlotId("");
    setHasRequirements(false);
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!date || date < today()) return setFormError("Please choose today or a future date.");
    if (!validParty) return setFormError(`Party size must be between 1 and ${MAX_PARTY_SIZE}.`);
    if (!slotId) return setFormError("Please choose a time slot.");

    setFormError(null);
    setSubmitting(true);
    try {
      const res = await createBooking(Number(slotId), partySize, {
        description: hasRequirements ? description : undefined,
      });
      clearBookingDraft();
      setResult(res);
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
        width="xl"
        badge="Reservation"
        title="Booking confirmed"
        subtitle="We look forward to seeing you at the hut."
      >
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="relative w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-pop-in">
              <span className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-40" aria-hidden="true" />
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative w-10 h-10 text-green-700"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <dl className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-stone-50/60 text-base animate-fade-up">
            <div className="flex justify-between px-4 py-2.5">
              <dt className="flex items-center gap-2 text-stone-500"><Icon name="calendar" className="w-5 h-5" />Date</dt>
              <dd className="font-medium text-stone-900 text-right">{formatLongDate(date)}</dd>
            </div>
            {slot && (
              <div className="flex justify-between px-4 py-2.5">
                <dt className="flex items-center gap-2 text-stone-500"><Icon name="clock" className="w-5 h-5" />Time</dt>
                <dd className="font-medium text-stone-900">{slot.from}–{slot.to}</dd>
              </div>
            )}
            <div className="flex justify-between px-4 py-2.5">
              <dt className="flex items-center gap-2 text-stone-500"><Icon name="users" className="w-5 h-5" />Party</dt>
              <dd className="font-medium text-stone-900">
                {result.partySize} {result.partySize === 1 ? "person" : "people"}
              </dd>
            </div>
            <div className="flex justify-between px-4 py-2.5">
              <dt className="flex items-center gap-2 text-stone-500"><Icon name="tables" className="w-5 h-5" />Table{result.reservations.length > 1 ? "s" : ""}</dt>
              <dd className="font-medium text-stone-900">
                {result.reservations.map((r) => `${tableCode(r.tableId)} (${r.seats})`).join(", ")}
              </dd>
            </div>
            {result.allergens && result.allergens.length > 0 && (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="flex items-center gap-2 text-stone-500"><Icon name="warning" className="w-5 h-5" />Allergens</dt>
                <dd className="font-medium text-stone-900 text-right">
                  {result.allergens.map((a) => a.name).join(", ")}
                </dd>
              </div>
            )}
            {result.description && (
              <div className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="flex items-center gap-2 text-stone-500"><Icon name="info" className="w-5 h-5" />Notes</dt>
                <dd className="font-medium text-stone-900 text-right">{result.description}</dd>
              </div>
            )}
          </dl>

          <div className="space-y-3">
            <Link to="/my-bookings" className={primaryButton}>
              <Icon name="book" className="w-5 h-5" />
              My bookings
            </Link>
            <button type="button" onClick={startNewBooking} className={secondaryButton}>
              <Icon name="plus" className="w-5 h-5" />
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
      width="5xl"
      badge="Reservations"
      title="Book a table"
      subtitle="Pick a date and your party size, then choose an available time slot."
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-8 md:grid-cols-[auto_1fr] md:gap-10">
        {/* Left: calendar */}
        <div className="md:border-r md:border-stone-200 md:pr-10">
          <SectionLabel icon="calendar">Date</SectionLabel>
          <div className="booking-calendar flex justify-center rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
          <DayPicker
            mode="single"
            selected={date ? fromDateString(date) : undefined}
            onSelect={handleDateChange}
            disabled={{ before: new Date() }}
            weekStartsOn={1}
          />
          </div>
        </div>

        {/* Right: party size, slots, requirements, summary, submit */}
        <div className="flex flex-col gap-7">
          <div>
            <SectionLabel htmlFor="partySize" icon="users">Party size</SectionLabel>
            <div className="flex items-stretch h-14 rounded-xl border border-stone-300 bg-white shadow-xs overflow-hidden focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-600/30">
              <button
                type="button"
                aria-label="Decrease party size"
                onClick={() => handlePartySizeChange(Math.max(1, partySize - 1))}
                disabled={partySize <= 1}
                className="px-5 text-2xl text-stone-600 transition-colors hover:bg-green-50 hover:text-green-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                −
              </button>
              <div className="relative flex-1 border-x border-stone-200">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">
                  <Icon name="users" className="w-6 h-6" />
                </span>
                <input
                  id="partySize"
                  type="number"
                  min={1}
                  max={MAX_PARTY_SIZE}
                  value={partySize === 0 ? "" : partySize}
                  onChange={(e) => handlePartySizeChange(Number(e.target.value))}
                  aria-invalid={!validParty}
                  aria-describedby={!validParty ? "partySize-error" : undefined}
                  className="w-full h-full py-2.5 pl-12 pr-3 text-xl font-semibold text-stone-900 bg-transparent focus:outline-hidden [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <button
                type="button"
                aria-label="Increase party size"
                onClick={() => handlePartySizeChange(Math.min(MAX_PARTY_SIZE, partySize + 1))}
                disabled={partySize >= MAX_PARTY_SIZE}
                className="px-5 text-2xl text-stone-600 transition-colors hover:bg-green-50 hover:text-green-800 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
              >
                +
              </button>
            </div>
                        {!validParty && (
              <p
                id="partySize-error"
                role="alert"
                className="mt-2 flex items-center gap-2 text-sm text-red-600"
              >
                <Icon name="warning" className="w-4 h-4" />
                {partySize < 1
                  ? "Enter a party size of at least 1."
                  : `Party size can be at most ${MAX_PARTY_SIZE}. For larger groups, please contact the hut.`}
              </p>
            )}
          </div>

          <div>
            <SectionLabel icon="clock">Time slot</SectionLabel>
            {date && <p key={date} className="text-lg font-medium text-stone-800 mb-3 animate-fade-up">{formatLongDate(date)}</p>}

            {!date && (
              <div className={emptyBox}>
                <Icon name="calendar" className="w-8 h-8 text-stone-400" />
                <p>Choose a date to see available slots.</p>
              </div>
            )}

            {slotsLoading && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" aria-label="Loading slots">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-stone-200 animate-pulse" />
                ))}
              </div>
            )}

            {slotsError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <Icon name="warning" className="w-5 h-5" />
                Could not load slots: {slotsError}
              </div>
            )}

            {date && validParty && !slotsLoading && !slotsError && bookableSlots.length === 0 && (
              <div className={emptyBox}>
                <Icon name="clock" className="w-8 h-8 text-stone-400" />
                <p>No available slots for this date and party size.</p>
              </div>
            )}

            {!slotsLoading && bookableSlots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {bookableSlots.map((s, index) => {
                  const selected = slotId === String(s.slotId);
                  const evening = isEvening(s.from);
                  return (
                    <button
                      key={s.slotId}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSlotId(String(s.slotId))}
                      style={{ animationDelay: `${index * 50}ms` }}
                      className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3.5 transition-all cursor-pointer animate-fade-up ${
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
                        {s.availableSeats} seats free
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* MH-05: checkbox to reveal free-text allergies/intolerances/notes */}
          <RequirementsFields
            enabled={hasRequirements}
            onToggle={setHasRequirements}
            description={description}
            onDescriptionChange={setDescription}
          />

          {/* Summary + submit pushed to the bottom of the right column */}
          <div className="mt-auto space-y-3">
            {selectedSlot && (
              <p className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-base text-green-900 animate-pop-in">
                <Icon name="check" className="w-5 h-5 text-green-700" />
                <span>
                {formatLongDate(date)} · {selectedSlot.from}–{selectedSlot.to} · {partySize}{" "}
                {partySize === 1 ? "person" : "people"}
                </span>
              </p>
            )}

            {formError && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <Icon name="warning" className="w-5 h-5" />
                {formError}
              </div>
            )}

            {/* guests can browse availability but must log in to book */}
            {!authLoading && !user ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3.5 text-base text-green-900">
                <Icon name="info" className="w-5 h-5 text-green-700" />
                <span>
                <Link
                  to="/login"
                  state={{ from: "/booking" }}
                  className="font-semibold text-green-700 underline"
                >
                  Log in
                </Link>{" "}
                or{" "}
                <Link
                  to="/register"
                  state={{ from: "/booking" }}
                  className="font-semibold text-green-700 underline"
                >
                  create an account
                </Link>{" "}
                to book a table.
                </span>
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