import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getMyBookings } from "../api/bookings.ts";
import { getTables } from "../api/slots.ts";
import AuthShell from "../components/layout/AuthShell";
import ChangeBookingPanel from "../components/booking/ChangeBookingPanel";
import { changeBlockReason, createdAtMs, isPast, slotStartMs } from "../utils/booking-rules.ts";
import type { MyBooking } from "../types/booking.ts";
import type { Table } from "../types/slot.ts";

const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000;
const SLOT_CUTOFF_MS = 2 * 60 * 60 * 1000;

const STATUS_STYLE: Record<MyBooking["status"], { label: string; className: string }> = {
  PLACED: { label: "Confirmed", className: "bg-green-100 text-green-800 border-green-200" },
  FULFILLED: { label: "Completed", className: "bg-stone-100 text-stone-700 border-stone-200" },
  CANCELED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" },
};

// "YYYY-MM-DD" -> Date at local midnight
function fromDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatLongDate(s: string): string {
  return fromDateString(s).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDeadline(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// short explanation under each booking about whether it can still be changed
function changeInfo(b: MyBooking): { text: string; open: boolean } | null {
  switch (changeBlockReason(b)) {
    case null: {
      // whichever comes first: 48h after booking, or 2h before the slot
      const deadline = Math.min(
        createdAtMs(b.createdAt) + CHANGE_WINDOW_MS,
        slotStartMs(b.date, b.from) - SLOT_CUTOFF_MS,
      );
      return { open: true, text: `You can change this booking until ${formatDeadline(deadline)}.` };
    }
    case "window-expired":
      return { open: false, text: "Changes closed: more than 48 hours since you booked." };
    case "too-close":
      return { open: false, text: "Changes closed: less than 2 hours before your slot." };
    default:
      return null; // fulfilled or cancelled: nothing to say
  }
}

interface Loaded {
  bookings: MyBooking[];
  tableCodes: Map<number, string>;
}

export default function MyBookingsPage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to load the list again
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    Promise.all([
      getMyBookings(),
      getTables().catch((): Table[] => []), // table codes are nice to have, not essential
    ])
      .then(([bookings, tables]) => {
        if (ignore) return;
        setError(null);
        setData({
          bookings,
          tableCodes: new Map(tables.map((t) => [t.id, t.code])),
        });
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  function handleChanged() {
    setEditingId(null);
    setNotice("Your booking has been updated.");
    setReloadKey((k) => k + 1);
  }

  const upcoming = (data?.bookings ?? [])
    .filter((b) => b.status === "PLACED" && !isPast(b))
    .sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`));

  const past = (data?.bookings ?? [])
    .filter((b) => !(b.status === "PLACED" && !isPast(b)))
    .sort((a, b) => `${b.date} ${b.from}`.localeCompare(`${a.date} ${a.from}`));

  const tableLabel = (tableId: number) => data?.tableCodes.get(tableId) ?? `#${tableId}`;

  function renderBooking(b: MyBooking) {
    const status = STATUS_STYLE[b.status];
    const day = fromDateString(b.date);
    const info = changeInfo(b);
    const editing = editingId === b.id;

    return (
      <li key={b.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="flex gap-4">
          {/* calendar-style date block */}
          <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-green-50 border border-green-100 py-2">
            <span className="text-xs font-semibold uppercase text-green-700">
              {day.toLocaleDateString("en-GB", { month: "short" })}
            </span>
            <span className="text-2xl font-extrabold leading-none text-stone-900">{day.getDate()}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-stone-900">{formatLongDate(b.date)}</p>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            <p className="text-sm text-stone-600">
              {b.from}–{b.to} · {b.partySize} {b.partySize === 1 ? "person" : "people"}
            </p>

            {b.reservations.length > 0 && (
              <p className="text-sm text-stone-500">
                Table{b.reservations.length > 1 ? "s" : ""}:{" "}
                {b.reservations.map((r) => `${tableLabel(r.tableId)} (${r.seats})`).join(", ")}
              </p>
            )}

            {b.allergens && b.allergens.length > 0 && (
              <p className="text-sm text-stone-500">
                Allergens: {b.allergens.map((a) => a.name).join(", ")}
              </p>
            )}

            {b.description && (
              <p className="text-sm text-stone-500">
                Notes: {b.description}
              </p>
            )}

            {info && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className={`text-xs ${info.open ? "text-green-700" : "text-stone-500"}`}>{info.text}</p>
                {info.open && !editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setEditingId(b.id);
                    }}
                    className="rounded-lg border border-green-600 px-3 py-1 text-sm font-semibold text-green-700 hover:bg-green-50 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {editing && (
          <ChangeBookingPanel
            booking={b}
            onCancel={() => setEditingId(null)}
            onChanged={handleChanged}
          />
        )}
      </li>
    );
  }

  return (
    <AuthShell
      width="2xl"
      badge="Your reservations"
      title="My bookings"
      subtitle="Your upcoming meals at the hut and your booking history."
    >
      {notice && (
        <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Could not load your bookings: {error}
        </div>
      )}

      {!error && !data && (
        <div className="space-y-3" aria-label="Loading bookings">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-200 animate-pulse" />
          ))}
        </div>
      )}

      {data && data.bookings.length === 0 && (
        <div className="space-y-4 py-6 text-center">
          <p className="text-stone-600">You don't have any bookings yet.</p>
          <Link
            to="/booking"
            className="inline-flex items-center justify-center px-6 py-2.5 font-semibold text-white bg-green-600 hover:bg-green-500 rounded-lg shadow-lg transition-colors"
          >
            Book a table
          </Link>
        </div>
      )}

      {data && data.bookings.length > 0 && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-700">
              Upcoming
            </h2>
            {upcoming.length > 0 ? (
              <ul className="space-y-3">{upcoming.map(renderBooking)}</ul>
            ) : (
              <p className="rounded-lg border border-dashed border-stone-300 px-4 py-5 text-center text-sm text-stone-500">
                No upcoming bookings.{" "}
                <Link to="/booking" className="font-semibold text-green-700 underline">
                  Book a table
                </Link>
              </p>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
                Past & cancelled
              </h2>
              <ul className="space-y-3 opacity-80">{past.map(renderBooking)}</ul>
            </section>
          )}
        </div>
      )}
    </AuthShell>
  );
}