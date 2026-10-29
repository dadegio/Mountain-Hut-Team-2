import { useEffect, useState } from "react";
import { getMyBookings } from "../api/bookings";
import type { Booking } from "../types/booking";

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    getMyBookings()
      .then((data) => {
        if (!ignore) setBookings(data);
      })
      .catch((err: Error) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return <p className="text-stone-500">Loading bookings…</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (bookings.length === 0) return <p>No bookings yet.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">My bookings</h1>
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li
            key={b.id}
            className="bg-white border border-stone-200 rounded-lg p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{b.date}</p>
              <p className="text-sm text-stone-600">
                Slot {b.slotId} · {b.partySize} people
              </p>
            </div>
            <span
              className={
                b.status === "confirmed"
                  ? "px-2 py-1 rounded text-sm bg-green-100 text-green-800"
                  : "px-2 py-1 rounded text-sm bg-red-100 text-red-700"
              }
            >
              {b.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}