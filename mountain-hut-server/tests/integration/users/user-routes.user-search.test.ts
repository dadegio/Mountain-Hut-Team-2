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
import { eq } from "drizzle-orm";
import {
  usersTable,
  timeSlotTable,
  tablesTable,
  tableAvailabilityTable,
  reservationsTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

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

const TEST_PASSWORD = "mh75-user-search-password";
let passwordHash = "";

const emails: Record<number, string> = {
  1: "mario.rossi@example.test",
  2: "giulia.bianchi@example.test",
  3: "mario.verdi@example.test",
  4: "staff.employee@example.test",
  5: "admin.manager@example.test",
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

async function searchUsers(query: string, actingUserId: number | null = 4) {
  const cookie =
    actingUserId === null ? null : await sessionCookie(actingUserId);
  return app.inject({
    method: "GET",
    url: `/api/v1/users${query}`,
    ...(cookie ? { headers: { cookie } } : {}),
  });
}

async function resetFixture() {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    {
      id: 1,
      email: emails[1],
      passwordHash,
      name: "Mario",
      surname: "Rossi",
      phoneNumber: "+39333111222",
      type: "HIKER",
    },
    {
      id: 2,
      email: emails[2],
      passwordHash,
      name: "Giulia",
      surname: "Bianchi",
      phoneNumber: "+39333444555",
      type: "HIKER",
    },
    {
      id: 3,
      email: emails[3],
      passwordHash,
      name: "Mario",
      surname: "Verdi",
      phoneNumber: "+39333777888",
      type: "HIKER",
    },
    {
      id: 4,
      email: emails[4],
      passwordHash,
      name: "Luca",
      surname: "Staff",
      phoneNumber: "+39333000111",
      type: "EMPLOYEE",
    },
    {
      id: 5,
      email: emails[5],
      passwordHash,
      name: "Anna",
      surname: "Manager",
      phoneNumber: "+39333000222",
      type: "MANAGER",
    },
  ]);

  // Setup sample slot and table for the end-to-end staff reservation flow
  const futureDate = romeDate(3);
  await testDb.insert(tablesTable).values([{ id: 1, code: "T1", seats: 4 }]);
  await testDb
    .insert(timeSlotTable)
    .values([{ id: 1, date: futureDate, from: "12:00", to: "14:00" }]);
  await testDb
    .insert(tableAvailabilityTable)
    .values([{ slotId: 1, tableId: 1 }]);
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

describe("MH-75: GET /api/v1/users — Registered Users API Integration", () => {
  describe("Authentication & Authorization", () => {
    it("401: rejects unauthenticated requests", async () => {
      const res = await searchUsers("?name=Mario", null);
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/Authentication required/i);
    });

    it("403: rejects requests made by a regular HIKER", async () => {
      const res = await searchUsers("?name=Mario", 1); // Mario (HIKER)
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toMatch("Insufficient permissions");
    });

    it("200: allows access by an EMPLOYEE", async () => {
      const res = await searchUsers("?name=Mario", 4); // Luca (EMPLOYEE)
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });

    it("200: allows access by a MANAGER", async () => {
      const res = await searchUsers("?name=Mario", 5); // Anna (MANAGER)
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
    });
  });

  describe("Query by Email", () => {
    it("200: finds a registered hiker by exact email address", async () => {
      const res = await searchUsers(
        `?email=${encodeURIComponent("giulia.bianchi@example.test")}`,
      );
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 2,
        email: "giulia.bianchi@example.test",
        name: "Giulia",
        surname: "Bianchi",
        phoneNumber: "+39333444555",
        type: "HIKER",
      });
    });

    it("404: returns User Not Found when email does not exist", async () => {
      const res = await searchUsers("?email=unknown.user@example.test");
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("User Not Found");
    });
  });

  describe("Query by Phone Number", () => {
    it("200: finds a registered hiker by phone number", async () => {
      const res = await searchUsers(
        `?phoneNumber=${encodeURIComponent("+39333111222")}`,
      );
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 1,
        email: "mario.rossi@example.test",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+39333111222",
        type: "HIKER",
      });
    });

    it("404: returns User Not Found when phone number does not exist", async () => {
      const res = await searchUsers(
        `?phoneNumber=${encodeURIComponent("+39999999999")}`,
      );
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("User Not Found");
    });
  });

  describe("Query by Name and Surname", () => {
    it("200: finds multiple users matching the same first name", async () => {
      const res = await searchUsers("?name=Mario");
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(2);
      const surnames = data.map((u: { surname: string }) => u.surname).sort();
      expect(surnames).toEqual(["Rossi", "Verdi"]);
    });

    it("200: performs case-insensitive name matching", async () => {
      const lower = await searchUsers("?name=mario");
      expect(lower.statusCode).toBe(200);
      expect(lower.json()).toHaveLength(2);

      const upper = await searchUsers("?name=MARIO");
      expect(upper.statusCode).toBe(200);
      expect(upper.json()).toHaveLength(2);
    });

    it("200: finds a user by surname only", async () => {
      const res = await searchUsers("?surname=Bianchi");
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(2);
    });

    it("200: performs case-insensitive surname matching", async () => {
      const res = await searchUsers("?surname=bianchi");
      expect(res.statusCode).toBe(200);
      expect(res.json()[0].name).toBe("Giulia");
    });

    it("200: filters by both name and surname simultaneously", async () => {
      const res = await searchUsers("?name=mario&surname=verdi");
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: 3,
        name: "Mario",
        surname: "Verdi",
        email: "mario.verdi@example.test",
      });
    });

    it("404: returns User Not Found when name/surname combination does not match", async () => {
      const res = await searchUsers("?name=Mario&surname=Nonexistent");
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("User Not Found");
    });

    it("404: returns User Not Found when empty search query parameters are passed", async () => {
      const res = await searchUsers("");
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("User Not Found");
    });
  });

  describe("Security & Field Sanitization", () => {
    it("never exposes passwordHash in the user search response", async () => {
      const res = await searchUsers("?name=Mario");
      expect(res.statusCode).toBe(200);
      const data = res.json();
      for (const user of data) {
        expect(user).not.toHaveProperty("passwordHash");
        expect(user).not.toHaveProperty("password_hash");
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("surname");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("phoneNumber");
        expect(user).toHaveProperty("type");
      }
    });
  });

  describe("End-to-End Flow: MH-75 Search -> MH-07 Staff Reservation", () => {
    it("allows staff to search for a hiker by name and immediately book a table on their behalf", async () => {
      const staffCookie = await sessionCookie(4);

      // Step 1: Staff searches for hiker "Giulia"
      const searchRes = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=Giulia",
        headers: { cookie: staffCookie },
      });
      expect(searchRes.statusCode).toBe(200);
      const hikers = searchRes.json();
      expect(hikers).toHaveLength(1);
      const hikerId = hikers[0].id;
      expect(hikerId).toBe(2);

      // Step 2: Staff books slot 1 for Giulia (party size 2)
      const bookingRes = await app.inject({
        method: "POST",
        url: "/api/v1/staff/bookings",
        headers: { cookie: staffCookie },
        payload: {
          hikerId,
          slotId: 1,
          partySize: 2,
        },
      });
      expect(bookingRes.statusCode).toBe(201);
      const booking = bookingRes.json();
      expect(booking.userId).toBe(2);
      expect(booking.partySize).toBe(2);
      expect(booking.status).toBe("PLACED");

      // Step 3: Verify booking exists in database and is linked to Giulia
      const rows = await testDb
        .select()
        .from(reservationsTable)
        .where(eq(reservationsTable.userId, 2));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("PLACED");
      expect(rows[0].tableId).toBe(1);

      // Step 4: Verify Giulia can see the reservation in her own bookings
      const hikerCookie = await sessionCookie(2);
      const myBookingsRes = await app.inject({
        method: "GET",
        url: "/api/v1/bookings/mine",
        headers: { cookie: hikerCookie },
      });
      expect(myBookingsRes.statusCode).toBe(200);
      const myBookings = myBookingsRes.json();
      expect(myBookings).toHaveLength(1);
      expect(myBookings[0].id).toBe(rows[0].id);
      expect(myBookings[0].partySize).toBe(2);
    });
  });
});
