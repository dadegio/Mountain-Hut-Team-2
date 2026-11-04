
import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "../db/database.ts";
import {
  reservationsTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
} from "../db/schema.ts";

import {
  allocateTables,
  type FreeTable,
} from "./allocation.ts";

export async function getAvailability(
  date: string,
  partySize: number
) {
  // Find slots belonging to the requested date
  const slots = await db
    .select()
    .from(timeSlotTable)
    .where(eq(timeSlotTable.date, date));

  if (slots.length === 0) {
    return { date, partySize, slots: [] };
  }

  const slotIds = slots.map(slot => slot.id);

  // Load tables, configurations and active reservations
  const [tables, configuredTables, reservations] =
    await Promise.all([
      db.select().from(tablesTable),

      db.select()
        .from(tableAvailabilityTable)
        .where(
          inArray(tableAvailabilityTable.slotId, slotIds)
        ),

      db.select()
        .from(reservationsTable)
        .where(
          and(
            inArray(reservationsTable.slotId, slotIds),
            ne(reservationsTable.status, "CANCELED")
          )
        ),
    ]);

  const tablesById = new Map(
    tables.map(table => [table.id, table])
  );

  // Calculate occupied seats per slot and table
  const occupied = new Map<string, number>();

  for (const reservation of reservations) {
    const key =
      `${reservation.slotId}:${reservation.tableId}`;

    occupied.set(
      key,
      (occupied.get(key) ?? 0) + reservation.partySize
    );
  }

  const availableBySlot = new Map<number, FreeTable[]>();

  // Calculate remaining seats for configured tables
  for (const entry of configuredTables) {
    const table = tablesById.get(entry.tableId);
    if (!table) continue;

    const key = `${entry.slotId}:${entry.tableId}`;
    const reservedSeats = occupied.get(key) ?? 0;

    const freeSeats = Math.max(
      0,
      table.seats - reservedSeats
    );

    const slotTables =
      availableBySlot.get(entry.slotId) ?? [];

    slotTables.push({
      tableId: table.id,
      code: table.code,
      freeSeats,
    });

    availableBySlot.set(entry.slotId, slotTables);
  }

  // Include slots with no tables (zero available seats)
  return {
    date,
    partySize,

    slots: slots
      .sort(
        (a, b) =>
          a.from.localeCompare(b.from) ||
          a.id - b.id
      )
      .map(slot => {
        const slotTables =
          availableBySlot.get(slot.id) ?? [];

        const availableSeats = slotTables.reduce(
          (sum, table) => sum + table.freeSeats,
          0
        );

        const allocation = allocateTables(
          slotTables,
          partySize
        );

        return {
          slotId: slot.id,
          from: slot.from,
          to: slot.to,
          availableSeats,
          available: allocation !== null,
          tables: slotTables,
          allocation,
        };
      }),
  };
}
