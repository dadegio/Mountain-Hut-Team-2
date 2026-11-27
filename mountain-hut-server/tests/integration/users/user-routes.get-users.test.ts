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
import { usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __userTestClient: client, __userTestCleanup: cleanup };
});

const {
  db: testDb,
  __userTestClient: client,
  __userTestCleanup: cleanup,
} = (await import("../../../src/db/database.ts")) as unknown as {
  db: (typeof import("../../../src/db/database.ts"))["db"];
  __userTestClient: Client;
  __userTestCleanup: () => void;
};
const { buildApp } = await import("../../../src/server.ts");

const app = buildApp({ logger: false });

const TEST_PASSWORD = "Password123!";
let passwordHash: string;
let employeeCookie = "";
let hikerCookie = "";

const LUCA_USER = {
  email: "luca.neri@example.com",
  name: "Luca",
  surname: "Neri",
  phoneNumber: "+393335554433",
  type: "EMPLOYEE" as const,
};

async function seedUsers() {
  await resetTestDatabase(client);

  await testDb.insert(usersTable).values([
    {
      ...LUCA_USER,
      passwordHash,
    },
    {
      email: "staff@hut.test",
      passwordHash,
      name: "Staff",
      surname: "Member",
      phoneNumber: "+393330001111",
      type: "EMPLOYEE",
    },
    {
      email: "hiker@hut.test",
      passwordHash,
      name: "Hiker",
      surname: "One",
      phoneNumber: "+393332223333",
      type: "HIKER",
    },
  ]);
}

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password: TEST_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const header = res.headers["set-cookie"];
  const cookie = (Array.isArray(header) ? header : [header])
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.split(";")[0])
    .join("; ");
  expect(cookie).not.toBe("");
  return cookie;
}

beforeAll(async () => {
  passwordHash = await argon2.hash(TEST_PASSWORD);
  await app.ready();
});

beforeEach(async () => {
  await seedUsers();
  employeeCookie = await login("staff@hut.test");
  hikerCookie = await login("hiker@hut.test");
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("GET /api/v1/users integration tests", () => {
  describe("Authentication & Authorization", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=Luca",
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ message: "Authentication required" });
    });

    it("returns 403 Forbidden when requested by a HIKER", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=Luca",
        headers: { cookie: hikerCookie },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json()).toEqual({ message: "Insufficient permissions" });
    });
  });

  describe("Successful User Retrieval (200 OK)", () => {
    it("fetches user by name only (get-existing-user-name-only.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=Luca",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });

    it("fetches user by surname only (get-existing-user-surname-only.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?surname=Neri",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });

    it("fetches user by name and surname (get-existing-user-name-surname.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=Luca&surname=Neri",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });

    it("fetches user with uncapitalized name and surname (get-existing-name-surname-uncapitalized.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=luca&surname=neri",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });

    it("fetches user by email (get-existing-user-email.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?email=luca.neri@example.com",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBe(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });

    it("fetches user by phone number (get-existing-user-phone-number.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?phoneNumber=%2B393335554433",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBe(1);
      expect(data[0].email).toBe("luca.neri@example.com");
      expect(data[0].name).toBe("Luca");
      expect(data[0].surname).toBe("Neri");
    });
  });

  describe("Not Found Handling (404 Not Found)", () => {
    it("returns 404 for non-existent user (get-nonexistent.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=asdf",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ message: "User Not Found" });
    });

    it("returns 404 for empty / whitespace name (get-existing-user-empty-name.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?name=%20",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 for empty / whitespace surname (get-existing-user-empty-surname.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?surname=%20",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 for empty / whitespace email (get-existing-user-empty-email.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?email=%20",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 404 for empty / whitespace phone number (get-existing-user-empty-phone-number.hurl)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/users?phoneNumber=%20",
        headers: { cookie: employeeCookie },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
