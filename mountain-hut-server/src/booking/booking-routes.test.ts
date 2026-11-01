import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

/**
 * Real HTTP integration tests for MH-18.
 *
 * We mock ONLY the database connection, NOT the booking service or route.
 * A dedicated in-memory SQLite database is created for this test file;
 * local.db, the seed database, and development reservations remain untouched.
 */
vi.mock("../db/database.ts", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const client = createClient({ url: "file::memory:" });
  return { db: drizzle({ client }), __integrationTestClient: client };
});

// Imports are intentionally AFTER vi.mock: buildApp -> routes -> booking service
// must all use the same in-memory database connection.
const { __integrationTestClient: client } = (await import("../db/database.ts")) as unknown as {
  __integrationTestClient: Client;
};
const { buildApp } = await import("../server.ts");
const app = buildApp({ logger: false });

/** Use dates relative to today so that tests don't expire over time. */
function romeDate(daysFromToday: number): string {
  const reference = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const futureDate = romeDate(3);
const pastDate = romeDate(-3);

// Mirrors only the columns and constraints actually present in src/db/schema.ts.
// Explicit SQL lets the tests run without migrations, network access, or db:seed.
const createTestSchema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE "users" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "phoneNumber" INTEGER,
    "type" TEXT NOT NULL
  );
  CREATE TABLE "time_slots" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    UNIQUE("date", "from", "to")
  );
  CREATE TABLE "tables" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL UNIQUE,
    "seats" INTEGER NOT NULL
  );
  CREATE TABLE "table_availability" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "table_id" INTEGER NOT NULL REFERENCES "tables"("id"),
    "slot_id" INTEGER NOT NULL REFERENCES "time_slots"("id"),
    UNIQUE("slot_id", "table_id")
  );
  CREATE TABLE "reservations" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
    "slot_id" INTEGER NOT NULL REFERENCES "time_slots"("id"),
    "table_id" INTEGER NOT NULL REFERENCES "tables"("id"),
    "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "party_size" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PLACED'
  );
`;

async function resetFixture() {
  await client.executeMultiple(`
    DELETE FROM reservations;
    DELETE FROM table_availability;
    DELETE FROM time_slots;
    DELETE FROM tables;
    DELETE FROM users;
  `);

  await client.executeMultiple(`
    INSERT INTO users(id, email, name, surname, type) VALUES
      (1, 'hiker1@example.com', 'Hiker', 'One', 'HIKER'),
      (2, 'hiker2@example.com', 'Hiker', 'Two', 'HIKER'),
      (3, 'staff@example.com', 'Employee', 'Three', 'EMPLOYEE'),
      (4, 'hiker4@example.com', 'Hiker', 'Four', 'HIKER');

    INSERT INTO tables(id, code, seats) VALUES
      (1, 'T1', 2),
      (2, 'T2', 4),
      (3, 'T3', 6);

    INSERT INTO time_slots(id, date, "from", "to") VALUES
      (1, '${futureDate}', '12:00', '13:00'),
      (2, '${futureDate}', '13:00', '14:00'),
      (3, '${futureDate}', '19:00', '21:00'),
      (4, '${pastDate}', '12:00', '13:00'),
      (5, '${futureDate}', '21:00', '22:00');

    INSERT INTO table_availability(slot_id, table_id) VALUES
      (1, 1), (1, 2), (1, 3),
      (2, 2), (2, 3),
      (3, 1),
      (4, 1);
    -- Slot 5 intentionally has no tables.
  `);
}

async function postBooking(body: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: { "content-type": "application/json" },
    payload: body,
  });
}

async function reservationRows() {
  const response = await client.execute(
    `SELECT id, user_id, slot_id, table_id, party_size, status
     FROM reservations ORDER BY id`,
  );
  return response.rows;
}

beforeAll(async () => {
  await client.executeMultiple(createTestSchema);
  await app.ready();
});

beforeEach(async () => {
  await resetFixture();
});

afterAll(async () => {
  await app.close();
  client.close();
});

describe("POST /api/bookings — MH-18 integration", () => {
  it("201: stores a successful booking at a single table", async () => {
    const response = await postBooking({ userId: 1, slotId: 1, partySize: 5 });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "PLACED",
      userId: 1,
      slotId: 1,
      partySize: 5,
      reservations: [{ tableId: 3, seats: 5 }],
    });
    const rows = await reservationRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: 1, slot_id: 1, table_id: 3, party_size: 5, status: "PLACED" });
  });

  it("201: saves a 10-person group across two tables", async () => {
    const response = await postBooking({ userId: 2, slotId: 2, partySize: 10 });
    expect(response.statusCode).toBe(201);
    const booking = response.json();
    expect(booking.reservations).toHaveLength(2);
    expect(booking.reservations.map((r: { tableId: number }) => r.tableId).sort()).toEqual([2, 3]);
    expect(booking.reservations.reduce((sum: number, r: { seats: number }) => sum + r.seats, 0)).toBe(10);
    const rows = await reservationRows();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + Number(row.party_size), 0)).toBe(10);
  });

  it.each([
    ["zero people", { userId: 1, slotId: 1, partySize: 0 }],
    ["negative people", { userId: 1, slotId: 1, partySize: -1 }],
    ["missing partySize", { userId: 1, slotId: 1 }],
    ["non-integer partySize", { userId: 1, slotId: 1, partySize: 2.5 }],
    ["unexpected property", { userId: 1, slotId: 1, partySize: 2, extra: true }],
  ])("400: rejects %s", async (_name, body) => {
    const response = await postBooking(body);
    expect(response.statusCode).toBe(400);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("403: rejects an EMPLOYEE", async () => {
    const response = await postBooking({ userId: 3, slotId: 1, partySize: 2 });
    expect(response.statusCode).toBe(403);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("404: rejects an unknown user", async () => {
    const response = await postBooking({ userId: 999, slotId: 1, partySize: 2 });
    expect(response.statusCode).toBe(404);
  });

  it("404: rejects an unknown slot", async () => {
    const response = await postBooking({ userId: 1, slotId: 999, partySize: 2 });
    expect(response.statusCode).toBe(404);
  });

  it("409: rejects a duplicate active booking in the same slot", async () => {
    const request = { userId: 1, slotId: 1, partySize: 2 };
    expect((await postBooking(request)).statusCode).toBe(201);
    const duplicate = await postBooking(request);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: "You already have a booking for this time slot" });
    expect((await reservationRows())).toHaveLength(1);
  });

  it("409: rejects insufficient capacity without inserting partial rows", async () => {
    const response = await postBooking({ userId: 1, slotId: 2, partySize: 11 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("409: rejects a time slot in the past", async () => {
    const response = await postBooking({ userId: 1, slotId: 4, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("409: rejects a time slot with no tables", async () => {
    const response = await postBooking({ userId: 1, slotId: 5, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("ignores canceled bookings for the same hiker and for table capacity", async () => {
    await client.execute(`INSERT INTO reservations(user_id, slot_id, table_id, party_size, status)
      VALUES (1, 1, 2, 4, 'CANCELED')`);
    const response = await postBooking({ userId: 1, slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([{ tableId: 2, seats: 4 }]);
    const rows = await reservationRows();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === "PLACED")).toHaveLength(1);
  });

  it("respects seats already occupied by other hikers", async () => {
    await client.execute(`INSERT INTO reservations(user_id, slot_id, table_id, party_size, status)
      VALUES (2, 1, 2, 3, 'PLACED')`);
    const response = await postBooking({ userId: 1, slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([{ tableId: 3, seats: 4 }]);
  });

  it("never overbooks when two hikers request the last two seats simultaneously", async () => {
    // This is an integration race test; a 500 or overbooking is a real issue to investigate.
    const requests = [
      postBooking({ userId: 1, slotId: 3, partySize: 2 }),
      postBooking({ userId: 2, slotId: 3, partySize: 2 }),
    ];
    const responses = await Promise.all(requests);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const rows = await reservationRows();
    expect(rows).toHaveLength(1);
    expect(rows.reduce((sum, r) => sum + Number(r.party_size), 0)).toBe(2);
  });
});
