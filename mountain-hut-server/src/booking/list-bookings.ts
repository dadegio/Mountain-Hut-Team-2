import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db/database.ts";
import { reservationsTable, timeSlotTable } from "../db/schema.ts";

/** One logical booking may span several reservation rows (one per table). */
export async function listBookingsForUser(userId: number) {
  const rows = await db.select({
    reservationId: reservationsTable.id,
    slotId: reservationsTable.slotId,
    tableId: reservationsTable.tableId,
    seats: reservationsTable.partySize,
    status: reservationsTable.status,
    createdAt: reservationsTable.createdAt,
    date: timeSlotTable.date,
    from: timeSlotTable.from,
    to: timeSlotTable.to,
  }).from(reservationsTable)
    .innerJoin(timeSlotTable, eq(reservationsTable.slotId, timeSlotTable.id))
    .where(eq(reservationsTable.userId, userId))
    .orderBy(desc(timeSlotTable.date), desc(timeSlotTable.from), asc(reservationsTable.id));

  const bookings = new Map<string, {
    id: number;
    date: string;
    slotId: number;
    from: string;
    to: string;
    partySize: number;
    status: typeof rows[number]["status"];
    createdAt: string;
    reservations: Array<{ reservationId: number; tableId: number; seats: number }>;
  }>();

  // Matches the grouping used by changeBooking for a hiker/slot; the
  // creation timestamp also distinguishes older canceled bookings.
  for (const row of rows) {
    const key = `${row.slotId}:${row.status}:${row.createdAt}`;
    let booking = bookings.get(key);
    if (!booking) {
      booking = {
        id: row.reservationId,
        date: row.date,
        slotId: row.slotId,
        from: row.from,
        to: row.to,
        partySize: 0,
        status: row.status,
        createdAt: row.createdAt,
        reservations: [],
      };
      bookings.set(key, booking);
    }
    booking.partySize += row.seats;
    booking.reservations.push({
      reservationId: row.reservationId,
      tableId: row.tableId,
      seats: row.seats,
    });
  }
  return Array.from(bookings.values());
}
