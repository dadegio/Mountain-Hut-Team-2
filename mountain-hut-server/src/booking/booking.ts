
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db/database.ts";
import {
  usersTable,
  timeSlotTable,
  tablesTable,
  tableAvailabilityTable,
  reservationsTable,
} from "../db/schema.ts";
import {
  allocateTables,
  type FreeTable,
} from "./allocation.ts";

export interface CreateBookingInput {
  userId: number;
  slotId: number;
  partySize: number;
}

export class BookingError extends Error {
  readonly statusCode: 403 | 404 | 409;

  constructor(
    statusCode: 403 | 404 | 409,
    message: string
  ) {
    super(message);
    this.name = "BookingError";
    this.statusCode = statusCode;
  }
}
export async function createBooking(input: CreateBookingInput) {
  const { userId, slotId, partySize } = input;

  return db.transaction(async (tx) => {
    // 1. Validate user
    const [user] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      throw new BookingError(404, "User not found");
    }

    if (user.type !== "HIKER") {
      throw new BookingError(403, "Only hikers can book tables");
    }

    // 2. Validate slot
    const [slot] = await tx
      .select()
      .from(timeSlotTable)
      .where(eq(timeSlotTable.id, slotId))
      .limit(1);

    if (!slot) {
      throw new BookingError(404, "Time slot not found");
    }

    // 3. Find tables configured for this slot
    const configuredTables = await tx
      .select({
        tableId: tablesTable.id,
        code: tablesTable.code,
        seats: tablesTable.seats,
      })
      .from(tableAvailabilityTable)
      .innerJoin(
        tablesTable,
        eq(tableAvailabilityTable.tableId, tablesTable.id)
      )
      .where(eq(tableAvailabilityTable.slotId, slotId));

    // 4. Retrieve non-canceled reservations
    const reservations = await tx
      .select({
        tableId: reservationsTable.tableId,
        partySize: reservationsTable.partySize,
      })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.slotId, slotId),
          ne(reservationsTable.status, "CANCELED")
        )
      );

    const occupied = new Map<number, number>();

    for (const reservation of reservations) {
      occupied.set(
        reservation.tableId,
        (occupied.get(reservation.tableId) ?? 0)
          + reservation.partySize
      );
    }

    const freeTables: FreeTable[] = configuredTables.map(
      (table) => ({
        tableId: table.tableId,
        code: table.code,
        freeSeats: Math.max(
          0,
          table.seats - (occupied.get(table.tableId) ?? 0)
        ),
      })
    );

    // 5. Allocate the requested seats
    const allocation = allocateTables(freeTables, partySize);

    if (!allocation) {
      throw new BookingError(
        409,
        "Not enough available seats for this time slot"
      );
    }

    // 6. Create all reservation rows in the transaction
    const created = await tx
      .insert(reservationsTable)
      .values(
        allocation.map((assignment) => ({
          userId,
          slotId,
          tableId: assignment.tableId,
          partySize: assignment.seats,
          status: "PLACED" as const,
        }))
      )
      .returning({
        id: reservationsTable.id,
        tableId: reservationsTable.tableId,
        seats: reservationsTable.partySize,
      });

    return {
      status: "PLACED" as const,
      userId,
      slotId,
      partySize,
      reservations: created.map((reservation) => ({
        reservationId: reservation.id,
        tableId: reservation.tableId,
        seats: reservation.seats,
      })),
    };
  }, { behavior: "immediate" });
}
