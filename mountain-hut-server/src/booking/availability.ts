
import { and, eq, ne } from "drizzle-orm";
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
  // Read the database information
  const [slots, tables, configured, reservations] =
    await Promise.all([
      db.select().from(timeSlotTable),

      db.select().from(tablesTable),

      db.select().from(tableAvailabilityTable)
        .where(eq(tableAvailabilityTable.date, date)),

      db.select().from(reservationsTable)
        .where(and(
          eq(reservationsTable.scheduleDate, date),
          ne(reservationsTable.type, "CANCELED")
        )),
    ]);

  const tablesById = new Map(
    tables.map(table => [table.id, table])
  );

  // Count occupied seats for each table and slot
  const occupied = new Map<string, number>();

  for (const booking of reservations) {
    const key = `${booking.slotId}:${booking.tableId}`;

    occupied.set(
      key,
      (occupied.get(key) ?? 0) + booking.partySize
    );
  }

  const configuredBySlot = new Map<number, FreeTable[]>();
  const seen = new Set<string>();

  // Calculate free seats only for configured tables
  for (const entry of configured) {
    const key = `${entry.slotId}:${entry.tableId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const table = tablesById.get(entry.tableId);
    if (!table) continue;

    const reservedSeats = occupied.get(key) ?? 0;
    const freeSeats = Math.max(
      0,
      table.seats - reservedSeats
    );

    const slotTables =
      configuredBySlot.get(entry.slotId) ?? [];

    slotTables.push({
      tableId: table.id,
      code: table.code,
      freeSeats,
    });

    configuredBySlot.set(entry.slotId, slotTables);
  }

  // Return availability for every configured slot
  return {
    date,
    partySize,

    slots: slots
      .filter(slot => configuredBySlot.has(slot.id))
      .sort(
        (a, b) =>
          a.from.localeCompare(b.from) || a.id - b.id
      )
      .map(slot => {
        const slotTables =
          configuredBySlot.get(slot.id) ?? [];

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
