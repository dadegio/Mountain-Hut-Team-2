import { useEffect, useState } from "react";
import { Link } from "react-router";
import { cancelBooking, getMyBookings } from "../api/bookings-api.ts";
import { getTables } from "../../slots/api/slots-api.ts";
import AuthShell from "../../shared/components/AuthShell.tsx";
import Icon, { type IconName } from "../../shared/components/Icon.tsx";
import ChangeBookingPanel from "../components/ChangeBookingPanel.tsx";
import { CHANGE_WINDOW_MS, changeBlockReason, isPast, slotStartMs } from "../rules/booking-rules.ts";
import type { MyBooking } from "../types/booking.ts";
import type { Table } from "../../slots/types/slot.ts";

const STATUS_STYLE: Record<MyBooking["status"], { label: string; className: string; icon: IconName; accent: string }> = {
  PLACED: { label: "Confirmed", className: "bg-green-100 text-green-800 border-green-200", icon: "check", accent: "before:bg-green-500" },
  FULFILLED: { label: "Completed", className: "bg-stone-100 text-stone-700 border-stone-200", icon: "check", accent: "before:bg-stone-300" },
  CANCELED: { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200", icon: "close", accent: "before:bg-red-300" },
};

const smallButton =
  "inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50";

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
    timeZone: "Europe/Rome",
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
      const deadline = slotStartMs(b.date, b.from) - CHANGE_WINDOW_MS;
      return { open: true, text: `You can change this booking until ${formatDeadline(deadline)}.` };
    }
    case "window-expired":
      return { open: false, text: "Changes closed: less than 48 hours before your slot." };
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
  const [cancellingId, setCancellingId] = useState<number | null>(null);
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

  async function handleCancel(bookingId: number) {
    setNotice(null);
    setError(null);
    setCancellingId(bookingId);
    try {
      await cancelBooking(bookingId);
      setNotice("Your booking has been cancelled.");
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingId(null);
    }
  }

  const upcoming = (data?.bookings ?? [])
    .filter((b) => b.status === "PLACED" && !isPast(b))
    .sort((a, b) => `${a.date} ${a.from}`.localeCompare(`${b.date} ${b.from}`));

  const past = (data?.bookings ?? [])
    .filter((b) => !(b.status === "PLACED" && !isPast(b)))
    .sort((a, b) => `${b.date} ${b.from}`.localeCompare(`${a.date} ${a.from}`));

  const tableLabel = (tableId: number) => data?.tableCodes.get(tableId) ?? `#${tableId}`;

  function renderBooking(b: MyBooking, index: number) {
    const status = STATUS_STYLE[b.status];
    const day = fromDateString(b.date);
    const info = changeInfo(b);
    const editing = editingId === b.id;

    return (
      <li
        key={b.id}
        style={{ animationDelay: `${index * 60}ms` }}
        className={`relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 pl-6 shadow-xs transition-shadow hover:shadow-md animate-fade-up before:absolute before:inset-y-0 before:left-0 before:w-1.5 ${status.accent}`}
      >
        <div className="flex gap-5">
          {/* calendar-style date block */}
          <div className="flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-xl bg-green-50 border border-green-100 py-2.5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-green-700">
              {day.toLocaleDateString("en-GB", { month: "short" })}
            </span>
            <span className="text-3xl font-extrabold leading-none text-stone-900">{day.getDate()}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-lg font-semibold text-stone-900">{formatLongDate(b.date)}</p>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold ${status.className}`}
              >
                <Icon name={status.icon} className="w-4 h-4" />
                {status.label}
              </span>
            </div>

            <p className="flex items-center gap-2 text-base font-medium text-stone-700">
              <Icon name="clock" className="w-5 h-5 text-stone-400" />
              {b.from}–{b.to} · {b.partySize} {b.partySize === 1 ? "person" : "people"}
            </p>

            {b.reservations.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-stone-500">
                <Icon name="tables" className="w-4 h-4 text-stone-400" />
                Table{b.reservations.length > 1 ? "s" : ""}:{" "}
                {b.reservations.map((r) => `${tableLabel(r.tableId)} (${r.seats})`).join(", ")}
              </p>
            )}

            {b.allergens && b.allergens.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-stone-500">
                <Icon name="warning" className="w-4 h-4 text-amber-500" />
                Allergens: {b.allergens.map((a) => a.name).join(", ")}
              </p>
            )}

            {b.description && (
              <p className="flex items-start gap-2 text-sm text-stone-500">
                <Icon name="info" className="w-4 h-4 mt-0.5 text-stone-400" />
                Notes: {b.description}
              </p>
            )}

            {b.status === "PLACED" && !isPast(b) && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 mt-2 border-t border-stone-100">
                {info && (
                  <p className={`flex items-center gap-1.5 text-sm ${info.open ? "text-green-700" : "text-stone-500"}`}>
                    <Icon name={info.open ? "pencil" : "info"} className="w-4 h-4" />
                    {info.text}
                  </p>
                )}
                {!editing && (
                  <div className="flex items-center gap-2">
                    {info?.open && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setEditingId(b.id);
                        }}
                        className={`${smallButton} border-green-600 text-green-700 hover:bg-green-50`}
                      >
                        <Icon name="pencil" className="w-4 h-4" />
                        Change
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCancel(b.id)}
                      disabled={cancellingId === b.id}
                      className={`${smallButton} border-red-600 text-red-700 hover:bg-red-50`}
                    >
                      <Icon name="trash" className="w-4 h-4" />
                      {cancellingId === b.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
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
      width="4xl"
      badge="Your reservations"
      title="My bookings"
      subtitle="Your upcoming meals at the hut and your booking history."
    >
      {notice && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800 animate-pop-in">
          <Icon name="check" className="w-5 h-5" />
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          <Icon name="warning" className="w-5 h-5" />
          Could not load your bookings: {error}
        </div>
      )}

      {!error && !data && (
        <div className="space-y-3" aria-label="Loading bookings">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-stone-200 animate-pulse" />
          ))}
        </div>
      )}

      {data && data.bookings.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-green-50 text-green-700 animate-pop-in">
            <Icon name="calendar" className="w-8 h-8" />
          </span>
          <p className="text-lg text-stone-600">You don't have any bookings yet.</p>
          <Link
            to="/booking"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-lg transition-all hover:shadow-xl"
          >
            <Icon name="plus" className="w-5 h-5" />
            Book a table
          </Link>
        </div>
      )}

      {data && data.bookings.length > 0 && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-green-700">
              <Icon name="calendar" className="w-5 h-5" />
              Upcoming
            </h2>
            {upcoming.length > 0 ? (
              <ul className="space-y-4">{upcoming.map(renderBooking)}</ul>
            ) : (
              <p className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/60 px-4 py-8 text-center text-base text-stone-500">
                No upcoming bookings.{" "}
                <Link to="/booking" className="font-semibold text-green-700 underline">
                  Book a table
                </Link>
              </p>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
                <Icon name="clock" className="w-5 h-5" />
                Past & cancelled
              </h2>
              <ul className="space-y-4 opacity-80">{past.map(renderBooking)}</ul>
            </section>
          )}
        </div>
      )}
    </AuthShell>
  );
}