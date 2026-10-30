import { sql } from "drizzle-orm";
import { sqliteTable, int, text, unique } from "drizzle-orm/sqlite-core";

export const USER_TYPES = ["HIKER", "EMPLOYEE", "MANAGER"] as const;
export const RESERVATION_STATUS = ["PLACED", "FULFILLED", "CANCELED"] as const;

export const usersTable = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  name: text().notNull(),
  surname: text().notNull(),
  phoneNumber: int(),
  type: text().notNull().$type<(typeof USER_TYPES)[number]>(),
});

// One row per slot on a given day: date is "YYYY-MM-DD", from/to are "HH:MM"
export const timeSlotTable = sqliteTable(
  "time_slots",
  {
    id: int().primaryKey({ autoIncrement: true }),
    date: text().notNull(),
    from: text().notNull(),
    to: text().notNull(),
  },
  (t) => [unique().on(t.date, t.from, t.to)],
);

export const tablesTable = sqliteTable("tables", {
  id: int().primaryKey({ autoIncrement: true }),
  code: text().notNull().unique(),
  seats: int().notNull(),
});

export const reservationsTable = sqliteTable("reservations", {
  id: int().primaryKey({ autoIncrement: true }),
  userId: int("user_id")
    .notNull()
    .references(() => usersTable.id, {}),
  slotId: int("slot_id")
    .notNull()
    .references(() => timeSlotTable.id, {}),
  tableId: int("table_id")
    .notNull()
    .references(() => tablesTable.id, {}),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  partySize: int("party_size").notNull().default(1),
  status: text()
    .notNull()
    .default(RESERVATION_STATUS[0])
    .$type<(typeof RESERVATION_STATUS)[number]>(),
});

// Which tables are available in a slot
export const tableAvailabilityTable = sqliteTable(
  "table_availability",
  {
    id: int().primaryKey({ autoIncrement: true }),
    tableId: int("table_id")
      .notNull()
      .references(() => tablesTable.id, {}),
    slotId: int("slot_id")
      .notNull()
      .references(() => timeSlotTable.id, {}),
  },
  (t) => [unique().on(t.slotId, t.tableId)],
);
