import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { asc } from "drizzle-orm";
import {
  reservationsTable, usersTable, timeSlotTable, tablesTable, tableAvailabilityTable,
} from "../db/schema.ts";
import { resetTestDatabase } from "../test-support/test-database.ts";

/**
 * Real HTTP integration tests for MH-18.
 *
 * We mock ONLY the database connection, NOT the booking service or route.
 * A dedicated temporary SQLite database is created for this test file;
 * local.db, the seed database, and development reservations remain untouched.
 */
vi.mock("../db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../test-support/test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __integrationTestClient: client, __integrationTestCleanup: cleanup };
});

// Imports are intentionally AFTER vi.mock: buildApp -> routes -> booking service
// must all use the same temporary SQLite database connection.
const { db: testDb } = await import("../db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
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

let passwordHash = "";
const TEST_PASSWORD = "test-password-for-booking";

const futureDate = romeDate(3);
const pastDate = romeDate(-3);

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    { id: 1, email: "hiker1@example.com", passwordHash, name: "Hiker", surname: "One", type: "HIKER" },
    { id: 2, email: "hiker2@example.com", passwordHash, name: "Hiker", surname: "Two", type: "HIKER" },
    { id: 3, email: "staff@example.com", passwordHash, name: "Employee", surname: "Three", type: "EMPLOYEE" },
    { id: 4, email: "hiker4@example.com", passwordHash, name: "Hiker", surname: "Four", type: "HIKER" },
    { id: 5, email: "manager@example.com", passwordHash, name: "Manager", surname: "Five", type: "MANAGER" },
  ]);
  await testDb.insert(tablesTable).values([
    { id: 1, code: "T1", seats: 2 },
    { id: 2, code: "T2", seats: 4 },
    { id: 3, code: "T3", seats: 6 },
  ]);
  await testDb.insert(timeSlotTable).values([
    { id: 1, date: futureDate, from: "12:00", to: "13:00" },
    { id: 2, date: futureDate, from: "13:00", to: "14:00" },
    { id: 3, date: futureDate, from: "19:00", to: "21:00" },
    { id: 4, date: pastDate, from: "12:00", to: "13:00" },
    { id: 5, date: futureDate, from: "21:00", to: "22:00" },
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 }, { slotId: 1, tableId: 2 }, { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 2 }, { slotId: 2, tableId: 3 },
    { slotId: 3, tableId: 1 }, { slotId: 4, tableId: 1 },
  ]);
}

const emails: Record<number, string> = {
  1: "hiker1@example.com",
  2: "hiker2@example.com",
  3: "staff@example.com",
  4: "hiker4@example.com",
  5: "manager@example.com",
};

async function postBooking(body: Record<string, unknown>, actingUserId: number | null = 1) {
  let cookie = "";
  if (actingUserId !== null) {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: emails[actingUserId], password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers["set-cookie"];
    cookie = (Array.isArray(setCookie) ? setCookie : [setCookie])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie).not.toBe("");
  }

  return app.inject({
    method: "POST",
    url: "/api/bookings",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    payload: body,
  });
}

async function reservationRows() {
  return testDb.select().from(reservationsTable).orderBy(asc(reservationsTable.id));
}

beforeAll(async () => {
  passwordHash = await argon2.hash(TEST_PASSWORD);
  await app.ready();
});

beforeEach(async () => {
  await resetFixture();
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("POST /api/bookings — MH-18 integration", () => {
  it("400: rejects attempts to impersonate another user through the body", async () => {
    const response = await postBooking({ userId: 2, slotId: 1, partySize: 2 }, 1);
    expect(response.statusCode).toBe(400);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("201: attributes the booking to the logged-in hiker", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, 2);
    expect(response.statusCode).toBe(201);
    expect(response.json().userId).toBe(2);
    expect((await reservationRows())[0].userId).toBe(2);
  });

  it("201: stores a successful booking at a single table", async () => {
    const response = await postBooking({ slotId: 1, partySize: 5 });
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
    expect(rows[0]).toMatchObject({ userId: 1, slotId: 1, tableId: 3, partySize: 5, status: "PLACED" });
  });

  it("201: saves a 10-person group across two tables", async () => {
    const response = await postBooking({ slotId: 2, partySize: 10 }, 2);
    expect(response.statusCode).toBe(201);
    const booking = response.json();
    expect(booking.reservations).toHaveLength(2);
    expect(booking.reservations.map((r: { tableId: number }) => r.tableId).sort()).toEqual([2, 3]);
    expect(booking.reservations.reduce((sum: number, r: { seats: number }) => sum + r.seats, 0)).toBe(10);
    const rows = await reservationRows();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, row) => sum + Number(row.partySize), 0)).toBe(10);
  });

  it.each([
    ["zero people", { slotId: 1, partySize: 0 }],
    ["negative people", { slotId: 1, partySize: -1 }],
    ["missing partySize", { slotId: 1 }],
    ["non-integer partySize", { slotId: 1, partySize: 2.5 }],
    ["exceeds maximum partySize", { slotId: 1, partySize: 1001 }],
    ["invalid userId (negative)", { userId: -1, slotId: 1, partySize: 2 }],
    ["invalid slotId (zero)", { slotId: 0, partySize: 2 }],
    ["unexpected property", { slotId: 1, partySize: 2, extra: true }],
  ])("400: rejects %s", async (_name, body) => {
    const response = await postBooking(body);
    expect(response.statusCode).toBe(400);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("403: rejects an EMPLOYEE", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, 3);
    expect(response.statusCode).toBe(403);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("403: rejects a MANAGER", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, 5);
    expect(response.statusCode).toBe(403);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("401: rejects requests without a session", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, null);
    expect(response.statusCode).toBe(401);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("404: rejects an unknown slot", async () => {
    const response = await postBooking({ slotId: 999, partySize: 2 });
    expect(response.statusCode).toBe(404);
  });

  it("409: rejects a duplicate active booking in the same slot", async () => {
    const request = { slotId: 1, partySize: 2 };
    expect((await postBooking(request)).statusCode).toBe(201);
    const duplicate = await postBooking(request);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ error: "You already have a booking for this time slot" });
    expect((await reservationRows())).toHaveLength(1);
  });

  it("409: rejects insufficient capacity without inserting partial rows", async () => {
    const response = await postBooking({ slotId: 2, partySize: 11 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("409: rejects a time slot in the past", async () => {
    const response = await postBooking({ slotId: 4, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("409: rejects a time slot with no tables", async () => {
    const response = await postBooking({ slotId: 5, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect((await reservationRows())).toHaveLength(0);
  });

  it("ignores canceled bookings for the same hiker and for table capacity", async () => {
    await testDb.insert(reservationsTable).values({
      userId: 1, slotId: 1, tableId: 2, partySize: 4, status: "CANCELED",
    });
    const response = await postBooking({ slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([{ tableId: 2, seats: 4 }]);
    const rows = await reservationRows();
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.status === "PLACED")).toHaveLength(1);
  });

  it("allows the same hiker to book two different time slots on the same date", async () => {
    const first = await postBooking({ slotId: 1, partySize: 2 });
    expect(first.statusCode).toBe(201);
    const second = await postBooking({ slotId: 2, partySize: 2 });
    expect(second.statusCode).toBe(201);
    const rows = await reservationRows();
    expect(rows.filter((r) => Number(r.userId) === 1)).toHaveLength(2);
  });

  it("chooses the smallest single table available (minimizes unused capacity)", async () => {
    const response = await postBooking({ slotId: 1, partySize: 3 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([{ tableId: 2, seats: 3 }]);
  });

  it("respects seats already occupied by other hikers", async () => {
    await testDb.insert(reservationsTable).values({
      userId: 2, slotId: 1, tableId: 2, partySize: 3, status: "PLACED",
    });
    const response = await postBooking({ slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([{ tableId: 3, seats: 4 }]);
  });

  it("never overbooks when two hikers request the last two seats simultaneously", async () => {
    const requests = [
      postBooking({ slotId: 3, partySize: 2 }, 1),
      postBooking({ slotId: 3, partySize: 2 }, 2),
    ];
    const responses = await Promise.all(requests);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const rows = await reservationRows();
    expect(rows).toHaveLength(1);
    expect(rows.reduce((sum, r) => sum + Number(r.partySize), 0)).toBe(2);
  });

  it("500: returns internal server error on unexpected database failure", async () => {
    const bookingModule = await import("./booking.ts");
    const spy = vi.spyOn(bookingModule, "createBooking").mockRejectedValueOnce(new Error("Database disconnected"));

    const response = await postBooking({ slotId: 1, partySize: 2 });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });

    spy.mockRestore();
  });
});

describe("GET /api/bookings/mine — Story 6", () => {
  async function cookieFor(userId: number) {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: emails[userId], password: TEST_PASSWORD },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers["set-cookie"];
    return (Array.isArray(setCookie) ? setCookie : [setCookie])
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.split(";")[0])
      .join("; ");
  }

  it("401: requires authentication", async () => {
    const response = await app.inject({ method: "GET", url: "/api/bookings/mine" });
    expect(response.statusCode).toBe(401);
  });

  it("403: permits only hikers", async () => {
    const response = await app.inject({
      method: "GET", url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(3) },
    });
    expect(response.statusCode).toBe(403);
  });

  it("200: returns an empty array when the hiker has no bookings", async () => {
    const response = await app.inject({
      method: "GET", url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("200: groups a multi-table reservation and gives the frontend date and booking ID", async () => {
    const created = await postBooking({ slotId: 2, partySize: 10 }, 1);
    expect(created.statusCode).toBe(201);
    const response = await app.inject({
      method: "GET", url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({
      id: created.json().reservations[0].reservationId,
      date: futureDate, slotId: 2, from: "13:00", to: "14:00",
      partySize: 10, status: "PLACED", reservations: expect.any(Array),
    });
    expect(response.json()[0].reservations).toHaveLength(2);
  });

  it("200: does not reveal another hiker's bookings", async () => {
    expect((await postBooking({ slotId: 1, partySize: 2 }, 1)).statusCode).toBe(201);
    expect((await postBooking({ slotId: 2, partySize: 2 }, 2)).statusCode).toBe(201);
    const response = await app.inject({
      method: "GET", url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].slotId).toBe(1);
  });
});
