import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { asc, eq } from "drizzle-orm";
import {
  reservationsTable, usersTable, timeSlotTable, tablesTable, tableAvailabilityTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __integrationTestClient: client, __integrationTestCleanup: cleanup };
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
    timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const TEST_PASSWORD = "mh77-integration-password";
let passwordHash = "";

const futureDate1 = romeDate(4);
const futureDate2 = romeDate(6);
const pastDate = romeDate(-4);

const emails: Record<number, string> = {
  1: "mario.rossi@example.com",
  2: "giulia.verdi@example.com",
  3: "employee@example.com",
};

async function sessionCookie(userId: number): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
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
    method: "POST",
    url: "/api/bookings",
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
    method: "PATCH",
    url: `/api/bookings/${bookingId}`,
    ...(cookie ? { headers: { cookie } } : {}),
    payload,
  });
}

async function getMyBookings(userId: number) {
  return app.inject({
    method: "GET",
    url: "/api/bookings/mine",
    headers: { cookie: await sessionCookie(userId) },
  });
}

async function getAvailability(date: string, partySize: number = 1) {
  return app.inject({
    method: "GET",
    url: `/api/availability?date=${date}&partySize=${partySize}`,
  });
}

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    { id: 1, email: emails[1], passwordHash, name: "Mario", surname: "Rossi", type: "HIKER" },
    { id: 2, email: emails[2], passwordHash, name: "Giulia", surname: "Verdi", type: "HIKER" },
    { id: 3, email: emails[3], passwordHash, name: "Luca", surname: "Staff", type: "EMPLOYEE" },
  ]);
  await testDb.insert(tablesTable).values([
    { id: 1, code: "T1", seats: 2 },
    { id: 2, code: "T2", seats: 4 },
    { id: 3, code: "T3", seats: 6 },
  ]);
  await testDb.insert(timeSlotTable).values([
    { id: 1, date: futureDate1, from: "12:00", to: "13:00" }, // T1(2), T2(4), T3(6) = 12 total seats
    { id: 2, date: futureDate1, from: "13:00", to: "14:00" }, // T2(4), T3(6) = 10 total seats
    { id: 3, date: futureDate1, from: "19:00", to: "20:00" }, // T1(2) = 2 total seats
    { id: 4, date: futureDate2, from: "12:00", to: "13:00" }, // T1(2), T2(4), T3(6) = 12 total seats
    { id: 5, date: pastDate, from: "12:00", to: "13:00" },    // Past slot
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 }, { slotId: 1, tableId: 2 }, { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 2 }, { slotId: 2, tableId: 3 },
    { slotId: 3, tableId: 1 },
    { slotId: 4, tableId: 1 }, { slotId: 4, tableId: 2 }, { slotId: 4, tableId: 3 },
    { slotId: 5, tableId: 1 },
  ]);
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

describe("MH-77: Integration tests — Change Booking lifecycle", () => {
  describe("Suite 1: Full Cross-Endpoint Lifecycle (POST -> GET /mine -> PATCH -> GET /mine -> Availability)", () => {
    it("reuses reservation rows when changing a booking spanning three tables", async () => {
      const created = await postBooking(1, 1, 12);
      expect(created.statusCode).toBe(201);
      expect(created.json().reservations).toHaveLength(3);
      const bookingId = created.json().reservations[0].reservationId;

      const changed = await patchBooking(bookingId, { partySize: 11 }, 1);

      expect(changed.statusCode).toBe(200);
      expect(changed.json().reservations).toHaveLength(3);
      expect(
        changed.json().reservations.reduce(
          (sum: number, reservation: { seats: number }) => sum + reservation.seats,
          0,
        ),
      ).toBe(11);
    });

    it("preserves logical booking identity, updates party size, and maintains the 48h clock", async () => {
      // 1. Create booking for 2 hikers
      const createRes = await postBooking(1, 1, 2);
      expect(createRes.statusCode).toBe(201);
      const bookingId = createRes.json().reservations[0].reservationId;

      // 2. Fetch via GET /mine
      const initialMine = await getMyBookings(1);
      expect(initialMine.statusCode).toBe(200);
      const initialList = initialMine.json();
      expect(initialList).toHaveLength(1);
      expect(initialList[0].id).toBe(bookingId);
      expect(initialList[0].partySize).toBe(2);
      expect(initialList[0].slotId).toBe(1);
      expect(initialList[0].status).toBe("PLACED");
      const originalCreatedAt = initialList[0].createdAt;

      // 3. PATCH party size to 4 (same slot)
      const patchRes = await patchBooking(bookingId, { partySize: 4 }, 1);
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json()).toMatchObject({
        bookingId,
        status: "PLACED",
        userId: 1,
        slotId: 1,
        partySize: 4,
      });

      // 4. GET /mine confirms update: seats increased to 4, table reallocated, createdAt unchanged
      const updatedMine = await getMyBookings(1);
      expect(updatedMine.statusCode).toBe(200);
      const updatedList = updatedMine.json();
      expect(updatedList).toHaveLength(1);
      expect(updatedList[0].id).toBe(bookingId);
      expect(updatedList[0].partySize).toBe(4);
      expect(updatedList[0].slotId).toBe(1);
      expect(updatedList[0].createdAt).toBe(originalCreatedAt); // Clock must NOT restart!

      // 5. Verify availability reflects 4 seats taken out of 12 (8 remaining)
      const availRes = await getAvailability(futureDate1, 1);
      expect(availRes.statusCode).toBe(200);
      const slot1 = availRes.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      expect(slot1.availableSeats).toBe(8);
    });

    it("moves booking to a different time slot on the same date and synchronizes availability across slots", async () => {
      // 1. Book slot 1 for 2 seats
      const createRes = await postBooking(1, 1, 2);
      expect(createRes.statusCode).toBe(201);
      const bookingId = createRes.json().reservations[0].reservationId;

      // Check slot 1 & slot 2 availability before change
      const beforeAvail = await getAvailability(futureDate1, 1);
      const beforeSlot1 = beforeAvail.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      const beforeSlot2 = beforeAvail.json().slots.find((s: { slotId: number }) => s.slotId === 2);
      expect(beforeSlot1.availableSeats).toBe(10); // 12 - 2 = 10
      expect(beforeSlot2.availableSeats).toBe(10); // 10 total

      // 2. Change booking from slot 1 to slot 2
      const patchRes = await patchBooking(bookingId, { slotId: 2 }, 1);
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().slotId).toBe(2);

      // 3. Verify in GET /mine
      const mineRes = await getMyBookings(1);
      expect(mineRes.json()[0]).toMatchObject({
        id: bookingId,
        slotId: 2,
        from: "13:00",
        to: "14:00",
        partySize: 2,
      });

      // 4. Verify slot 1 has its 2 seats restored, and slot 2 now has 2 seats occupied
      const afterAvail = await getAvailability(futureDate1, 1);
      const afterSlot1 = afterAvail.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      const afterSlot2 = afterAvail.json().slots.find((s: { slotId: number }) => s.slotId === 2);
      expect(afterSlot1.availableSeats).toBe(12); // Restored!
      expect(afterSlot2.availableSeats).toBe(8);  // Reduced!
    });

    it("changes both date/slot and party size simultaneously across different dates", async () => {
      // 1. Book on futureDate1 (slot 1) for 2 people
      const createRes = await postBooking(1, 1, 2);
      const bookingId = createRes.json().reservations[0].reservationId;

      // 2. Move to futureDate2 (slot 4) and increase party size to 6 people
      const patchRes = await patchBooking(bookingId, { slotId: 4, partySize: 6 }, 1);
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json()).toMatchObject({
        bookingId,
        slotId: 4,
        partySize: 6,
      });

      // 3. GET /mine reflects new date and new slot
      const mine = await getMyBookings(1);
      expect(mine.json()[0]).toMatchObject({
        id: bookingId,
        date: futureDate2,
        slotId: 4,
        from: "12:00",
        to: "13:00",
        partySize: 6,
      });

      // 4. Previous date slot 1 is completely free again
      const availDate1 = await getAvailability(futureDate1, 1);
      const slot1 = availDate1.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      expect(slot1.availableSeats).toBe(12);
    });

    it("handles multi-table split expansion and contraction cleanly in DB and API", async () => {
      // 1. Book single table (party size 2 -> T1)
      const createRes = await postBooking(1, 1, 2);
      const bookingId = createRes.json().reservations[0].reservationId;

      // 2. Expand group to 10 people (needs T2 [4 seats] + T3 [6 seats] = 2 rows)
      const expandRes = await patchBooking(bookingId, { partySize: 10 }, 1);
      expect(expandRes.statusCode).toBe(200);
      expect(expandRes.json().reservations).toHaveLength(2);

      // Verify in DB directly: exactly 2 reservation rows for user 1
      const dbRowsAfterExpand = await testDb.select().from(reservationsTable)
        .where(eq(reservationsTable.userId, 1));
      expect(dbRowsAfterExpand).toHaveLength(2);
      expect(dbRowsAfterExpand.reduce((acc, r) => acc + r.partySize, 0)).toBe(10);

      // Verify in GET /mine: grouped as 1 logical booking with 2 reservations
      const mineAfterExpand = await getMyBookings(1);
      expect(mineAfterExpand.json()).toHaveLength(1);
      expect(mineAfterExpand.json()[0].partySize).toBe(10);
      expect(mineAfterExpand.json()[0].reservations).toHaveLength(2);

      // 3. Contract back down to 4 people (single table T2)
      const contractRes = await patchBooking(bookingId, { partySize: 4 }, 1);
      expect(contractRes.statusCode).toBe(200);
      expect(contractRes.json().reservations).toHaveLength(1);

      // Verify in DB: excess row was cleanly deleted, only 1 active row remains
      const dbRowsAfterContract = await testDb.select().from(reservationsTable)
        .where(eq(reservationsTable.userId, 1));
      expect(dbRowsAfterContract).toHaveLength(1);
      expect(dbRowsAfterContract[0].partySize).toBe(4);
      expect(dbRowsAfterContract[0].tableId).toBe(2);
    });
  });

  describe("change-booking service input validation", () => {
    it("rejects a user who is not a hiker", async () => {
      const { changeBooking } = await import("../../../src/booking/change-booking.ts");

      await expect(
        changeBooking({ bookingId: 1, userId: 3, partySize: 2 }),
      ).rejects.toMatchObject({
        name: "BookingError",
        statusCode: 403,
        message: "Only hikers can change bookings",
      });
    });

    it("returns not found when the supplied user does not exist", async () => {
      const { changeBooking } = await import("../../../src/booking/change-booking.ts");

      await expect(
        changeBooking({ bookingId: 1, userId: 999, partySize: 2 }),
      ).rejects.toMatchObject({
        name: "BookingError",
        statusCode: 404,
        message: "User not found",
      });
    });

    it("returns an internal error when the change service fails unexpectedly", async () => {
      const changeModule = await import("../../../src/booking/change-booking.ts");
      const spy = vi
        .spyOn(changeModule, "changeBooking")
        .mockRejectedValueOnce(new Error("Database disconnected"));

      try {
        const response = await app.inject({
          method: "PATCH",
          url: "/api/bookings/1",
          headers: { cookie: await sessionCookie(1) },
          payload: { partySize: 3 },
        });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ error: "Internal server error" });
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("availability resilience to stale table references", () => {
    it("ignores an availability row whose table was deleted outside the app", async () => {
      await client.execute("PRAGMA foreign_keys = OFF");
      try {
        await client.execute(
          "INSERT INTO table_availability(slot_id, table_id) VALUES (1, 999)",
        );
      } finally {
        await client.execute("PRAGMA foreign_keys = ON");
      }

      const response = await getAvailability(futureDate1, 1);

      expect(response.statusCode).toBe(200);
      const slot = response.json().slots.find(
        (item: { slotId: number }) => item.slotId === 1,
      );
      expect(
        slot.tables.every((table: { tableId: number }) => table.tableId !== 999),
      ).toBe(true);
    });

    it("uses slot IDs to order slots that have the same start time", async () => {
      await testDb.insert(timeSlotTable).values({
        id: 6,
        date: futureDate1,
        from: "12:00",
        to: "12:30",
      });

      const response = await getAvailability(futureDate1, 1);

      expect(response.statusCode).toBe(200);
      expect(
        response.json().slots
          .filter((slot: { from: string }) => slot.from === "12:00")
          .map((slot: { slotId: number }) => slot.slotId),
      ).toEqual([1, 6]);
    });
  });

  describe("Suite 2: Multi-User Concurrency & Seat Isolation", () => {
    it("preserves other hikers' seats when reallocating on the same slot", async () => {
      // Hiker 1 books 4 seats (gets table T2)
      const res1 = await postBooking(1, 1, 4);
      const bookingId1 = res1.json().reservations[0].reservationId;

      // Hiker 2 books 2 seats (gets table T1)
      const res2 = await postBooking(2, 1, 2);
      const bookingId2 = res2.json().reservations[0].reservationId;

      // Hiker 1 increases party to 6 (reallocated to T3)
      const patch1 = await patchBooking(bookingId1, { partySize: 6 }, 1);
      expect(patch1.statusCode).toBe(200);

      // Hiker 2's booking is completely untouched
      const mine2 = await getMyBookings(2);
      expect(mine2.json()).toHaveLength(1);
      expect(mine2.json()[0]).toMatchObject({
        id: bookingId2,
        partySize: 2,
        slotId: 1,
      });
      expect(mine2.json()[0].reservations[0].tableId).toBe(1); // Still on T1
    });

    it("rolls back atomically without mutating original booking when capacity is exhausted", async () => {
      // Slot 2 has 10 total seats (T2=4, T3=6)
      // Hiker 1 books 2 seats on slot 2
      const res1 = await postBooking(1, 2, 2);
      const bookingId1 = res1.json().reservations[0].reservationId;

      // Hiker 2 books 8 seats on slot 2 (occupies remaining capacity)
      const res2 = await postBooking(2, 2, 8);
      expect(res2.statusCode).toBe(201);

      // Hiker 1 attempts to change party size from 2 to 6 (requires 4 additional seats, but 0 left)
      const patchFail = await patchBooking(bookingId1, { partySize: 6 }, 1);
      expect(patchFail.statusCode).toBe(409);
      expect(patchFail.json().error).toMatch(/Not enough available seats/i);

      // Check GET /mine for Hiker 1: original 2-seat booking remains completely intact
      const mine1 = await getMyBookings(1);
      expect(mine1.json()).toHaveLength(1);
      expect(mine1.json()[0].partySize).toBe(2);
      expect(mine1.json()[0].slotId).toBe(2);

      // Check GET /mine for Hiker 2: 8-seat booking remains completely intact
      const mine2 = await getMyBookings(2);
      expect(mine2.json()).toHaveLength(1);
      expect(mine2.json()[0].partySize).toBe(8);
    });

    it("prevents changing into a slot where the hiker already has an active booking", async () => {
      // Hiker 1 books slot 1
      const res1 = await postBooking(1, 1, 2);
      const bookingId1 = res1.json().reservations[0].reservationId;

      // Hiker 1 also books slot 2
      const res2 = await postBooking(1, 2, 2);
      expect(res2.statusCode).toBe(201);

      // Hiker 1 tries to move booking 1 into slot 2
      const duplicatePatch = await patchBooking(bookingId1, { slotId: 2 }, 1);
      expect(duplicatePatch.statusCode).toBe(409);
      expect(duplicatePatch.json().error).toMatch(/already have a booking for this time slot/i);

      // Both original bookings are preserved
      const mine = await getMyBookings(1);
      expect(mine.json()).toHaveLength(2);
      expect(mine.json().map((b: { slotId: number }) => b.slotId).sort()).toEqual([1, 2]);
    });
  });

  describe("Suite 3: Business Rule Boundaries & Enforcements", () => {
    it("rejects changes when the 48-hour change window has expired", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      // Age the booking's createdAt by 49 hours
      const fortyNineHoursAgo = new Date(Date.now() - 49 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      await testDb.update(reservationsTable)
        .set({ createdAt: fortyNineHoursAgo })
        .where(eq(reservationsTable.id, bookingId));

      const patchRes = await patchBooking(bookingId, { partySize: 4 }, 1);
      expect(patchRes.statusCode).toBe(409);
      expect(patchRes.json().error).toContain("48 hours");

      // Verify the booking was not modified
      const mine = await getMyBookings(1);
      expect(mine.json()[0].partySize).toBe(2);
    });

    it("rejects changes to a slot that has passed the 2-hour cutoff", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      // Slot 5 is in the past
      const patchRes = await patchBooking(bookingId, { slotId: 5 }, 1);
      expect(patchRes.statusCode).toBe(409);
      expect(patchRes.json().error).toContain("2 hours");
    });

    it("rejects changes to completed (FULFILLED) or CANCELED reservations", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      // Mark as CANCELED
      await testDb.update(reservationsTable)
        .set({ status: "CANCELED" })
        .where(eq(reservationsTable.id, bookingId));

      const patchCanceled = await patchBooking(bookingId, { partySize: 4 }, 1);
      expect(patchCanceled.statusCode).toBe(409);

      // Mark as FULFILLED
      await testDb.update(reservationsTable)
        .set({ status: "FULFILLED" })
        .where(eq(reservationsTable.id, bookingId));

      const patchFulfilled = await patchBooking(bookingId, { partySize: 4 }, 1);
      expect(patchFulfilled.statusCode).toBe(409);
    });
  });

  describe("Suite 4: Security, Authorization & Input Validation", () => {
    it("does not allow one hiker to view or modify another hiker's booking (404)", async () => {
      const res1 = await postBooking(1, 1, 2);
      const bookingId1 = res1.json().reservations[0].reservationId;

      // Hiker 2 attempts to change Hiker 1's booking
      const unauthorizedPatch = await patchBooking(bookingId1, { partySize: 4 }, 2);
      expect(unauthorizedPatch.statusCode).toBe(404);
      expect(unauthorizedPatch.json().error).toMatch(/Booking not found/i);

      // Hiker 2's GET /mine does not include Hiker 1's booking
      const mine2 = await getMyBookings(2);
      expect(mine2.json()).toHaveLength(0);
    });

    it("requires authentication for PATCH (401)", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      const unauthPatch = await patchBooking(bookingId, { partySize: 4 }, null);
      expect(unauthPatch.statusCode).toBe(401);
    });

    it("forbids non-hiker staff from changing hiker bookings (403)", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      // Employee tries to change the booking
      const employeePatch = await patchBooking(bookingId, { partySize: 4 }, 3);
      expect(employeePatch.statusCode).toBe(403);
    });

    it("validates request payload strictly (400 on invalid or unexpected inputs)", async () => {
      const res = await postBooking(1, 1, 2);
      const bookingId = res.json().reservations[0].reservationId;

      // 1. Empty payload (no change fields provided)
      const emptyPatch = await patchBooking(bookingId, {}, 1);
      expect(emptyPatch.statusCode).toBe(400);

      // 2. Party size <= 0
      const zeroParty = await patchBooking(bookingId, { partySize: 0 }, 1);
      expect(zeroParty.statusCode).toBe(400);

      // 3. Negative slotId
      const negativeSlot = await patchBooking(bookingId, { slotId: -1 }, 1);
      expect(negativeSlot.statusCode).toBe(400);

      // 4. Unexpected extra fields (body schema strictness)
      const extraFields = await patchBooking(bookingId, { partySize: 3, hackerField: true }, 1);
      expect(extraFields.statusCode).toBe(400);

      // 5. Non-existent slot ID (404)
      const nonExistentSlot = await patchBooking(bookingId, { slotId: 9999 }, 1);
      expect(nonExistentSlot.statusCode).toBe(404);
    });
  });
});
