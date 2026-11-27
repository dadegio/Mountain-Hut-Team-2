import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { and, eq } from "drizzle-orm";
import {
  reservationsTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
  usersTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

// Exercise real DELETE /api/v1/bookings/:bookingId endpoint against isolated SQLite database.
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

const { db: testDb } = await import("../../../src/db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

function romeDate(daysFromToday: number): string {
  const date = new Date(Date.now() + daysFromToday * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const TEST_PASSWORD = "test-password-cancel-106";
let passwordHash = "";

const futureDate = romeDate(5);
const pastDate = romeDate(-5);

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    {
      id: 1,
      email: "hiker1@example.test",
      passwordHash,
      name: "Alice",
      surname: "Hiker",
      type: "HIKER",
    },
    {
      id: 2,
      email: "hiker2@example.test",
      passwordHash,
      name: "Bob",
      surname: "Hiker",
      type: "HIKER",
    },
    {
      id: 3,
      email: "staff@example.test",
      passwordHash,
      name: "Charlie",
      surname: "Staff",
      type: "EMPLOYEE",
    },
    {
      id: 4,
      email: "manager@example.test",
      passwordHash,
      name: "Diane",
      surname: "Manager",
      type: "MANAGER",
    },
  ]);
  await testDb.insert(tablesTable).values([
    { id: 1, code: "T1", seats: 2 },
    { id: 2, code: "T2", seats: 4 },
    { id: 3, code: "T3", seats: 6 },
  ]);
  await testDb.insert(timeSlotTable).values([
    { id: 1, date: futureDate, from: "12:00", to: "13:00" },
    { id: 2, date: futureDate, from: "13:00", to: "14:00" },
    { id: 3, date: pastDate, from: "12:00", to: "13:00" },
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 },
    { slotId: 1, tableId: 2 },
    { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 1 },
    { slotId: 3, tableId: 1 },
  ]);
}

const emails: Record<number, string> = {
  1: "hiker1@example.test",
  2: "hiker2@example.test",
  3: "staff@example.test",
  4: "manager@example.test",
};

async function loginAs(userId: number): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: emails[userId], password: TEST_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const cookieHeader = res.headers["set-cookie"];
  return Array.isArray(cookieHeader)
    ? cookieHeader[0]
    : (cookieHeader as string);
}

async function deleteBooking(bookingId: number | string, cookie?: string) {
  return app.inject({
    method: "DELETE",
    url: `/api/v1/bookings/${bookingId}`,
    headers: cookie ? { cookie } : {},
  });
}

beforeAll(async () => {
  passwordHash = await argon2.hash(TEST_PASSWORD);
  await resetFixture();
});

afterAll(async () => {
  cleanup();
});

beforeEach(async () => {
  await resetFixture();
});

describe("MH-106: DELETE /api/v1/bookings/:bookingId — Cancel a booking API", () => {
  describe("Authentication & Authorization", () => {
    it("401: rejects unauthenticated requests", async () => {
      const res = await deleteBooking(1);
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/authentication required/i);
    });

    it("403: rejects employee and manager users", async () => {
      const employeeCookie = await loginAs(3);
      const resEmployee = await deleteBooking(1, employeeCookie);
      expect(resEmployee.statusCode).toBe(403);
      expect(resEmployee.json().error).toMatch("Insufficient permissions");

      const managerCookie = await loginAs(4);
      const resManager = await deleteBooking(1, managerCookie);
      expect(resManager.statusCode).toBe(403);
      expect(resManager.json().error).toMatch("Insufficient permissions");
    });
  });

  describe("Input Validation & Ownership", () => {
    it("400: rejects invalid, zero, or negative booking ID in path", async () => {
      const cookie = await loginAs(1);

      const resAlpha = await deleteBooking("abc", cookie);
      expect(resAlpha.statusCode).toBe(400);

      const resZero = await deleteBooking(0, cookie);
      expect(resZero.statusCode).toBe(400);

      const resNegative = await deleteBooking(-5, cookie);
      expect(resNegative.statusCode).toBe(400);

      const resFloat = await deleteBooking("1.5", cookie);
      expect(resFloat.statusCode).toBe(400);
    });

    it("404: rejects non-existent booking ID", async () => {
      const cookie = await loginAs(1);
      const res = await deleteBooking(99999, cookie);
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toMatch(/booking not found/i);
    });

    it("404: does not disclose or allow cancelling another hiker's booking", async () => {
      // Hiker 1 creates a booking
      await testDb.insert(reservationsTable).values({
        id: 10,
        userId: 1,
        slotId: 1,
        tableId: 1,
        partySize: 2,
        status: "PLACED",
        createdAt: "2026-11-15 10:00:00",
      });

      // Hiker 2 attempts to cancel hiker 1's booking
      const hiker2Cookie = await loginAs(2);
      const res = await deleteBooking(10, hiker2Cookie);
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toMatch(/booking not found/i);

      // Verify the booking remains untouched
      const [row] = await testDb
        .select()
        .from(reservationsTable)
        .where(eq(reservationsTable.id, 10));
      expect(row.status).toBe("PLACED");
    });
  });

  describe("Status & Time Cutoff Rules", () => {
    it("409: rejects cancelling an already CANCELED booking", async () => {
      await testDb.insert(reservationsTable).values({
        id: 20,
        userId: 1,
        slotId: 1,
        tableId: 1,
        partySize: 2,
        status: "CANCELED",
        createdAt: "2026-11-15 10:00:00",
      });

      const cookie = await loginAs(1);
      const res = await deleteBooking(20, cookie);
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/only placed bookings/i);
    });

    it("409: rejects cancelling a FULFILLED booking", async () => {
      await testDb.insert(reservationsTable).values({
        id: 21,
        userId: 1,
        slotId: 1,
        tableId: 1,
        partySize: 2,
        status: "FULFILLED",
        createdAt: "2026-11-15 10:00:00",
      });

      const cookie = await loginAs(1);
      const res = await deleteBooking(21, cookie);
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/only placed bookings/i);
    });

    it("409: rejects cancelling when the slot has already started or is in the past", async () => {
      // Slot 3 is on pastDate (5 days ago)
      await testDb.insert(reservationsTable).values({
        id: 22,
        userId: 1,
        slotId: 3,
        tableId: 1,
        partySize: 2,
        status: "PLACED",
        createdAt: "2026-11-05 10:00:00",
      });

      const cookie = await loginAs(1);
      const res = await deleteBooking(22, cookie);
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/time slot has already started/i);
    });
  });

  describe("Successful Cancellation & Capacity Behavior", () => {
    it("200: cancels a single-table booking and updates status to CANCELED", async () => {
      await testDb.insert(reservationsTable).values({
        id: 30,
        userId: 1,
        slotId: 1,
        tableId: 1,
        partySize: 2,
        status: "PLACED",
        createdAt: "2026-11-15 10:00:00",
      });

      const cookie = await loginAs(1);
      const res = await deleteBooking(30, cookie);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: 30, status: "CANCELED" });

      const [row] = await testDb
        .select()
        .from(reservationsTable)
        .where(eq(reservationsTable.id, 30));
      expect(row.status).toBe("CANCELED");
    });

    it("200: cancels all rows belonging to a multi-table split booking atomically", async () => {
      const createdAt = "2026-11-15 10:30:00";
      // Group of 8 split across table 2 (4 seats) and table 3 (4 seats)
      await testDb.insert(reservationsTable).values([
        {
          id: 40,
          userId: 1,
          slotId: 1,
          tableId: 2,
          partySize: 4,
          status: "PLACED",
          createdAt,
        },
        {
          id: 41,
          userId: 1,
          slotId: 1,
          tableId: 3,
          partySize: 4,
          status: "PLACED",
          createdAt,
        },
      ]);

      const cookie = await loginAs(1);
      // Hiker provides ID of the first reservation row in the logical booking group
      const res = await deleteBooking(40, cookie);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ id: 40, status: "CANCELED" });

      // Both reservation rows must now be CANCELED
      const rows = await testDb
        .select()
        .from(reservationsTable)
        .where(
          and(eq(reservationsTable.userId, 1), eq(reservationsTable.slotId, 1)),
        );
      expect(rows).toHaveLength(2);
      expect(rows[0].status).toBe("CANCELED");
      expect(rows[1].status).toBe("CANCELED");
    });

    it("200: frees seats for table availability and allows re-booking the same slot", async () => {
      // Slot 2 has only table 1 (2 seats).
      // First, hiker 1 reserves the 2 seats.
      const cookie = await loginAs(1);
      const bookRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { cookie },
        payload: { slotId: 2, partySize: 2 },
      });
      expect(bookRes.statusCode).toBe(201);
      const bookingId = bookRes.json().reservations[0].reservationId;

      // Checking availability for slot 2 now shows 0 seats
      const availBefore = await app.inject({
        method: "GET",
        url: `/api/v1/availability?date=${futureDate}&partySize=2&slotId=2`,
      });
      expect(availBefore.statusCode).toBe(200);
      expect(availBefore.json().slots[0].availableSeats).toBe(0);
      expect(availBefore.json().slots[0].available).toBe(false);

      // Now hiker 1 cancels the booking
      const cancelRes = await deleteBooking(bookingId, cookie);
      expect(cancelRes.statusCode).toBe(200);

      // Checking availability shows the 2 seats are free again
      const availAfter = await app.inject({
        method: "GET",
        url: `/api/v1/availability?date=${futureDate}&partySize=2&slotId=2`,
      });
      expect(availAfter.statusCode).toBe(200);
      expect(availAfter.json().slots[0].availableSeats).toBe(2);
      expect(availAfter.json().slots[0].available).toBe(true);

      // Hiker 1 can book slot 2 again without hitting duplicate booking conflict (409)
      const rebookRes = await app.inject({
        method: "POST",
        url: "/api/v1/bookings",
        headers: { cookie },
        payload: { slotId: 2, partySize: 2 },
      });
      expect(rebookRes.statusCode).toBe(201);
    });

    it("500: returns internal server error on unexpected cancellation failure", async () => {
      const cancelModule =
        await import("../../../src/booking/services/cancel-booking.ts");
      const spy = vi
        .spyOn(cancelModule, "cancelBooking")
        .mockRejectedValueOnce(new Error("Unexpected failure"));

      try {
        const cookie = await loginAs(1);
        const res = await deleteBooking(1, cookie);

        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({ error: "Internal server error" });
      } finally {
        spy.mockRestore();
      }
    });
  });
});
