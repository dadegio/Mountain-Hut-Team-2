import { useEffect, useState, type FormEvent } from "react";
import { getAvailability } from "../api/availability-api.ts";
import { createStaffBooking } from "../api/bookings-api.ts";
import { createHiker } from "../api/hikers-api.ts";
import HikerSearch from "../components/HikerSearch.tsx";
import DayBar from "../../shared/components/DayBar.tsx";
import Step from "../../shared/components/Step.tsx";
import PageHeader from "../../shared/components/PageHeader.tsx";
import Icon, { type IconName } from "../../shared/components/Icon.tsx";
import { inputBase, primaryButton, sectionCard as card } from "../../shared/styles.ts";
import { ApiError } from "../../shared/api/client.ts";
import { formatDay, slotHasStarted, todayString } from "../../shared/utils/date.ts";
import type { SlotAvailability } from "../types/availability.ts";
import type { BookingResult } from "../types/booking.ts";
import type { HikerMatch, NewHiker } from "../types/hiker.ts";

type HikerMode = "existing" | "account" | "temporary";

const HIKER_MODES: { value: HikerMode; label: string; icon: IconName }[] = [
  { value: "existing", label: "Existing hiker", icon: "search" },
  { value: "account", label: "New account", icon: "plus" },
  { value: "temporary", label: "Just a name", icon: "pencil" },
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
  temporaryPassword: string | null;
}

// MH-07 clarifications: a "New account" needs the full details, while
// "Just a name" needs only the name (the phone is optional)
interface AccountDetails {
  name: string;
  surname: string;
  email: string;
  phoneNumber: string;
}

interface QuickDetails {
  name: string;
  phoneNumber: string;
}

const NO_ACCOUNT: AccountDetails = { name: "", surname: "", email: "", phoneNumber: "" };
const NO_QUICK: QuickDetails = { name: "", phoneNumber: "" };

const inputClass = `mt-1 w-full ${inputBase}`;

// Decorative only: afternoon slots and later get a moon, earlier ones a sun
const isEvening = (from: string) => Number(from.slice(0, 2)) >= 16;

const seats = (n: number) => `${n} ${n === 1 ? "seat" : "seats"}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

const contact = (hiker: HikerMatch) =>
  [hiker.email, hiker.phoneNumber].filter(Boolean).join(" · ");

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col text-sm font-medium text-stone-700">
      {label}
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </label>
  );
}

// The password of a "New account", to tell the hiker at the desk or on the phone
function TemporaryPassword({ password, email }: { password: string; email: string | null }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 animate-pop-in">
      <Icon name="lock" className="w-6 h-6 text-amber-700" />
      <div className="space-y-1">
      <p className="text-base">
        Temporary password:{" "}
        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-lg font-semibold tracking-wider text-stone-900 shadow-xs">{password}</span>
      </p>
      <p className="text-sm text-stone-700">
        Tell it to the hiker: they will have to change it at their first login.
        {email && ` It was also sent to ${email}.`}
      </p>
      </div>
    </div>
  );
}

// The backend's message for a hiker that could not be created
function creationError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    // The backend says which field is taken: the email or the phone number
    return `${err.message}: find the hiker under Existing hiker.`;
  }
  if (err instanceof ApiError && err.status === 400) {
    return "Some details are not valid: check the email and the phone number.";
  }
  return err instanceof Error ? err.message : String(err);
}

// The backend writes its duplicate-booking message for hikers ("You already have…");
// staff book for someone else, so they need it in the third person
function bookingError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409 && /already have/i.test(err.message)) {
    return "This hiker already has a booking for this time slot";
  }
  return err instanceof Error ? err.message : String(err);
}


function ConfirmedReservation({ confirmed, onNew }: { confirmed: Confirmed; onNew: () => void }) {
  const { booking, date, slot, hiker, temporaryPassword } = confirmed;
  const tableCode = (tableId: number) =>
    slot.tables.find((t) => t.tableId === tableId)?.code ?? `#${tableId}`;

  return (
    <div className={`${card} space-y-5 text-center`}>
      <div className="flex justify-center">
        <span className="relative flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-700 animate-pop-in">
          <span className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-40" aria-hidden="true" />
          <Icon name="check" className="relative w-10 h-10" />
        </span>
      </div>
      <p className="text-xl font-semibold text-green-700">✓ Reservation confirmed</p>
      <p className="inline-flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-2xl font-bold text-stone-900">
        <Icon name="tables" className="w-6 h-6 text-green-700" />
        {booking.reservations
          .map((r) => `${tableCode(r.tableId)} · ${seats(r.seats)}`)
          .join(", ")}
      </p>
      <p className="flex items-center justify-center gap-2 text-base text-stone-600">
        <Icon name="users" className="w-5 h-5 text-stone-400" />
        {hiker.name} {hiker.surname} · {people(booking.partySize)} · {formatDay(date, "short")},{" "}
        {slot.from}–{slot.to}
      </p>
      {temporaryPassword && (
        <div className="text-left">
          <TemporaryPassword password={temporaryPassword} email={hiker.email} />
        </div>
      )}
      <button type="button" onClick={onNew} className={primaryButton}>
        <Icon name="plus" className="w-5 h-5" />
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
  const [account, setAccount] = useState<AccountDetails>(NO_ACCOUNT);
  const [quick, setQuick] = useState<QuickDetails>(NO_QUICK);
  // The password of the hiker just created with "New account", until the reservation is done
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
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
  const started = (slot: SlotAvailability) => slotHasStarted(date, slot.from);
  // Unlike hikers, staff have no 2-hour limit: they can book until the slot starts
  const bookable = (slot: SlotAvailability) => slot.available && !started(slot);
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
    setTemporaryPassword(null);
    setError(null);
  }

  function changeAccount(field: keyof AccountDetails, value: string) {
    setAccount((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function changeQuick(field: keyof QuickDetails, value: string) {
    setQuick((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  function startNew() {
    setConfirmed(null);
    setPartySize("2");
    setSlotId(null);
    setHiker(null);
    setAccount(NO_ACCOUNT);
    setQuick(NO_QUICK);
    setTemporaryPassword(null);
    setMode("existing");
    setReload((r) => r + 1);
  }

  // What the backend needs to create the hiker, or null while something required is missing
  function newHiker(): NewHiker | null {
    if (mode === "account") {
      const details = {
        name: account.name.trim(),
        surname: account.surname.trim(),
        email: account.email.trim(),
        phoneNumber: account.phoneNumber.trim(),
      };
      return Object.values(details).every(Boolean) ? { type: "TEMPORARY", ...details } : null;
    }
    if (mode === "temporary") {
      const name = quick.name.trim();
      const phoneNumber = quick.phoneNumber.trim();
      if (!name) return null;
      return phoneNumber ? { type: "THROWAWAY", name, phoneNumber } : { type: "THROWAWAY", name };
    }
    return null;
  }

  const ready = mode === "existing" ? hiker !== null : newHiker() !== null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot || !ready) return;

    setSubmitting(true);
    setError(null);

    let target = hiker;
    let password = temporaryPassword;
    const details = newHiker();
    if (mode !== "existing" && details) {
      try {
        const created = await createHiker(details);
        target = created;
        password = created.temporaryPassword ?? null;
        // From now on the hiker exists: if the reservation fails, trying again
        // must not create them twice, so they become the chosen hiker
        setHiker(created);
        setTemporaryPassword(password);
        setMode("existing");
        setAccount(NO_ACCOUNT);
        setQuick(NO_QUICK);
      } catch (err) {
        setError(creationError(err));
        setSubmitting(false);
        return;
      }
    }
    if (!target) {
      setSubmitting(false);
      return;
    }

    try {
      const booking = await createStaffBooking({
        hikerId: target.id,
        slotId: selectedSlot.slotId,
        partySize: party,
      });
      setConfirmed({
        booking,
        date,
        slot: selectedSlot,
        hiker: target,
        temporaryPassword: password,
      });
    } catch (err) {
      setError(bookingError(err));
      // Someone else may have taken the seats in the meantime
      setReload((r) => r + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon="calendar"
        eyebrow="Staff · Front desk"
        title="New reservation"
        subtitle="For hikers who call, write or arrive at the hut."
      />

      {confirmed ? (
        <ConfirmedReservation confirmed={confirmed} onNew={startNew} />
      ) : (
        <form onSubmit={handleSubmit} className={`${card} space-y-8`}>
          <Step number={1} title="When and how many">
            <DayBar date={date} onChange={changeDate} />

            <label className="flex flex-col text-sm font-medium text-stone-700 w-36">
              <span className="flex items-center gap-1.5">
                <Icon name="users" className="w-4 h-4 text-green-700" />
                People
              </span>
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
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <Icon name="warning" className="w-5 h-5" />
                Enter a number of people from 1 to {MAX_PARTY_SIZE}</p>
            )}
            {validParty && !current && (
              <div className="flex items-center gap-3 py-2 text-stone-500">
                <span className="w-5 h-5 rounded-full border-2 border-green-600 border-t-transparent animate-spin" aria-hidden="true" />
                <p>Loading…</p>
              </div>
            )}
            {current?.error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <Icon name="warning" className="w-5 h-5" />
                <p>Error: {current.error}</p>
              </div>
            )}
            {current && !current.error && slots.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 p-8 text-center text-stone-500">
                <Icon name="calendar" className="w-8 h-8 text-stone-400" />
                <p>No slots on this day</p>
              </div>
            )}

            {slots.length > 0 && (
              <div role="group" aria-label="Time slot" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.map((slot) => {
                  const selected = slot.slotId === selectedSlot?.slotId;
                  const evening = isEvening(slot.from);
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      aria-pressed={selected}
                      disabled={!bookable(slot)}
                      onClick={() => selectSlot(slot.slotId)}
                      className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-stone-100 disabled:border-stone-200 disabled:text-stone-400 ${
                        selected
                          ? "border-green-600 bg-green-50 shadow-sm"
                          : "border-stone-200 bg-white hover:border-green-500 hover:shadow-md enabled:hover:-translate-y-0.5"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-lg ${
                          !bookable(slot)
                            ? "bg-stone-200 text-stone-400"
                            : evening
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        <Icon name={evening ? "moon" : "sun"} className="w-5 h-5" />
                      </span>
                      <span className="min-w-0">
                      <span className="block text-lg font-semibold">
                        {slot.from}–{slot.to}
                      </span>
                      <span className="block text-sm">
                        {started(slot) ? "Started" : `${seats(slot.availableSeats)} free`}
                      </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {slots.length > 0 && !slots.some(bookable) && (
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
                <Icon name="warning" className="w-5 h-5" />
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
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-base transition-all cursor-pointer active:scale-95 ${
                      mode === option.value
                        ? "border-green-600 bg-green-50 text-green-800 font-medium shadow-sm"
                        : "border-stone-300 bg-white hover:border-green-600"
                    }`}
                  >
                    <Icon name={option.icon} className="w-4 h-4" />
                    {option.label}
                  </button>
                ))}
              </div>

              {mode === "existing" &&
                (hiker ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-green-600 bg-green-50 p-4 animate-pop-in">
                      <span className="flex items-center justify-center w-11 h-11 rounded-full bg-green-700 text-lg font-semibold text-white" aria-hidden="true">
                        {hiker.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-lg font-semibold">
                          {hiker.name} {hiker.surname}
                        </p>
                        <p className="text-sm text-stone-600">{contact(hiker)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => chooseHiker(null)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-white hover:text-green-700 cursor-pointer"
                      >
                        <Icon name="pencil" className="w-4 h-4" />
                        Change
                      </button>
                    </div>
                    {/* Created just now, but not reserved yet: the password must not get lost */}
                    {temporaryPassword && (
                      <TemporaryPassword password={temporaryPassword} email={hiker.email} />
                    )}
                  </div>
                ) : (
                  <HikerSearch onSelect={chooseHiker} />
                ))}

              {/* A real account: the hiker gets a password to change at the first login */}
              {mode === "account" && (
                <fieldset className="space-y-3">
                  <legend className="sr-only">New account</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" value={account.name} onChange={(v) => changeAccount("name", v)} required />
                    <Field label="Surname" value={account.surname} onChange={(v) => changeAccount("surname", v)} required />
                    <Field label="Email" type="email" value={account.email} onChange={(v) => changeAccount("email", v)} required />
                    <Field label="Mobile number" type="tel" value={account.phoneNumber} onChange={(v) => changeAccount("phoneNumber", v)} required />
                  </div>
                  <p className="flex items-center gap-2 text-sm text-stone-500">
                    <Icon name="lock" className="w-4 h-4" />
                    A password is generated for the hiker: you'll see it after reserving.
                  </p>
                </fieldset>
              )}

              {/* Just a name: the hiker cannot log in */}
              {mode === "temporary" && (
                <fieldset className="space-y-3">
                  <legend className="sr-only">Just a name</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" value={quick.name} onChange={(v) => changeQuick("name", v)} required />
                    <Field label="Phone (optional)" type="tel" value={quick.phoneNumber} onChange={(v) => changeQuick("phoneNumber", v)} />
                  </div>
                  <p className="flex items-center gap-2 text-sm text-stone-500">
                    <Icon name="info" className="w-4 h-4" />
                    No account: this hiker won't be able to log in.</p>
                </fieldset>
              )}
            </Step>
          )}

          {selectedSlot && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-green-200 bg-linear-to-r from-green-50 to-white p-4 animate-fade-up">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 text-green-800">
                <Icon name="calendar" className="w-5 h-5" />
              </span>
              <p className="text-base font-medium text-stone-800">
                {formatDay(date, "short")}, {selectedSlot.from}–{selectedSlot.to} · {people(party)}
              </p>
              <button
                type="submit"
                disabled={submitting || !ready}
                className={`ml-auto ${primaryButton}`}
              >
                {submitting ? "Reserving…" : "Reserve"}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <Icon name="warning" className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}