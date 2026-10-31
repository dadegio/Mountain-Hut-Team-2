import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/database.ts";
import {
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
} from "../db/schema.ts";
import {
  isPastDate,
  slotsOverlap,
  todayString,
  totalSeats,
} from "./slot-rules.ts";

export interface CreateSlotInput {
  date: string;
  from: string;
  to: string;
  tableIds: number[];
}

interface SlotTable {
  id: number;
  code: string;
  seats: number;
}

export class SlotError extends Error {
  readonly statusCode: 400 | 404 | 409;

  constructor(statusCode: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "SlotError";
    this.statusCode = statusCode;
  }
}

function toSlotResponse(
  slot: typeof timeSlotTable.$inferSelect,
  tables: SlotTable[],
) {
  return {
    id: slot.id,
    date: slot.date,
    from: slot.from,
    to: slot.to,
    totalSeats: totalSeats(tables),
    tables,
  };
}

// Tables configured for each of the given slots
async function loadSlotTables(slotIds: number[]) {
  const bySlot = new Map<number, SlotTable[]>();
  if (slotIds.length === 0) return bySlot;

  const rows = await db
    .select({
      slotId: tableAvailabilityTable.slotId,
      id: tablesTable.id,
      code: tablesTable.code,
      seats: tablesTable.seats,
    })
    .from(tableAvailabilityTable)
    .innerJoin(tablesTable, eq(tableAvailabilityTable.tableId, tablesTable.id))
    .where(inArray(tableAvailabilityTable.slotId, slotIds))
    .orderBy(asc(tablesTable.id));

  for (const { slotId, ...table } of rows) {
    const tables = bySlot.get(slotId) ?? [];
    tables.push(table);
    bySlot.set(slotId, tables);
  }

  return bySlot;
}

export async function listSlots(date: string) {
  const slots = await db
    .select()
    .from(timeSlotTable)
    .where(eq(timeSlotTable.date, date))
    .orderBy(asc(timeSlotTable.from));

  const tablesBySlot = await loadSlotTables(slots.map((slot) => slot.id));

  // A slot without tables is still returned, with 0 seats
  return slots.map((slot) =>
    toSlotResponse(slot, tablesBySlot.get(slot.id) ?? []),
  );
}

export async function getSlot(id: number) {
  const [slot] = await db
    .select()
    .from(timeSlotTable)
    .where(eq(timeSlotTable.id, id))
    .limit(1);

  if (!slot) {
    throw new SlotError(404, "Time slot not found");
  }

  const tablesBySlot = await loadSlotTables([slot.id]);
  return toSlotResponse(slot, tablesBySlot.get(slot.id) ?? []);
}

export async function createSlot(input: CreateSlotInput, now = new Date()) {
  const { date, from, to, tableIds } = input;

  if (isPastDate(date, todayString(now))) {
    throw new SlotError(400, "Cannot create a slot in the past");
  }

  // "immediate" takes the write lock up front, so two requests cannot
  // both pass the overlap check and insert clashing slots
  return db.transaction(
    async (tx) => {
      const sameDay = await tx
        .select()
        .from(timeSlotTable)
        .where(eq(timeSlotTable.date, date));

      const clash = sameDay.find((slot) => slotsOverlap(slot, { from, to }));
      if (clash) {
        throw new SlotError(
          409,
          `Slot overlaps with existing slot ${clash.from}-${clash.to}`,
        );
      }

      let tables: SlotTable[] = [];
      if (tableIds.length > 0) {
        tables = await tx
          .select()
          .from(tablesTable)
          .where(inArray(tablesTable.id, tableIds))
          .orderBy(asc(tablesTable.id));

        const missing = tableIds.filter(
          (id) => !tables.some((table) => table.id === id),
        );
        if (missing.length > 0) {
          throw new SlotError(404, `Tables not found: ${missing.join(", ")}`);
        }
      }

      const [slot] = await tx
        .insert(timeSlotTable)
        .values({ date, from, to })
        .returning();

      if (tables.length > 0) {
        await tx
          .insert(tableAvailabilityTable)
          .values(tables.map((table) => ({ slotId: slot.id, tableId: table.id })));
      }

      return toSlotResponse(slot, tables);
    },
    { behavior: "immediate" },
  );
}
