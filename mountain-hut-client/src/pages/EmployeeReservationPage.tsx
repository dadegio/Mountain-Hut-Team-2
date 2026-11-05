import { useEffect, useState, type FormEvent } from "react";
import { getAvailability } from "../api/availability";
import { createStaffBooking } from "../api/bookings";
import DayBar from "../components/DayBar";
import HikerSearch from "../components/HikerSearch";
import Step from "../components/Step";
import { formatDay, slotHasEnded, todayString } from "../utils/date";
import type { SlotAvailability } from "../types/availability";
import type { BookingResult } from "../types/booking";
import type { HikerMatch } from "../types/hiker";

type HikerMode = "existing" | "account" | "temporary";

const HIKER_MODES: { value: HikerMode; label: string }[] = [
  { value: "existing", label: "Existing hiker" },
  { value: "account", label: "New account" },
  { value: "temporary", label: "Just a name" },
];

// Same limit as the backend
const MAX_PARTY_SIZE = 1000;

// Result of one availability request, tagged with the inputs it was loaded for
interface LoadedAvailability {
  key: string;
  slots: SlotAvailability[];
  error: string | null;
}

interface Confirmed {
  booking: BookingResult;
  date: string;
  slot: SlotAvailability;
  hiker: HikerMatch;
}

const card = "bg-white border border-stone-200 rounded-lg p-5";
const inputClass = "mt-1 w-full border border-stone-300 rounded px-3 py-2 bg-white";
const primaryButton =
  "px-5 py-2.5 rounded bg-green-700 text-white font-medium hover:bg-green-800 disabled:bg-stone-300";

const seats = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

function Field({ label, type = "text" }: { label: string; type?: string }) {
  return (
    <label className="flex flex-col text-sm">
      {label}
      <input type={type} className={inputClass} />
    </label>
  );
}

function ConfirmedReservation({ confirmed, onNew }: { confirmed: Confirmed; onNew: () => void }) {
  const { booking, date, slot, hiker } = confirmed;
  const tableCode = (tableId: number) =>
    slot.tables.find((t) => t.tableId === tableId)?.code ?? `#${tableId}`;

  return (
    <div className={`${card} space-y-4`}>
      <p className="text-lg font-semibold text-green-700">✓ Reservation confirmed</p>
      <p className="text-2xl font-semibold">
        {booking.reservations
          .map((r) => `${tableCode(r.tableId)} · ${seats(r.seats)}`)
          .join(", ")}
      </p>
      <p className="text-stone-600">
        {hiker.name} {hiker.surname} · {people(booking.partySize)} · {formatDay(date, "short")},{" "}
        {slot.from}–{slot.to}
      </p>
      <button type="button" onClick={onNew} className={primaryButton}>
        New reservation
      </button>
    </div>
  );
}

export default function EmployeeReservationPage() {
  const [date, setDate] = useState(todayString());
  // Kept as text so the field can be empty while typing
  const [partySize, setPartySize] = useState("2");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [mode, setMode] = useState<HikerMode>("existing");
  const [hiker, setHiker] = useState<HikerMatch | null>(null);
  const [loaded, setLoaded] = useState<LoadedAvailability | null>(null);
  // Changing it loads the availability again, after a booking changed the seats
  const [reload, setReload] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);

  const party = Number(partySize);
  const validParty = Number.isInteger(party) && party >= 1 && party <= MAX_PARTY_SIZE;
  const key = validParty ? `${date}|${party}|${reload}` : null;

  useEffect(() => {
    if (!validParty) return;
    const requestKey = `${date}|${party}|${reload}`;
    let ignore = false;

    getAvailability(date, party)
      .then((data) => {
        if (!ignore) setLoaded({ key: requestKey, slots: data.slots, error: null });
      })
      .catch((err: Error) => {
        if (!ignore) setLoaded({ key: requestKey, slots: [], error: err.message });
      });

    return () => {
      ignore = true;
    };
  }, [date, party, validParty, reload]);

  const current = loaded?.key === key ? loaded : null;
  const slots = current?.slots ?? [];
  const ended = (slot: SlotAvailability) => slotHasEnded(date, slot.to);
  // Unlike hikers, staff can book until the slot ends: there is no 2-hour limit
  const bookable = (slot: SlotAvailability) => slot.available && !ended(slot);
  const selectedSlot = slots.find((s) => s.slotId === slotId && bookable(s)) ?? null;

  function changeDate(value: string) {
    setDate(value);
    setSlotId(null);
    setError(null);
  }

  function changePartySize(value: string) {
    setPartySize(value);
    setError(null);
  }

  function selectSlot(id: number) {
    setSlotId(id);
    setError(null);
  }

  function changeMode(value: HikerMode) {
    setMode(value);
    setError(null);
  }

  function chooseHiker(value: HikerMatch | null) {
    setHiker(value);
    setError(null);
  }

  function startNew() {
    setConfirmed(null);
    setPartySize("2");
    setSlotId(null);
    setHiker(null);
    setMode("existing");
    setReload((r) => r + 1);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot || !hiker) return;

    setSubmitting(true);
    setError(null);
    try {
      const booking = await createStaffBooking({
        hikerId: hiker.id,
        slotId: selectedSlot.slotId,
        partySize: party,
      });
      setConfirmed({ booking, date, slot: selectedSlot, hiker });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Someone else may have taken the seats in the meantime
      setReload((r) => r + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New reservation</h1>
        <p className="text-stone-600">For hikers who call, write or arrive at the hut.</p>
      </div>

      {confirmed ? (
        <ConfirmedReservation confirmed={confirmed} onNew={startNew} />
      ) : (
        <form onSubmit={handleSubmit} className={`${card} space-y-6`}>
          <Step number={1} title="When and how many">
            <DayBar date={date} onChange={changeDate} />

            <label className="flex flex-col text-sm w-28">
              People
              <input
                type="number"
                min={1}
                max={MAX_PARTY_SIZE}
                step={1}
                value={partySize}
                onChange={(e) => changePartySize(e.target.value)}
                className={inputClass}
              />
            </label>

            {!validParty && (
              <p className="text-sm text-amber-700">Enter a number of people from 1 to {MAX_PARTY_SIZE}</p>
            )}
            {validParty && !current && <p className="text-stone-500">Loading…</p>}
            {current?.error && <p className="text-red-600">Error: {current.error}</p>}
            {current && !current.error && slots.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-stone-300 p-8 text-center text-stone-500">
                No slots on this day
              </div>
            )}

            {slots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.map((slot) => {
                  const selected = slot.slotId === selectedSlot?.slotId;
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      aria-pressed={selected}
                      disabled={!bookable(slot)}
                      onClick={() => selectSlot(slot.slotId)}
                      className={`rounded-lg border-2 p-3 text-left transition-colors disabled:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400 ${
                        selected
                          ? "border-green-600 bg-green-50"
                          : "border-stone-200 bg-white hover:border-stone-400"
                      }`}
                    >
                      <span className="block font-semibold">
                        {slot.from}–{slot.to}
                      </span>
                      <span className="block text-sm">
                        {ended(slot) ? "Ended" : `${seats(slot.availableSeats)} free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {slots.length > 0 && !slots.some(bookable) && (
              <p className="text-sm text-amber-700">
                No room for {people(party)} on this day: try another day
              </p>
            )}
          </Step>

          {selectedSlot && (
            <Step number={2} title="Who">
              <div role="group" aria-label="Hiker" className="flex flex-wrap gap-2">
                {HIKER_MODES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={mode === option.value}
                    onClick={() => changeMode(option.value)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      mode === option.value
                        ? "border-green-600 bg-green-50 text-green-800 font-medium"
                        : "border-stone-300 bg-white hover:border-green-600"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {mode === "existing" &&
                (hiker ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-green-600 bg-green-50 p-3">
                    <div>
                      <p className="font-semibold">
                        {hiker.name} {hiker.surname}
                      </p>
                      <p className="text-sm text-stone-600">
                        {hiker.email}
                        {hiker.phone_number && ` · ${hiker.phone_number}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => chooseHiker(null)}
                      className="ml-auto text-sm text-stone-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <HikerSearch onSelect={chooseHiker} />
                ))}

              {/* TODO: creating the account is to be agreed with the team, see MH-07 */}
              {mode === "account" && (
                <fieldset disabled className="space-y-3 opacity-60">
                  <p className="text-sm text-amber-700">Not available yet</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Full name" />
                    <Field label="Email" type="email" />
                    <Field label="Mobile number" type="tel" />
                    <Field label="Emergency contact (optional)" />
                  </div>
                  <Field label="Notes (optional)" />
                </fieldset>
              )}

              {/* TODO(MH-20): create a temporary hiker, who cannot log in */}
              {mode === "temporary" && (
                <fieldset disabled className="space-y-3 opacity-60">
                  <p className="text-sm text-amber-700">Not available yet</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" />
                    <Field label="Phone (optional)" type="tel" />
                  </div>
                </fieldset>
              )}
            </Step>
          )}

          {selectedSlot && (
            <div className="flex flex-wrap items-center gap-4 border-t border-stone-200 pt-4">
              <p>
                {formatDay(date, "short")}, {selectedSlot.from}–{selectedSlot.to} · {people(party)}
              </p>
              <button
                type="submit"
                disabled={submitting || mode !== "existing" || !hiker}
                className={`ml-auto ${primaryButton}`}
              >
                {submitting ? "Reserving…" : "Reserve"}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}
