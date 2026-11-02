import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

// Exercise the real PATCH HTTP route and service against an isolated SQLite DB.
// Never touch local.db or the development seed database.
vi.mock("../db/database.ts", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const client = createClient({ url: "file::memory:" });
  return { db: drizzle({ client }), __integrationTestClient: client };
});

const { __integrationTestClient: client } = (await import("../db/database.ts")) as unknown as {
  __integrationTestClient: Client;
};
const { buildApp } = await import("../server.ts");
const app = buildApp({ logger: false });

function romeDate(daysFromToday: number): string {
  const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const futureDate = romeDate(5);
const pastDate = romeDate(-5);

const schemaSql = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, surname TEXT NOT NULL, phoneNumber INTEGER,
    type TEXT NOT NULL
  );
  CREATE TABLE time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL,
    "from" TEXT NOT NULL, "to" TEXT NOT NULL,
    UNIQUE(date, "from", "to")
  );
  CREATE TABLE tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE,
    seats INTEGER NOT NULL
  );
  CREATE TABLE table_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER NOT NULL REFERENCES tables(id),
    slot_id INTEGER NOT NULL REFERENCES time_slots(id),
    UNIQUE(slot_id, table_id)
  );
  CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    slot_id INTEGER NOT NULL REFERENCES time_slots(id),
    table_id INTEGER NOT NULL REFERENCES tables(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    party_size INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'PLACED'
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
      (1, 'first@example.test', 'First', 'Hiker', 'HIKER'),
      (2, 'second@example.test', 'Second', 'Hiker', 'HIKER'),
      (3, 'staff@example.test', 'Staff', 'Member', 'EMPLOYEE');
    INSERT INTO tables(id, code, seats) VALUES
      (1, 'T1', 2), (2, 'T2', 4), (3, 'T3', 6);
    INSERT INTO time_slots(id, date, "from", "to") VALUES
      (1, '${futureDate}', '12:00', '13:00'),
      (2, '${futureDate}', '13:00', '14:00'),
      (3, '${futureDate}', '19:00', '20:00'),
      (4, '${pastDate}', '12:00', '13:00');
    INSERT INTO table_availability(slot_id, table_id) VALUES
      (1, 1), (1, 2), (1, 3),
      (2, 2), (2, 3),
      (3, 1),
      (4, 1);
  `);
}

function postBooking(userId: number, slotId: number, partySize: number) {
  return app.inject({
    method: "POST", url: "/api/bookings",
    payload: { userId, slotId, partySize },
  });
}

function patchBooking(bookingId: number | string, payload: Record<string, unknown>) {
  return app.inject({
    method: "PATCH", url: `/api/bookings/${bookingId}`, payload,
  });
}

async function reservations() {
  return (await client.execute(`
    SELECT id, user_id, slot_id, table_id, party_size, created_at, status
    FROM reservations ORDER BY id
  `)).rows;
}

beforeAll(async () => {
  await client.executeMultiple(schemaSql);
  await app.ready();
});

beforeEach(resetFixture);

afterAll(async () => {
  await app.close();
  client.close();
});

describe("MH-46: PATCH /api/bookings/:bookingId", () => {
  it("200: moves a booking to another slot and changes its party size", async () => {
    const created = await postBooking(1, 1, 2);
    expect(created.statusCode).toBe(201);
    const id = created.json().reservations[0].reservationId;
    const before = (await reservations()).find((row) => row.id === id)!;

    const changed = await patchBooking(id, { userId: 1, slotId: 2, partySize: 5 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      bookingId: id, userId: 1, slotId: 2, partySize: 5,
      reservations: [{ reservationId: id, tableId: 3, seats: 5 }],
    });
    const after = (await reservations()).find((row) => row.id === id)!;
    expect(after).toMatchObject({ slot_id: 2, party_size: 5, created_at: before.created_at });
  });

  it("200: increases a booking across two tables without restarting the 48h clock", async () => {
    const created = await postBooking(1, 1, 5);
    const id = created.json().reservations[0].reservationId;
    const initialTimestamp = (await reservations())[0].created_at;

    const changed = await patchBooking(id, { userId: 1, partySize: 9 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().reservations).toHaveLength(2);
    const rows = await reservations();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + Number(row.party_size), 0)).toBe(9);
    expect(rows.every((row) => row.created_at === initialTimestamp)).toBe(true);
    expect(rows.some((row) => row.id === id)).toBe(true);
  });

  it("200: reduces a split booking, deletes excess rows and preserves the PATCH ID", async () => {
    const created = await postBooking(1, 2, 10);
    const id = created.json().reservations[1].reservationId;
    expect((await reservations())).toHaveLength(2);

    const changed = await patchBooking(id, { userId: 1, slotId: 1, partySize: 2 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().reservations).toMatchObject([{ reservationId: id, tableId: 1, seats: 2 }]);
    const rows = await reservations();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
  });

  it("409: leaves original rows untouched when capacity is insufficient", async () => {
    const created = await postBooking(1, 1, 5);
    const id = created.json().reservations[0].reservationId;
    const before = await reservations();

    const changed = await patchBooking(id, { userId: 1, slotId: 3, partySize: 5 });
    expect(changed.statusCode).toBe(409);
    expect(await reservations()).toEqual(before);
  });

  it("409: does not allow a duplicate active booking in the destination slot", async () => {
    const first = await postBooking(1, 1, 2);
    expect((await postBooking(1, 2, 2)).statusCode).toBe(201);
    const id = first.json().reservations[0].reservationId;
    const before = await reservations();

    expect((await patchBooking(id, { userId: 1, slotId: 2 })).statusCode).toBe(409);
    expect(await reservations()).toEqual(before);
  });

  it("409: rejects changes after 48 hours even if the meal is in the future", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    await client.execute({
      sql: "UPDATE reservations SET created_at = datetime('now', '-49 hours') WHERE id = ?",
      args: [id],
    });
    const before = await reservations();
    const changed = await patchBooking(id, { userId: 1, partySize: 3 });
    expect(changed.statusCode).toBe(409);
    expect(changed.json().error).toMatch(/48 hours/);
    expect(await reservations()).toEqual(before);
  });

  it("409: rejects a slot that has passed the MH-01 cutoff", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    expect((await patchBooking(id, { userId: 1, slotId: 4 })).statusCode).toBe(409);
  });

  it("404: does not let one hiker modify another hiker's booking", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const before = await reservations();
    expect((await patchBooking(id, { userId: 2, partySize: 3 })).statusCode).toBe(404);
    expect(await reservations()).toEqual(before);
  });

  it("403: employees cannot change a booking", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    expect((await patchBooking(id, { userId: 3, partySize: 3 })).statusCode).toBe(403);
  });

  it("409: completed and canceled reservations cannot be changed", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    for (const status of ["FULFILLED", "CANCELED"]) {
      await client.execute({ sql: "UPDATE reservations SET status = ? WHERE id = ?", args: [status, id] });
      expect((await patchBooking(id, { userId: 1, partySize: 3 })).statusCode).toBe(409);
    }
  });

  it("400: validates path parameters, fields and nonempty changes", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const invalid = [
      ["abc", { userId: 1, partySize: 3 }],
      [id, { userId: 1 }],
      [id, { userId: 1, partySize: 0 }],
      [id, { userId: 1, slotId: -1 }],
      [id, { userId: 1, partySize: 3, unexpected: true }],
    ] as const;
    for (const [bookingId, payload] of invalid) {
      expect((await patchBooking(bookingId, payload)).statusCode).toBe(400);
    }
  });

  it("preserves other hikers' seats when reallocating the same slot", async () => {
    const created = await postBooking(1, 1, 2);
    expect((await postBooking(2, 1, 4)).statusCode).toBe(201);
    const id = created.json().reservations[0].reservationId;

    const changed = await patchBooking(id, { userId: 1, partySize: 6 });
    expect(changed.statusCode).toBe(200);
    const rows = await reservations();
    expect(rows.filter((row) => row.user_id === 1).reduce((sum, row) => sum + Number(row.party_size), 0)).toBe(6);
    expect(rows.filter((row) => row.user_id === 2).reduce((sum, row) => sum + Number(row.party_size), 0)).toBe(4);
  });
});
