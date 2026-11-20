import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { asc, eq } from "drizzle-orm";
import {
  reservationsTable,
  usersTable,
  timeSlotTable,
  tablesTable,
  tableAvailabilityTable,
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
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const TEST_PASSWORD = "mh24-staff-integration-password";
let passwordHash = "";

const futureDate1 = romeDate(3);
const futureDate2 = romeDate(5);
const pastDate = romeDate(-3);

const emails: Record<number, string> = {
  1: "mario.hiker@example.com",
  2: "giulia.hiker@example.com",
  3: "staff.employee@example.com",
  4: "manager.admin@example.com",
  5: "colleague.staff@example.com",
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

async function postStaffBooking(
  body: Record<string, unknown>,
  actingUserId: number | null = 3, // default: employee (userId 3)
) {
  const cookie = actingUserId === null ? null : await sessionCookie(actingUserId);
  return app.inject({
    method: "POST",
    url: "/api/v1/staff/bookings",
    ...(cookie ? { headers: { cookie } } : {}),
    payload: body,
  });
}

async function postHikerBooking(
  userId: number,
  slotId: number,
  partySize: number,
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/bookings",
    headers: { cookie: await sessionCookie(userId) },
    payload: { slotId, partySize },
  });
}

async function getMyBookings(userId: number) {
  return app.inject({
    method: "GET",
    url: "/api/v1/bookings/mine",
    headers: { cookie: await sessionCookie(userId) },
  });
}

async function getAvailability(date: string, partySize: number = 1) {
  return app.inject({
    method: "GET",
    url: `/api/v1/availability?date=${date}&partySize=${partySize}`,
  });
}

async function reservationRows() {
  return testDb.select().from(reservationsTable).orderBy(asc(reservationsTable.id));
}

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    { id: 1, email: emails[1], passwordHash, name: "Mario", surname: "Hiker", type: "HIKER" },
    { id: 2, email: emails[2], passwordHash, name: "Giulia", surname: "Hiker", type: "HIKER" },
    { id: 3, email: emails[3], passwordHash, name: "Luca", surname: "Employee", type: "EMPLOYEE" },
    { id: 4, email: emails[4], passwordHash, name: "Anna", surname: "Manager", type: "MANAGER" },
    { id: 5, email: emails[5], passwordHash, name: "Marco", surname: "Staff", type: "EMPLOYEE" },
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
    { id: 4, date: futureDate2, from: "12:00", to: "13:00" }, // T1(2), T2(4) = 6 total seats
    { id: 5, date: pastDate, from: "12:00", to: "13:00" },    // Past slot
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 }, { slotId: 1, tableId: 2 }, { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 2 }, { slotId: 2, tableId: 3 },
    { slotId: 3, tableId: 1 },
    { slotId: 4, tableId: 1 }, { slotId: 4, tableId: 2 },
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

describe("MH-24: Integration tests — Reserve for a hiker (MH-07)", () => {
  describe("Suite 1: Staff Reservation Lifecycle & Beneficiary Visibility", () => {
    it("EMPLOYEE reserves for a registered HIKER; beneficiary sees it in /bookings/mine", async () => {
      // Check initial availability
      const beforeAvail = await getAvailability(futureDate1, 4);
      expect(beforeAvail.statusCode).toBe(200);
      const slot1Before = beforeAvail.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      expect(slot1Before.availableSeats).toBe(12);

      // Staff (userId 3) reserves for Hiker (userId 1)
      const res = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 4,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toMatchObject({
        status: "PLACED",
        userId: 1,
        slotId: 1,
        partySize: 4,
      });
      expect(body.reservations).toHaveLength(1);
      expect(body.reservations[0].seats).toBe(4);

      // Verify DB persistence
      const rows = await reservationRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: 1,
        slotId: 1,
        partySize: 4,
        status: "PLACED",
      });

      // Beneficiary hiker (userId 1) sees the booking in their list
      const hikerBookings = await getMyBookings(1);
      expect(hikerBookings.statusCode).toBe(200);
      expect(hikerBookings.json()).toHaveLength(1);
      expect(hikerBookings.json()[0]).toMatchObject({
        id: rows[0].id,
        slotId: 1,
        date: futureDate1,
        from: "12:00",
        to: "13:00",
        partySize: 4,
        status: "PLACED",
      });

      // The employee cannot call /bookings/mine (it is restricted to hikers only - 403)
      const staffBookings = await getMyBookings(3);
      expect(staffBookings.statusCode).toBe(403);

      // Another hiker (userId 2) does not see this booking
      const otherHikerBookings = await getMyBookings(2);
      expect(otherHikerBookings.statusCode).toBe(200);
      expect(otherHikerBookings.json()).toHaveLength(0);

      // Availability is decremented by 4 seats (12 -> 8)
      const afterAvail = await getAvailability(futureDate1, 4);
      expect(afterAvail.statusCode).toBe(200);
      const slot1After = afterAvail.json().slots.find((s: { slotId: number }) => s.slotId === 1);
      expect(slot1After.availableSeats).toBe(8);
    });

    it("stores the staff-selected menu in the existing booking description", async () => {
      const res = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 2,
        description: "Menu: Hut Lunch",
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().description).toBe("Menu: Hut Lunch");
      const rows = await reservationRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].description).toBe("Menu: Hut Lunch");
      const mine = await getMyBookings(1);
      expect(mine.statusCode).toBe(200);
      expect(mine.json()[0].description).toBe("Menu: Hut Lunch");
    });

    it("MANAGER reserves for a registered HIKER; follows the same lifecycle", async () => {
      const res = await postStaffBooking(
        { hikerId: 2, slotId: 1, partySize: 2 },
        4, // acting user: Manager (userId 4)
      );

      expect(res.statusCode).toBe(201);
      expect(res.json().userId).toBe(2);

      const rows = await reservationRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].userId).toBe(2);

      const hikerBookings = await getMyBookings(2);
      expect(hikerBookings.statusCode).toBe(200);
      expect(hikerBookings.json()[0]).toMatchObject({
        slotId: 1,
        date: futureDate1,
        partySize: 2,
        status: "PLACED",
      });
    });

    it("persists multi-table cluster allocations for larger parties booked by staff", async () => {
      // Slot 2 has T2(4) + T3(6) = 10 seats. Party of 10 requires both tables.
      const res = await postStaffBooking({
        hikerId: 1,
        slotId: 2,
        partySize: 10,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().reservations).toHaveLength(2);

      const rows = await reservationRows();
      expect(rows).toHaveLength(2);
      const sumSeats = rows.reduce((acc, r) => acc + Number(r.partySize), 0);
      expect(sumSeats).toBe(10);
      expect(rows.every((r) => r.userId === 1)).toBe(true);

      // Remaining seats in slot 2 are now 0
      const avail = await getAvailability(futureDate1, 1);
      const slot2 = avail.json().slots.find((s: { slotId: number }) => s.slotId === 2);
      expect(slot2.availableSeats).toBe(0);
      expect(slot2.available).toBe(false);
    });
  });

  describe("Suite 2: Late-Booking Window & Cutoff Rules (Staff vs Hiker)", () => {
    it("within 2 hours of slot start: Hiker self-booking is rejected (409) while Staff booking succeeds (201)", async () => {
      const { hutSlotStartMs } = await import("../../../src/booking/rules/booking-rules.ts");
      // Set system clock to 11:15 (45 minutes before slot 1 start at 12:00)
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(hutSlotStartMs(futureDate1, "11:15")));

      try {
        // Hiker tries to book directly: rejected by 2-hour cutoff rule
        const hikerAttempt = await postHikerBooking(2, 1, 2);
        expect(hikerAttempt.statusCode).toBe(409);
        expect(hikerAttempt.json().error).toMatch(/Booking deadline has passed/i);

        // Staff books on behalf of hiker: permitted
        const staffAttempt = await postStaffBooking({
          hikerId: 2,
          slotId: 1,
          partySize: 2,
        });
        expect(staffAttempt.statusCode).toBe(201);
        expect(staffAttempt.json().userId).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("staff can reserve for a hiker up to 1 second before slot start", async () => {
      const { hutSlotStartMs } = await import("../../../src/booking/rules/booking-rules.ts");
      // Slot 1 starts at 12:00
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(hutSlotStartMs(futureDate1, "12:00") - 1000));

      try {
        const res = await postStaffBooking({
          hikerId: 1,
          slotId: 1,
          partySize: 2,
        });
        expect(res.statusCode).toBe(201);
      } finally {
        vi.useRealTimers();
      }
    });

    it("staff CANNOT reserve for a slot that has already started (409)", async () => {
      const { hutSlotStartMs } = await import("../../../src/booking/rules/booking-rules.ts");
      // Slot 1 starts at 12:00; test at 12:05
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(hutSlotStartMs(futureDate1, "12:05")));

      try {
        const res = await postStaffBooking({
          hikerId: 1,
          slotId: 1,
          partySize: 2,
        });
        expect(res.statusCode).toBe(409);
        expect(res.json().error).toBe("Time slot has already started");
        expect(await reservationRows()).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("staff CANNOT reserve for a slot at the exact start timestamp (409)", async () => {
      const { hutSlotStartMs } = await import("../../../src/booking/rules/booking-rules.ts");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(hutSlotStartMs(futureDate1, "12:00")));

      try {
        const res = await postStaffBooking({
          hikerId: 1,
          slotId: 1,
          partySize: 2,
        });
        expect(res.statusCode).toBe(409);
        expect(res.json().error).toBe("Time slot has already started");
        expect(await reservationRows()).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("staff CANNOT reserve for a slot in the past (409)", async () => {
      const res = await postStaffBooking({
        hikerId: 1,
        slotId: 5, // past slot
        partySize: 2,
      });
      expect(res.statusCode).toBe(409);
      expect(await reservationRows()).toHaveLength(0);
    });
  });

  describe("Suite 3: Role-Based Authorization & Input Validation", () => {
    it("401: rejects unauthenticated requests with no session cookie", async () => {
      const res = await postStaffBooking(
        { hikerId: 1, slotId: 1, partySize: 2 },
        null, // unauthenticated
      );
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/Authentication required/i);
      expect(await reservationRows()).toHaveLength(0);
    });

    it("403: rejects requests made by a HIKER user", async () => {
      const res = await postStaffBooking(
        { hikerId: 2, slotId: 1, partySize: 2 },
        1, // acting user is Mario (HIKER)
      );
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch(/Only employees and managers can book for hikers/i);
      expect(await reservationRows()).toHaveLength(0);
    });

    it("403: rejects staff attempts to reserve for a beneficiary who is not a HIKER", async () => {
      // Trying to book for colleague (userId 5, EMPLOYEE) or Manager (userId 4, MANAGER)
      const forEmployee = await postStaffBooking({
        hikerId: 5,
        slotId: 1,
        partySize: 2,
      });
      expect(forEmployee.statusCode).toBe(403);

      const forManager = await postStaffBooking({
        hikerId: 4,
        slotId: 1,
        partySize: 2,
      });
      expect(forManager.statusCode).toBe(403);

      expect(await reservationRows()).toHaveLength(0);
    });

    it("404: rejects non-existent hikerId", async () => {
      const res = await postStaffBooking({
        hikerId: 99999,
        slotId: 1,
        partySize: 2,
      });
      expect(res.statusCode).toBe(404);
      expect(await reservationRows()).toHaveLength(0);
    });

    it("404: rejects non-existent slotId", async () => {
      const res = await postStaffBooking({
        hikerId: 1,
        slotId: 99999,
        partySize: 2,
      });
      expect(res.statusCode).toBe(404);
      expect(await reservationRows()).toHaveLength(0);
    });

    it.each([
      ["missing hikerId", { slotId: 1, partySize: 2 }],
      ["zero hikerId", { hikerId: 0, slotId: 1, partySize: 2 }],
      ["negative hikerId", { hikerId: -1, slotId: 1, partySize: 2 }],
      ["missing slotId", { hikerId: 1, partySize: 2 }],
      ["zero partySize", { hikerId: 1, slotId: 1, partySize: 0 }],
      ["negative partySize", { hikerId: 1, slotId: 1, partySize: -4 }],
      ["exceeds max party size 1000", { hikerId: 1, slotId: 1, partySize: 1001 }],
      ["unexpected extra keys (strict schema)", { hikerId: 1, slotId: 1, partySize: 2, extra: true }],
      ["menu notes over 1000 chars", { hikerId: 1, slotId: 1, partySize: 2, description: "x".repeat(1001) }],
    ])("400: rejects invalid payload (%s)", async (_description, payload) => {
      const res = await postStaffBooking(payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Invalid request body/i);
      expect(await reservationRows()).toHaveLength(0);
    });
  });

  describe("Suite 4: Capacity & Duplicate Protection", () => {
    it("409: prevents duplicate active bookings for the same hiker in the same slot", async () => {
      const first = await postStaffBooking({ hikerId: 1, slotId: 1, partySize: 2 });
      expect(first.statusCode).toBe(201);

      const duplicate = await postStaffBooking({ hikerId: 1, slotId: 1, partySize: 2 });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.json().error).toMatch(/already.*booking/i);

      // Only one booking remains in DB
      expect(await reservationRows()).toHaveLength(1);
    });

    it("allows the same hiker to have bookings in different slots", async () => {
      const slot1Res = await postStaffBooking({ hikerId: 1, slotId: 1, partySize: 2 });
      expect(slot1Res.statusCode).toBe(201);

      const slot2Res = await postStaffBooking({ hikerId: 1, slotId: 2, partySize: 2 });
      expect(slot2Res.statusCode).toBe(201);

      const rows = await reservationRows();
      expect(rows).toHaveLength(2);
    });

    it("409: rolls back atomically when party size exceeds available capacity", async () => {
      // Slot 3 only has T1(2 seats). Requesting 3 seats fails with no DB mutations
      const res = await postStaffBooking({ hikerId: 1, slotId: 3, partySize: 3 });
      expect(res.statusCode).toBe(409);

      expect(await reservationRows()).toHaveLength(0);

      // Slot remains fully available for 2 seats
      const avail = await getAvailability(futureDate1, 2);
      const slot3 = avail.json().slots.find((s: { slotId: number }) => s.slotId === 3);
      expect(slot3.availableSeats).toBe(2);
      expect(slot3.available).toBe(true);
    });
  });

  describe("Suite 5: Concurrency & Atomicity", () => {
    it("prevents overbooking when staff and hiker book the last available seats simultaneously", async () => {
      // Slot 3 has only 2 seats
      const [resStaff, resHiker] = await Promise.all([
        postStaffBooking({ hikerId: 1, slotId: 3, partySize: 2 }),
        postHikerBooking(2, 3, 2),
      ]);

      const statusCodes = [resStaff.statusCode, resHiker.statusCode].sort();
      expect(statusCodes).toEqual([201, 409]);

      const rows = await reservationRows();
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].partySize)).toBe(2);
    });
  });
});
