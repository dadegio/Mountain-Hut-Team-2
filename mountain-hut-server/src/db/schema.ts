import { sql } from "drizzle-orm";
import { sqliteTable, int, text } from "drizzle-orm/sqlite-core";

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

export const timeSlotTable = sqliteTable("time_slots", {
  id: int().primaryKey({ autoIncrement: true }),
  from: text().notNull(),
  to: text().notNull(),
});

export const tablesTable = sqliteTable("tables", {
  id: int().primaryKey({ autoIncrement: true }),
  code: text().notNull(),
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
  scheduleDate: text("schedule_date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  partySize: int("party_size").notNull().default(1),
  type: text()
    .notNull()
    .default(RESERVATION_STATUS[0])
    .$type<(typeof RESERVATION_STATUS)[number]>(),
});

export const tableAvailabilityTable = sqliteTable("table_availability", {
  id: int().primaryKey({ autoIncrement: true }),
  tableId: int("table_id")
    .notNull()
    .references(() => tablesTable.id, {}),
  slotId: int("slot_id")
    .notNull()
    .references(() => timeSlotTable.id, {}),
  date: text("created_at").notNull(),
});
