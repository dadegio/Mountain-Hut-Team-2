import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { asc, eq } from "drizzle-orm";
import {
  reservationsTable, usersTable, timeSlotTable, tablesTable, tableAvailabilityTable,
} from "../db/schema.ts";
import { resetTestDatabase } from "../test-support/test-database.ts";

// Exercise the real PATCH HTTP route and service against an isolated SQLite DB.
// Never touch local.db or the development seed database.
vi.mock("../db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../test-support/test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __integrationTestClient: client, __integrationTestCleanup: cleanup };
});

const { db: testDb } = await import("../db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
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

const TEST_PASSWORD = "mh46-test-password";
let passwordHash = "";

const futureDate = romeDate(5);
const pastDate = romeDate(-5);

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    { id: 1, email: "first@example.test", passwordHash, name: "First", surname: "Hiker", type: "HIKER" },
    { id: 2, email: "second@example.test", passwordHash, name: "Second", surname: "Hiker", type: "HIKER" },
    { id: 3, email: "staff@example.test", passwordHash, name: "Staff", surname: "Member", type: "EMPLOYEE" },
  ]);
  await testDb.insert(tablesTable).values([
    { id: 1, code: "T1", seats: 2 },
    { id: 2, code: "T2", seats: 4 },
    { id: 3, code: "T3", seats: 6 },
  ]);
  await testDb.insert(timeSlotTable).values([
    { id: 1, date: futureDate, from: "12:00", to: "13:00" },
    { id: 2, date: futureDate, from: "13:00", to: "14:00" },
    { id: 3, date: futureDate, from: "19:00", to: "20:00" },
    { id: 4, date: pastDate, from: "12:00", to: "13:00" },
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 }, { slotId: 1, tableId: 2 }, { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 2 }, { slotId: 2, tableId: 3 },
    { slotId: 3, tableId: 1 }, { slotId: 4, tableId: 1 },
  ]);
}

const emails: Record<number, string> = {
  1: "first@example.test",
  2: "second@example.test",
  3: "staff@example.test",
};

async function sessionCookie(userId: number): Promise<string> {
  const login = await app.inject({
    method: "POST", url: "/api/v1/auth/login",
    payload: { email: emails[userId], password: TEST_PASSWORD },
  });
  expect(login.statusCode).toBe(200);
  const header = login.headers["set-cookie"];
  const cookie = (Array.isArray(header) ? header : [header])
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).not.toBe("");
  return cookie;
}

async function postBooking(userId: number, slotId: number, partySize: number) {
  return app.inject({
    method: "POST", url: "/api/bookings",
    headers: { cookie: await sessionCookie(userId) },
    payload: { slotId, partySize },
  });
}

async function patchBooking(
  bookingId: number | string,
  payload: Record<string, unknown>,
  actingUserId: number | null = 1,
) {
  const cookie = actingUserId === null ? null : await sessionCookie(actingUserId);
  return app.inject({
    method: "PATCH", url: `/api/bookings/${bookingId}`,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

async function reservations() {
  return testDb.select().from(reservationsTable).orderBy(asc(reservationsTable.id));
}

beforeAll(async () => {
  passwordHash = await argon2.hash(TEST_PASSWORD);
  await app.ready();
});

beforeEach(resetFixture);

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-46: PATCH /api/bookings/:bookingId", () => {
  it("401: unauthenticated users cannot change a booking", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const before = await reservations();
    expect((await patchBooking(id, { partySize: 3 }, null)).statusCode).toBe(401);
    expect(await reservations()).toEqual(before);
  });

  it("400: rejects userId spoofing in PATCH body", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const before = await reservations();
    expect((await patchBooking(id, { userId: 2, partySize: 3 })).statusCode).toBe(400);
    expect(await reservations()).toEqual(before);
  });

  it("200: moves a booking to another slot and changes its party size", async () => {
    const created = await postBooking(1, 1, 2);
    expect(created.statusCode).toBe(201);
    const id = created.json().reservations[0].reservationId;
    const before = (await reservations()).find((row) => row.id === id)!;

    const changed = await patchBooking(id, { slotId: 2, partySize: 5 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      bookingId: id, userId: 1, slotId: 2, partySize: 5,
      reservations: [{ reservationId: id, tableId: 3, seats: 5 }],
    });
    const after = (await reservations()).find((row) => row.id === id)!;
    expect(after).toMatchObject({ slotId: 2, partySize: 5, createdAt: before.createdAt });
  });

  it("200: increases a booking across two tables without restarting the 48h clock", async () => {
    const created = await postBooking(1, 1, 5);
    const id = created.json().reservations[0].reservationId;
    const initialTimestamp = (await reservations())[0].createdAt;

    const changed = await patchBooking(id, { partySize: 9 });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().reservations).toHaveLength(2);
    const rows = await reservations();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + Number(row.partySize), 0)).toBe(9);
    expect(rows.every((row) => row.createdAt === initialTimestamp)).toBe(true);
    expect(rows.some((row) => row.id === id)).toBe(true);
  });

  it("200: reduces a split booking, deletes excess rows and preserves the PATCH ID", async () => {
    const created = await postBooking(1, 2, 10);
    const id = created.json().reservations[1].reservationId;
    expect((await reservations())).toHaveLength(2);

    const changed = await patchBooking(id, { slotId: 1, partySize: 2 });
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

    const changed = await patchBooking(id, { slotId: 3, partySize: 5 });
    expect(changed.statusCode).toBe(409);
    expect(await reservations()).toEqual(before);
  });

  it("409: does not allow a duplicate active booking in the destination slot", async () => {
    const first = await postBooking(1, 1, 2);
    expect((await postBooking(1, 2, 2)).statusCode).toBe(201);
    const id = first.json().reservations[0].reservationId;
    const before = await reservations();

    expect((await patchBooking(id, { slotId: 2 })).statusCode).toBe(409);
    expect(await reservations()).toEqual(before);
  });

  it("409: rejects changes after 48 hours even if the meal is in the future", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    await testDb.update(reservationsTable)
      .set({ createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ") })
      .where(eq(reservationsTable.id, id));
    const before = await reservations();
    const changed = await patchBooking(id, { partySize: 3 });
    expect(changed.statusCode).toBe(409);
    expect(changed.json().error).toMatch(/48 hours/);
    expect(await reservations()).toEqual(before);
  });

  it("409: rejects a slot that has passed the MH-01 cutoff", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    expect((await patchBooking(id, { slotId: 4 })).statusCode).toBe(409);
  });

  it("404: does not let one hiker modify another hiker's booking", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const before = await reservations();
    expect((await patchBooking(id, { partySize: 3 }, 2)).statusCode).toBe(404);
    expect(await reservations()).toEqual(before);
  });

  it("403: employees cannot change a booking", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    expect((await patchBooking(id, { partySize: 3 }, 3)).statusCode).toBe(403);
  });

  it("409: completed and canceled reservations cannot be changed", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    for (const status of ["FULFILLED", "CANCELED"] as const) {
      await testDb.update(reservationsTable).set({ status }).where(eq(reservationsTable.id, id));
      expect((await patchBooking(id, { partySize: 3 })).statusCode).toBe(409);
    }
  });

  it("400: validates path parameters, fields and nonempty changes", async () => {
    const created = await postBooking(1, 1, 2);
    const id = created.json().reservations[0].reservationId;
    const invalid = [
      ["abc", { partySize: 3 }],
      [id, {}],
      [id, { userId: 2, partySize: 3 }],
      [id, { partySize: 0 }],
      [id, { slotId: -1 }],
      [id, { partySize: 3, unexpected: true }],
    ] as const;
    for (const [bookingId, payload] of invalid) {
      expect((await patchBooking(bookingId, payload)).statusCode).toBe(400);
    }
  });

  it("preserves other hikers' seats when reallocating the same slot", async () => {
    const created = await postBooking(1, 1, 2);
    expect((await postBooking(2, 1, 4)).statusCode).toBe(201);
    const id = created.json().reservations[0].reservationId;

    const changed = await patchBooking(id, { partySize: 6 });
    expect(changed.statusCode).toBe(200);
    const rows = await reservations();
    expect(rows.filter((row) => row.userId === 1).reduce((sum, row) => sum + Number(row.partySize), 0)).toBe(6);
    expect(rows.filter((row) => row.userId === 2).reduce((sum, row) => sum + Number(row.partySize), 0)).toBe(4);
  });
});
