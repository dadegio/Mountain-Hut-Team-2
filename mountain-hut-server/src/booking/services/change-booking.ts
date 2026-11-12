import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/database.ts";
import {
  reservationsTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
  usersTable,
} from "../../db/schema.ts";
import { allocateTables, type FreeTable } from "../rules/allocation.ts";
import { BookingError } from "./booking.ts";
import { isSlotBookable } from "../rules/booking-rules.ts";
import { isBookingChangeAllowed } from "../rules/change-rules.ts";

export interface ChangeBookingInput {
  bookingId: number;
  /** Trusted identity supplied by the authenticated HTTP route. */
  userId: number;
  /** Select another already-configured date/time by its slot ID. */
  slotId?: number;
  partySize?: number;
  description?: string | null;
}

/**
 * Change the whole booking atomically, including all its table reservations.
 * MH-01 guarantees one active booking per hiker and slot, so these rows form
 * one booking even when the group occupies multiple tables.
 *
 * The original reservation ID remains valid; the original creation timestamp
 * is also preserved, so changes cannot reset the 48-hour MH-06 clock.
 */
export async function changeBooking(input: ChangeBookingInput) {
  const { bookingId, userId } = input;

  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(usersTable)
      .where(eq(usersTable.id, userId)).limit(1);
    if (!user) throw new BookingError(404, "User not found");
    if (user.type !== "HIKER") {
      throw new BookingError(403, "Only hikers can change bookings");
    }

    const [selected] = await tx.select().from(reservationsTable)
      .where(eq(reservationsTable.id, bookingId)).limit(1);
    // Do not disclose another hiker's booking, including its status or slot.
    if (!selected || selected.userId !== userId) {
      throw new BookingError(404, "Booking not found");
    }
    if (selected.status !== "PLACED") {
      throw new BookingError(409, "Only placed bookings may be changed");
    }

    const originalRows = await tx.select().from(reservationsTable)
      .where(and(
        eq(reservationsTable.userId, userId),
        eq(reservationsTable.slotId, selected.slotId),
        eq(reservationsTable.status, "PLACED"),
      ));

    const originalCreatedAt = originalRows
      .map((row) => row.createdAt)
      .sort()[0];
    if (!isBookingChangeAllowed(originalCreatedAt)) {
      throw new BookingError(409, "Booking change window has expired (48 hours after creation)");
    }

    const slotId = input.slotId ?? selected.slotId;
    const partySize = input.partySize ?? originalRows.reduce(
      (sum, row) => sum + row.partySize, 0,
    );

    const [slot] = await tx.select().from(timeSlotTable)
      .where(eq(timeSlotTable.id, slotId)).limit(1);
    if (!slot) throw new BookingError(404, "Time slot not found");
    if (!isSlotBookable(slot.date, slot.from)) {
      throw new BookingError(409, "Booking deadline has passed (2 hours before the slot)");
    }

    // A hiker must still have at most one active booking for the target slot.
    if (slotId !== selected.slotId) {
      const [duplicate] = await tx.select({ id: reservationsTable.id })
        .from(reservationsTable)
        .where(and(
          eq(reservationsTable.userId, userId),
          eq(reservationsTable.slotId, slotId),
          ne(reservationsTable.status, "CANCELED"),
        ))
        .limit(1);
      if (duplicate) {
        throw new BookingError(409, "You already have a booking for this time slot");
      }
    }

    const configuredTables = await tx.select({
      tableId: tablesTable.id,
      code: tablesTable.code,
      seats: tablesTable.seats,
    })
      .from(tableAvailabilityTable)
      .innerJoin(tablesTable, eq(tableAvailabilityTable.tableId, tablesTable.id))
      .where(eq(tableAvailabilityTable.slotId, slotId));

    const activeReservations = await tx.select({
      id: reservationsTable.id,
      tableId: reservationsTable.tableId,
      partySize: reservationsTable.partySize,
    })
      .from(reservationsTable)
      .where(and(
        eq(reservationsTable.slotId, slotId),
        ne(reservationsTable.status, "CANCELED"),
      ));

    // Reallocate our own seats when editing the original slot; avoid counting
    // them as occupied while still counting everybody else's reservations.
    const originalIds = new Set(originalRows.map((row) => row.id));
    const occupied = new Map<number, number>();
    for (const reservation of activeReservations) {
      if (slotId === selected.slotId && originalIds.has(reservation.id)) continue;
      occupied.set(
        reservation.tableId,
        (occupied.get(reservation.tableId) ?? 0) + reservation.partySize,
      );
    }

    const freeTables: FreeTable[] = configuredTables.map((table) => ({
      tableId: table.tableId,
      code: table.code,
      freeSeats: Math.max(0, table.seats - (occupied.get(table.tableId) ?? 0)),
    }));
    const allocation = allocateTables(freeTables, partySize);
    if (!allocation) {
      throw new BookingError(409, "Not enough available seats for this time slot");
    }

    const description = input.description === undefined
      ? selected.description
      : input.description?.trim() || null;

    // Preserve the ID used in the PATCH URL, and reuse other IDs if possible.
    const orderedRows = [
      selected,
      ...originalRows.filter((row) => row.id !== selected.id).sort((a, b) => a.id - b.id),
    ];
    const changed: Array<{ id: number; tableId: number; seats: number }> = [];

    for (let index = 0; index < allocation.length; index++) {
      const assignment = allocation[index];
      if (index < orderedRows.length) {
        const [row] = await tx.update(reservationsTable)
          .set({ slotId, tableId: assignment.tableId, partySize: assignment.seats, description })
          .where(eq(reservationsTable.id, orderedRows[index].id))
          .returning({
            id: reservationsTable.id,
            tableId: reservationsTable.tableId,
            seats: reservationsTable.partySize,
          });
        changed.push(row);
      } else {
        const [row] = await tx.insert(reservationsTable)
          .values({
            userId,
            slotId,
            tableId: assignment.tableId,
            partySize: assignment.seats,
            createdAt: originalCreatedAt,
            status: "PLACED",
            description,
          })
          .returning({
            id: reservationsTable.id,
            tableId: reservationsTable.tableId,
            seats: reservationsTable.partySize,
          });
        changed.push(row);
      }
    }

    for (const staleRow of orderedRows.slice(allocation.length)) {
      await tx.delete(reservationsTable).where(eq(reservationsTable.id, staleRow.id));
    }

    return {
      bookingId,
      status: "PLACED" as const,
      userId,
      slotId,
      partySize,
      description,
      reservations: changed.map((row) => ({
        reservationId: row.id,
        tableId: row.tableId,
        seats: row.seats,
      })),
    };
  }, { behavior: "immediate" });
}
