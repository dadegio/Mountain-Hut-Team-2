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
import { asc } from "drizzle-orm";
import {
  reservationsTable,
  usersTable,
  timeSlotTable,
  tablesTable,
  tableAvailabilityTable,
  allergensTable,
  reservationAllergensTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

/**
 * Real HTTP integration tests for MH-18.
 *
 * We mock ONLY the database connection, NOT the booking service or route.
 * A dedicated temporary SQLite database is created for this test file;
 * local.db, the seed database, and development reservations remain untouched.
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

// Imports are intentionally AFTER vi.mock: buildApp -> routes -> booking service
// must all use the same temporary SQLite database connection.
const { db: testDb } = await import("../../../src/db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
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
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

let passwordHash = "";
const TEST_PASSWORD = "test-password-for-booking";

const futureDate = romeDate(3);
const pastDate = romeDate(-3);

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    {
      id: 1,
      email: "hiker1@example.com",
      passwordHash,
      name: "Hiker",
      surname: "One",
      type: "HIKER",
    },
    {
      id: 2,
      email: "hiker2@example.com",
      passwordHash,
      name: "Hiker",
      surname: "Two",
      type: "HIKER",
    },
    {
      id: 3,
      email: "staff@example.com",
      passwordHash,
      name: "Employee",
      surname: "Three",
      type: "EMPLOYEE",
    },
    {
      id: 4,
      email: "hiker4@example.com",
      passwordHash,
      name: "Hiker",
      surname: "Four",
      type: "HIKER",
    },
    {
      id: 5,
      email: "manager@example.com",
      passwordHash,
      name: "Manager",
      surname: "Five",
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
    { id: 3, date: futureDate, from: "19:00", to: "21:00" },
    { id: 4, date: pastDate, from: "12:00", to: "13:00" },
    { id: 5, date: futureDate, from: "21:00", to: "22:00" },
  ]);
  await testDb.insert(tableAvailabilityTable).values([
    { slotId: 1, tableId: 1 },
    { slotId: 1, tableId: 2 },
    { slotId: 1, tableId: 3 },
    { slotId: 2, tableId: 2 },
    { slotId: 2, tableId: 3 },
    { slotId: 3, tableId: 1 },
    { slotId: 4, tableId: 1 },
  ]);
  await testDb.insert(allergensTable).values([
    { id: 1, name: "Milk" },
    { id: 2, name: "Eggs" },
    { id: 3, name: "Peanuts" },
    { id: 4, name: "Tree Nuts" },
    { id: 5, name: "Soybeans" },
    { id: 6, name: "Wheat" },
    { id: 7, name: "Fish" },
    { id: 8, name: "Shellfish" },
  ]);
}

const emails: Record<number, string> = {
  1: "hiker1@example.com",
  2: "hiker2@example.com",
  3: "staff@example.com",
  4: "hiker4@example.com",
  5: "manager@example.com",
};

async function postBooking(
  body: Record<string, unknown>,
  actingUserId: number | null = 1,
) {
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

async function reservationRows() {
  return testDb
    .select()
    .from(reservationsTable)
    .orderBy(asc(reservationsTable.id));
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
    const response = await postBooking(
      { userId: 2, slotId: 1, partySize: 2 },
      1,
    );
    expect(response.statusCode).toBe(400);
    expect(await reservationRows()).toHaveLength(0);
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
    expect(rows[0]).toMatchObject({
      userId: 1,
      slotId: 1,
      tableId: 3,
      partySize: 5,
      status: "PLACED",
    });
  });

  it("201: saves a 10-person group across two tables", async () => {
    const response = await postBooking({ slotId: 2, partySize: 10 }, 2);
    expect(response.statusCode).toBe(201);
    const booking = response.json();
    expect(booking.reservations).toHaveLength(2);
    expect(
      booking.reservations.map((r: { tableId: number }) => r.tableId).sort(),
    ).toEqual([2, 3]);
    expect(
      booking.reservations.reduce(
        (sum: number, r: { seats: number }) => sum + r.seats,
        0,
      ),
    ).toBe(10);
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
    expect(await reservationRows()).toHaveLength(0);
  });

  it("403: rejects an EMPLOYEE", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, 3);
    expect(response.statusCode).toBe(403);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("403: rejects a MANAGER", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, 5);
    expect(response.statusCode).toBe(403);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("401: rejects requests without a session", async () => {
    const response = await postBooking({ slotId: 1, partySize: 2 }, null);
    expect(response.statusCode).toBe(401);
    expect(await reservationRows()).toHaveLength(0);
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
    expect(duplicate.json()).toMatchObject({
      error: "You already have a booking for this time slot",
    });
    expect(await reservationRows()).toHaveLength(1);
  });

  it("409: rejects insufficient capacity without inserting partial rows", async () => {
    const response = await postBooking({ slotId: 2, partySize: 11 });
    expect(response.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("409: rejects a time slot in the past", async () => {
    const response = await postBooking({ slotId: 4, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("409: rejects a time slot with no tables", async () => {
    const response = await postBooking({ slotId: 5, partySize: 1 });
    expect(response.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("ignores canceled bookings for the same hiker and for table capacity", async () => {
    await testDb.insert(reservationsTable).values({
      userId: 1,
      slotId: 1,
      tableId: 2,
      partySize: 4,
      status: "CANCELED",
    });
    const response = await postBooking({ slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([
      { tableId: 2, seats: 4 },
    ]);
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
    expect(response.json().reservations).toMatchObject([
      { tableId: 2, seats: 3 },
    ]);
  });

  it("respects seats already occupied by other hikers", async () => {
    await testDb.insert(reservationsTable).values({
      userId: 2,
      slotId: 1,
      tableId: 2,
      partySize: 3,
      status: "PLACED",
    });
    const response = await postBooking({ slotId: 1, partySize: 4 });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toMatchObject([
      { tableId: 3, seats: 4 },
    ]);
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
    const bookingModule = await import("../../../src/booking/booking.ts");
    const spy = vi
      .spyOn(bookingModule, "createBooking")
      .mockRejectedValueOnce(new Error("Database disconnected"));

    const response = await postBooking({ slotId: 1, partySize: 2 });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });

    spy.mockRestore();
  });

  it("sends a confirmation email to the hiker when a booking is placed", async () => {
    const confirmationModule =
      await import("../../../src/booking/booking.notification.ts");
    const sendSpy = vi.spyOn(confirmationModule, "sendBookingConfirmation");

    const response = await postBooking({ slotId: 1, partySize: 2 });
    expect(response.statusCode).toBe(201);
    expect(sendSpy).toHaveBeenCalledWith(
      expect.anything(),
      emails[1],
      expect.objectContaining({
        hikerName: expect.any(String),
        partySize: 2,
        reference: expect.stringMatching(/^MH-/),
      }),
    );

    sendSpy.mockRestore();
  });
});

describe("GET /api/bookings/mine — Story 6", () => {
  it("401: requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
    });
    expect(response.statusCode).toBe(401);
  });

  it("403: permits only hikers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(3) },
    });
    expect(response.statusCode).toBe(403);
  });

  it("200: returns an empty array when the hiker has no bookings", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("200: groups a multi-table reservation and gives the frontend date and booking ID", async () => {
    const created = await postBooking({ slotId: 2, partySize: 10 }, 1);
    expect(created.statusCode).toBe(201);
    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0]).toMatchObject({
      id: created.json().reservations[0].reservationId,
      date: futureDate,
      slotId: 2,
      from: "13:00",
      to: "14:00",
      partySize: 10,
      status: "PLACED",
      reservations: expect.any(Array),
    });
    expect(response.json()[0].reservations).toHaveLength(2);
  });

  it("200: does not reveal another hiker's bookings", async () => {
    expect((await postBooking({ slotId: 1, partySize: 2 }, 1)).statusCode).toBe(
      201,
    );
    expect((await postBooking({ slotId: 2, partySize: 2 }, 2)).statusCode).toBe(
      201,
    );
    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    expect(response.json()[0].slotId).toBe(1);
  });
});

describe("MH-74: Allergens & Party Requirements", () => {
  it("201: saves booking with both allergenIds and description", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      allergenIds: [1, 3],
      description: "Severe peanut allergy, gluten-sensitive",
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBe("Severe peanut allergy, gluten-sensitive");
    expect(body.allergenIds).toEqual([1, 3]);
    expect(body.allergens).toEqual([
      { id: 1, name: "Milk" },
      { id: 3, name: "Peanuts" },
    ]);

    const reservations = await reservationRows();
    expect(reservations).toHaveLength(1);
    expect(reservations[0].description).toBe(
      "Severe peanut allergy, gluten-sensitive",
    );

    const allergenRows = await testDb.select().from(reservationAllergensTable);
    expect(allergenRows).toHaveLength(2);
    expect(allergenRows.map((r) => r.allergenId).sort()).toEqual([1, 3]);
  });

  it("201: saves booking with only allergenIds (description omitted)", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      allergenIds: [2],
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBeNull();
    expect(body.allergenIds).toEqual([2]);
    expect(body.allergens).toEqual([{ id: 2, name: "Eggs" }]);

    const reservations = await reservationRows();
    expect(reservations[0].description).toBeNull();

    const allergenRows = await testDb.select().from(reservationAllergensTable);
    expect(allergenRows).toHaveLength(1);
    expect(allergenRows[0].allergenId).toBe(2);
  });

  it("201: saves booking with only description (allergenIds omitted)", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      description: "Need highchair for toddler",
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBe("Need highchair for toddler");
    expect(body.allergenIds).toEqual([]);
    expect(body.allergens).toEqual([]);

    const reservations = await reservationRows();
    expect(reservations[0].description).toBe("Need highchair for toddler");

    const allergenRows = await testDb.select().from(reservationAllergensTable);
    expect(allergenRows).toHaveLength(0);
  });

  it("201: backwards compatibility with legacy requirements string", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      requirements: "Vegan menu preferred",
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.description).toBe("Vegan menu preferred");

    const reservations = await reservationRows();
    expect(reservations[0].description).toBe("Vegan menu preferred");
  });

  it("201: associates allergens across all reservation rows for multi-table bookings", async () => {
    const response = await postBooking({
      slotId: 2,
      partySize: 10,
      allergenIds: [1, 2],
      description: "Big group with dairy allergy",
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.reservations).toHaveLength(2);

    const allergenRows = await testDb.select().from(reservationAllergensTable);
    expect(allergenRows).toHaveLength(4);
  });

  it("400: rejects nonexistent allergen IDs", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      allergenIds: [9999],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "One or more allergen IDs are invalid",
    });
    expect(await reservationRows()).toHaveLength(0);
  });

  it("400: rejects negative or invalid allergen ID types", async () => {
    const response = await postBooking({
      slotId: 1,
      partySize: 2,
      allergenIds: [-5],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Invalid request body");
  });

  it("GET /api/bookings/mine returns allergens and description for placed bookings", async () => {
    await postBooking(
      {
        slotId: 1,
        partySize: 2,
        allergenIds: [1, 3],
        description: "Severe nut allergy",
      },
      1,
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/bookings/mine",
      headers: { cookie: await cookieFor(1) },
    });

    expect(response.statusCode).toBe(200);
    const list = response.json();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      slotId: 1,
      partySize: 2,
      description: "Severe nut allergy",
      allergens: [
        { id: 1, name: "Milk" },
        { id: 3, name: "Peanuts" },
      ],
    });
  });
});

// MH-07: on-behalf-of booking for an existing HIKER, using the same real
// Fastify server, isolated test DB and login fixtures as the MH-18 tests above.
async function postStaffBooking(
  body: Record<string, unknown>,
  actingUserId: number | null = 3,
) {
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
    url: "/api/staff/bookings",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    payload: body,
  });
}

describe("POST /api/staff/bookings — MH-07 existing hiker", () => {
  it("201: EMPLOYEE books for another registered HIKER", async () => {
    const response = await postStaffBooking({
      hikerId: 1,
      slotId: 1,
      partySize: 3,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      status: "PLACED",
      userId: 1,
      slotId: 1,
      partySize: 3,
      reservations: [{ tableId: 2, seats: 3 }],
    });
    const rows = await reservationRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: 1, slotId: 1, partySize: 3 });
  });

  it("201: MANAGER can book for a registered HIKER", async () => {
    const response = await postStaffBooking(
      { hikerId: 2, slotId: 1, partySize: 2 },
      5,
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().userId).toBe(2);
    expect((await reservationRows())[0].userId).toBe(2);
  });

  it("201: reuses multi-table allocation and persists every assignment", async () => {
    const response = await postStaffBooking({
      hikerId: 2,
      slotId: 2,
      partySize: 10,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().reservations).toHaveLength(2);
    const rows = await reservationRows();
    expect(rows).toHaveLength(2);
    expect(rows.reduce((total, row) => total + Number(row.partySize), 0)).toBe(
      10,
    );
    expect(rows.every((row) => Number(row.userId) === 2)).toBe(true);
  });

  it("401: requires an authenticated staff session", async () => {
    const response = await postStaffBooking(
      { hikerId: 1, slotId: 1, partySize: 2 },
      null,
    );
    expect(response.statusCode).toBe(401);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("403: a HIKER cannot use the staff endpoint", async () => {
    const response = await postStaffBooking(
      { hikerId: 2, slotId: 1, partySize: 2 },
      1,
    );
    expect(response.statusCode).toBe(403);
    expect(await reservationRows()).toHaveLength(0);
  });

  it.each([
    ["missing hikerId", { slotId: 1, partySize: 2 }],
    ["zero hikerId", { hikerId: 0, slotId: 1, partySize: 2 }],
    ["noninteger hikerId", { hikerId: 1.5, slotId: 1, partySize: 2 }],
    ["string hikerId", { hikerId: "1", slotId: 1, partySize: 2 }],
    ["invalid slotId", { hikerId: 1, slotId: 0, partySize: 2 }],
    ["invalid partySize", { hikerId: 1, slotId: 1, partySize: -1 }],
    ["additional userId", { hikerId: 1, userId: 2, slotId: 1, partySize: 2 }],
    [
      "additional role",
      { hikerId: 1, role: "MANAGER", slotId: 1, partySize: 2 },
    ],
  ])("400: rejects %s", async (_description, body) => {
    const response = await postStaffBooking(body);
    expect(response.statusCode).toBe(400);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("404: rejects a target hiker that does not exist", async () => {
    const response = await postStaffBooking({
      hikerId: 999,
      slotId: 1,
      partySize: 2,
    });
    expect(response.statusCode).toBe(404);
    expect(await reservationRows()).toHaveLength(0);
  });

  it.each([3, 5])("403: target user %i is not a HIKER", async (hikerId) => {
    const response = await postStaffBooking({
      hikerId,
      slotId: 1,
      partySize: 2,
    });
    expect(response.statusCode).toBe(403);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("409: rejects duplicate active bookings for the target hiker", async () => {
    const body = { hikerId: 1, slotId: 1, partySize: 2 };
    expect((await postStaffBooking(body)).statusCode).toBe(201);
    const duplicate = await postStaffBooking(body);
    expect(duplicate.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(1);
  });

  it("409: rejects insufficient capacity without partial writes", async () => {
    const response = await postStaffBooking({
      hikerId: 1,
      slotId: 2,
      partySize: 11,
    });
    expect(response.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("201: staff can book within two hours of the slot start, while an hiker cannot", async () => {
    const { hutSlotStartMs } =
      await import("../../../src/booking/booking-rules.ts");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(hutSlotStartMs(futureDate, "11:00")));
    try {
      const hiker = await postBooking({ slotId: 1, partySize: 1 }, 2);
      expect(hiker.statusCode).toBe(409);
      const staff = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 1,
      });
      expect(staff.statusCode).toBe(201);
      expect(await reservationRows()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("201: staff can book after the slot starts but before its end", async () => {
    const { hutSlotStartMs } =
      await import("../../../src/booking/booking-rules.ts");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(hutSlotStartMs(futureDate, "12:30")));
    try {
      const response = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 1,
      });
      expect(response.statusCode).toBe(201);
      expect(await reservationRows()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("409: staff cannot book at the exact end of the slot", async () => {
    const { hutSlotStartMs } =
      await import("../../../src/booking/booking-rules.ts");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(hutSlotStartMs(futureDate, "13:00")));
    try {
      const response = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 1,
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: "Time slot has already ended",
      });
      expect(await reservationRows()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("409: staff cannot book a slot that ended in the past", async () => {
    const response = await postStaffBooking({
      hikerId: 1,
      slotId: 4,
      partySize: 1,
    });
    expect(response.statusCode).toBe(409);
    expect(await reservationRows()).toHaveLength(0);
  });

  it("does not overbook during concurrent staff and hiker requests", async () => {
    const responses = await Promise.all([
      postStaffBooking({ hikerId: 1, slotId: 3, partySize: 2 }),
      postBooking({ slotId: 3, partySize: 2 }, 2),
    ]);
    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409,
    ]);
    const rows = await reservationRows();
    expect(rows).toHaveLength(1);
    expect(rows.reduce((total, row) => total + Number(row.partySize), 0)).toBe(
      2,
    );
  });

  it("500: does not expose unexpected server errors", async () => {
    const bookingModule = await import("../../../src/booking/booking.ts");
    const spy = vi
      .spyOn(bookingModule, "createBooking")
      .mockRejectedValueOnce(new Error("DB unavailable"));
    try {
      const response = await postStaffBooking({
        hikerId: 1,
        slotId: 1,
        partySize: 2,
      });
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Internal server error" });
    } finally {
      spy.mockRestore();
    }
  });
});

// MH-78: extra integration tests for MH-05 (allergens & party requirements).
// They cover what the MH-74 block above does not: the allergen list endpoint,
// edge cases of the request body, rollback on a partly invalid list, and the
// requirements text that goes into the confirmation email.
describe("MH-78: allergens integration (MH-05)", () => {
  async function allergenLinks() {
    return testDb.select().from(reservationAllergensTable);
  }

  describe("GET /api/allergens", () => {
    it("200: returns every allergen with id and name, no login needed", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/allergens",
      });

      expect(response.statusCode).toBe(200);
      const list = response.json();
      expect(list).toHaveLength(8);
      expect(list).toEqual(
        expect.arrayContaining([
          { id: 1, name: "Milk" },
          { id: 3, name: "Peanuts" },
          { id: 8, name: "Shellfish" },
        ]),
      );
    });
  });

  describe("authentication and availability integration edge cases", () => {
    it("serves the health endpoint", async () => {
      const response = await app.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ hello: "world" });
    });

    it("registers a new hiker and rejects an existing email", async () => {
      const body = {
        email: "new-hiker@example.com",
        password: "a-secure-password",
        name: "New",
        surname: "Hiker",
      };

      const registered = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: body,
      });
      expect(registered.statusCode).toBe(201);
      expect(registered.json()).toMatchObject({
        email: body.email,
        name: body.name,
        surname: body.surname,
        type: "HIKER",
      });

      const duplicate = await app.inject({
        method: "POST",
        url: "/api/v1/auth/register",
        payload: body,
      });
      expect(duplicate.statusCode).toBe(409);
    });

    it.each([
      ["unknown email", "unknown@example.com", TEST_PASSWORD],
      ["incorrect password", emails[1], "incorrect-password"],
    ])("rejects login with %s", async (_description, email, password) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email, password },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ message: "Invalid email or password" });
    });

    it("returns the authenticated user from /me, then rejects a stale session", async () => {
      const cookie = await cookieFor(1);
      const authenticated = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { cookie },
      });
      expect(authenticated.statusCode).toBe(200);
      expect(authenticated.json()).toMatchObject({ id: 1, email: emails[1] });

      await client.execute("DELETE FROM users WHERE id = 1");
      const staleSession = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: { cookie },
      });
      expect(staleSession.statusCode).toBe(401);
      expect(staleSession.json()).toEqual({ message: "Not authenticated" });
    });

    it("logs out and invalidates the session cookie", async () => {
      const cookie = await cookieFor(1);
      const logout = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: { cookie },
      });
      expect(logout.statusCode).toBe(200);
      expect(logout.json()).toEqual({ message: "Logged out successfully" });
      const clearedCookie = logout.headers["set-cookie"];
      const cookieHeader = (
        Array.isArray(clearedCookie) ? clearedCookie[0] : clearedCookie
      )?.split(";")[0];

      const me = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      });
      expect(me.statusCode).toBe(401);
    });

    it.each([
      ["malformed date", "not-a-date"],
      ["impossible date", "2026-02-30"],
    ])("rejects availability for a %s", async (_description, date) => {
      const response = await app.inject({
        method: "GET",
        url: `/api/availability?date=${date}`,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Invalid query parameters",
      });
    });

    it("filters availability to one configured slot and returns 404 for an unknown slot", async () => {
      const selected = await app.inject({
        method: "GET",
        url: `/api/availability?date=${futureDate}&partySize=2&slotId=1`,
      });
      expect(selected.statusCode).toBe(200);
      expect(selected.json().slots).toHaveLength(1);
      expect(selected.json().slots[0].slotId).toBe(1);

      const missing = await app.inject({
        method: "GET",
        url: `/api/availability?date=${futureDate}&slotId=999`,
      });
      expect(missing.statusCode).toBe(404);
    });

    it("returns an empty availability list when the date has no configured slots", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/availability?date=2099-01-01",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        date: "2099-01-01",
        partySize: 1,
        slots: [],
      });
    });

    it("returns a logged internal error when listing bookings fails", async () => {
      const bookingModule =
        await import("../../../src/booking/list-bookings.ts");
      const spy = vi
        .spyOn(bookingModule, "listBookingsForUser")
        .mockRejectedValueOnce(new Error("Database disconnected"));
      try {
        const response = await app.inject({
          method: "GET",
          url: "/api/bookings/mine",
          headers: { cookie: await cookieFor(1) },
        });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ error: "Internal server error" });
      } finally {
        spy.mockRestore();
      }
    });

    it("keeps a successful booking when preparing its confirmation email fails", async () => {
      const rules = await import("../../../src/booking/booking-rules.ts");
      const spy = vi
        .spyOn(rules, "hutSlotStartMs")
        .mockImplementationOnce(() => {
          throw new Error("Invalid email date");
        });
      try {
        const response = await postBooking({ slotId: 1, partySize: 2 });
        expect(response.statusCode).toBe(201);
        expect(await reservationRows()).toHaveLength(1);
      } finally {
        spy.mockRestore();
      }
    });

    it("keeps a successful booking when sending its confirmation email rejects", async () => {
      const confirmation =
        await import("../../../src/booking/booking.notification.ts");
      const spy = vi
        .spyOn(confirmation, "sendBookingConfirmation")
        .mockRejectedValueOnce(new Error("SMTP unavailable"));
      try {
        const response = await postBooking({ slotId: 1, partySize: 2 });
        expect(response.statusCode).toBe(201);
        await new Promise((resolve) => setImmediate(resolve));
      } finally {
        spy.mockRestore();
      }
    });

    it("uses the slot ID and hiker name fallbacks when booking data omits them", async () => {
      await client.execute(
        "UPDATE users SET name = '', surname = '' WHERE id = 1",
      );
      const bookingModule = await import("../../../src/booking/booking.ts");
      const createSpy = vi
        .spyOn(bookingModule, "createBooking")
        .mockResolvedValueOnce({
          status: "PLACED",
          userId: 1,
          slotId: 1,
          date: futureDate,
          from: "12:00",
          to: "13:00",
          partySize: 2,
          description: null,
          allergenIds: [],
          allergens: [],
          reservations: [],
        });
      const confirmation =
        await import("../../../src/booking/booking.notification.ts");
      const emailSpy = vi
        .spyOn(confirmation, "sendBookingConfirmation")
        .mockResolvedValueOnce(true);

      try {
        const response = await postBooking({ slotId: 1, partySize: 2 });
        expect(response.statusCode).toBe(201);
        expect(emailSpy).toHaveBeenCalledWith(
          expect.anything(),
          emails[1],
          expect.objectContaining({
            reference: "MH-1",
            hikerName: "",
          }),
        );
      } finally {
        createSpy.mockRestore();
        emailSpy.mockRestore();
      }
    });

    it("deduplicates allergens associated with separate reservation rows", async () => {
      const response = await postBooking({
        slotId: 2,
        partySize: 10,
        allergenIds: [1, 2],
      });
      expect(response.statusCode).toBe(201);

      const mine = await app.inject({
        method: "GET",
        url: "/api/bookings/mine",
        headers: { cookie: await cookieFor(1) },
      });
      expect(mine.statusCode).toBe(200);
      expect(mine.json()[0].allergens).toEqual([
        { id: 1, name: "Milk" },
        { id: 2, name: "Eggs" },
      ]);
    });
  });

  describe("POST /api/bookings with requirements", () => {
    it("201: an empty allergenIds array saves no allergen links", async () => {
      const response = await postBooking({
        slotId: 1,
        partySize: 2,
        allergenIds: [],
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().allergens).toEqual([]);
      expect(await reservationRows()).toHaveLength(1);
      expect(await allergenLinks()).toHaveLength(0);
    });

    it("400: one unknown ID in the list rejects the whole booking and saves nothing", async () => {
      const response = await postBooking({
        slotId: 1,
        partySize: 2,
        allergenIds: [1, 9999],
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "One or more allergen IDs are invalid",
      });
      expect(await reservationRows()).toHaveLength(0);
      expect(await allergenLinks()).toHaveLength(0);
    });

    it("201: accepts a description of exactly 1000 characters", async () => {
      const description = "a".repeat(1000);
      const response = await postBooking({
        slotId: 1,
        partySize: 2,
        description,
      });

      expect(response.statusCode).toBe(201);
      expect((await reservationRows())[0].description).toBe(description);
    });

    it.each([
      [
        "description longer than 1000 characters",
        { description: "a".repeat(1001) },
      ],
      ["allergen IDs sent as strings", { allergenIds: ["1"] }],
      ["allergenIds that is not an array", { allergenIds: 1 }],
      ["zero as allergen ID", { allergenIds: [0] }],
      ["description that is not a string", { description: 42 }],
    ])("400: rejects %s", async (_name, extra) => {
      const response = await postBooking({ slotId: 1, partySize: 2, ...extra });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("Invalid request body");
      expect(await reservationRows()).toHaveLength(0);
      expect(await allergenLinks()).toHaveLength(0);
    });

    it("201: description wins when both description and legacy requirements are sent", async () => {
      const response = await postBooking({
        slotId: 1,
        partySize: 2,
        description: "New field",
        requirements: "Old field",
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().description).toBe("New field");
      expect((await reservationRows())[0].description).toBe("New field");
    });

    it("links allergens only to the reservation rows of that booking", async () => {
      expect(
        (await postBooking({ slotId: 1, partySize: 2, allergenIds: [7] }, 1))
          .statusCode,
      ).toBe(201);
      expect(
        (await postBooking({ slotId: 1, partySize: 2 }, 2)).statusCode,
      ).toBe(201);

      const rows = await reservationRows();
      const hikerOneRow = rows.find((r) => Number(r.userId) === 1)!;
      const links = await allergenLinks();
      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        reservationId: hikerOneRow.id,
        allergenId: 7,
      });
    });
  });

  describe("GET /api/bookings/mine", () => {
    it("200: another hiker does not see the first hiker's requirements", async () => {
      await postBooking(
        { slotId: 1, partySize: 2, allergenIds: [1], description: "No dairy" },
        1,
      );
      await postBooking({ slotId: 2, partySize: 2 }, 2);

      const response = await app.inject({
        method: "GET",
        url: "/api/bookings/mine",
        headers: { cookie: await cookieFor(2) },
      });

      expect(response.statusCode).toBe(200);
      const list = response.json();
      expect(list).toHaveLength(1);
      expect(list[0].slotId).toBe(2);
      expect(list[0].allergens).toEqual([]);
      expect(list[0].description).not.toBe("No dairy");
    });
  });

  describe("confirmation email", () => {
    it.each([
      [
        "allergens and description",
        { allergenIds: [1, 3], description: "Table near the window" },
        "Allergens: Milk, Peanuts. Details: Table near the window",
      ],
      ["only allergens", { allergenIds: [2] }, "Allergens: Eggs"],
      ["only description", { description: "Birthday cake" }, "Birthday cake"],
      ["no requirements", {}, undefined],
    ])(
      "passes the right requirements text for %s",
      async (_name, extra, expected) => {
        const confirmationModule =
          await import("../../../src/booking/booking.notification.ts");
        const sendSpy = vi.spyOn(confirmationModule, "sendBookingConfirmation");
        try {
          const response = await postBooking({
            slotId: 1,
            partySize: 2,
            ...extra,
          });

          expect(response.statusCode).toBe(201);
          expect(sendSpy).toHaveBeenCalledWith(
            expect.anything(),
            emails[1],
            expect.objectContaining({ requirements: expected }),
          );
        } finally {
          sendSpy.mockRestore();
        }
      },
    );
  });
});
