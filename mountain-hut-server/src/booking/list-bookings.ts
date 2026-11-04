import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/database.ts";
import {
  allergensTable,
  reservationAllergensTable,
  reservationsTable,
  timeSlotTable,
} from "../db/schema.ts";

/** One logical booking may span several reservation rows (one per table). */
export async function listBookingsForUser(userId: number) {
  const rows = await db.select({
    reservationId: reservationsTable.id,
    slotId: reservationsTable.slotId,
    tableId: reservationsTable.tableId,
    seats: reservationsTable.partySize,
    status: reservationsTable.status,
    description: reservationsTable.description,
    createdAt: reservationsTable.createdAt,
    date: timeSlotTable.date,
    from: timeSlotTable.from,
    to: timeSlotTable.to,
  }).from(reservationsTable)
    .innerJoin(timeSlotTable, eq(reservationsTable.slotId, timeSlotTable.id))
    .where(eq(reservationsTable.userId, userId))
    .orderBy(desc(timeSlotTable.date), desc(timeSlotTable.from), asc(reservationsTable.id));

  const reservationIds = rows.map((r) => r.reservationId);
  const allergensByReservation = new Map<number, Array<{ id: number; name: string }>>();
  if (reservationIds.length > 0) {
    const allergenRows = await db
      .select({
        reservationId: reservationAllergensTable.reservationId,
        allergenId: allergensTable.id,
        name: allergensTable.name,
      })
      .from(reservationAllergensTable)
      .innerJoin(allergensTable, eq(reservationAllergensTable.allergenId, allergensTable.id))
      .where(inArray(reservationAllergensTable.reservationId, reservationIds))
      .orderBy(asc(allergensTable.id));

    for (const a of allergenRows) {
      const list = allergensByReservation.get(a.reservationId) ?? [];
      list.push({ id: a.allergenId, name: a.name });
      allergensByReservation.set(a.reservationId, list);
    }
  }

  const bookings = new Map<string, {
    id: number;
    date: string;
    slotId: number;
    from: string;
    to: string;
    partySize: number;
    status: typeof rows[number]["status"];
    description: string | null;
    allergens: Array<{ id: number; name: string }>;
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
        description: row.description ?? null,
        allergens: [],
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
    const resAllergens = allergensByReservation.get(row.reservationId) ?? [];
    for (const allergen of resAllergens) {
      if (!booking.allergens.some((a) => a.id === allergen.id)) {
        booking.allergens.push(allergen);
      }
    }
  }
  return Array.from(bookings.values());
}
