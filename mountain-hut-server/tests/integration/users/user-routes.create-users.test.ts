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
import { StatusCodes } from "http-status-codes";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import {
  usersTable,
  passwordResetTokensTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";
import { emailSender } from "../../../src/notifications/sender.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __userTestClient: client, __userTestCleanup: cleanup };
});

vi.spyOn(emailSender, "send").mockResolvedValue(undefined);

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

async function seedUsers() {
  await resetTestDatabase(client);

  await testDb.insert(usersTable).values([
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
  vi.clearAllMocks();
  await seedUsers();
  employeeCookie = await login("staff@hut.test");
  hikerCookie = await login("hiker@hut.test");
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("POST /api/v1/users integration tests (create users)", () => {
  describe("Authentication & Authorization", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        payload: {
          type: "TEMPORARY",
          name: "Paolo",
          surname: "Bianchi",
          email: "paolo.temp@example.com",
          phoneNumber: "+39333444555",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(res.json()).toEqual({ error: "Authentication required" });
    });

    it("returns 403 Forbidden when requested by a HIKER", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: { cookie: hikerCookie },
        payload: {
          type: "TEMPORARY",
          name: "Paolo",
          surname: "Bianchi",
          email: "paolo.temp@example.com",
          phoneNumber: "+39333444555",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(res.json()).toEqual({
        error: "Insufficient permissions",
      });
    });
  });

  describe("Temporary Accounts (created by employee)", () => {
    it("creates a temporary account with an automatically generated password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: { cookie: employeeCookie },
        payload: {
          email: "paolo.temp@example.com",
          name: "Paolo",
          surname: "Bianchi",
          phoneNumber: "+39333444555",
          type: "TEMPORARY",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.CREATED);

      const body = res.json();
      expect(body.id).toBeTypeOf("number");
      expect(body.type).toBe("TEMPORARY");
      expect(body.email).toBe("paolo.temp@example.com");
      expect(body.name).toBe("Paolo");
      expect(body.surname).toBe("Bianchi");
      expect(body.phoneNumber).toBe("+39333444555");
      expect(body.temporaryPassword).toMatch(/^PaoloBianchi\d{3}$/);

      // Verify user in database
      const [savedUser] = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, body.id));
      expect(savedUser).toBeDefined();
      expect(savedUser.email).toBe("paolo.temp@example.com");
      expect(savedUser.type).toBe("TEMPORARY");
      expect(savedUser.passwordHash).not.toBeNull();
      const passwordValid = await argon2.verify(
        savedUser.passwordHash!,
        body.temporaryPassword,
      );
      expect(passwordValid).toBe(true);

      // Verify password reset token was created for user
      const [tokenRow] = await testDb
        .select()
        .from(passwordResetTokensTable)
        .where(eq(passwordResetTokensTable.userId, body.id));
      expect(tokenRow).toBeDefined();

      // Verify setup email with temporary password and reset link was sent
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "paolo.temp@example.com",
          subject: "Mountain Hut — Your temporary password and setup link",
          text: expect.stringContaining(body.temporaryPassword),
        }),
      );
    });

    it("returns 409 Conflict if email already exists", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: { cookie: employeeCookie },
        payload: {
          email: "staff@hut.test",
          name: "Duplicate",
          surname: "Staff",
          phoneNumber: "+39333999999",
          type: "TEMPORARY",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.CONFLICT);
      expect(res.json()).toEqual({
        error: "An account with this email already exists",
      });
    });
  });

  describe("Throwaway Accounts (name and optional phone number)", () => {
    it("creates a throwaway account with only name and valid user_id", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: { cookie: employeeCookie },
        payload: {
          type: "THROWAWAY",
          name: "Quick Booking Guest",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.CREATED);
      const body = res.json();
      expect(body.id).toBeTypeOf("number");
      expect(body.email).toBeNull();
      expect(body.name).toBe("Quick Booking Guest");
      expect(body.surname).toBeNull();
      expect(body.phoneNumber).toBeNull();
      expect(body.type).toBe("THROWAWAY");

      // Verify user in database
      const [savedUser] = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, body.id));
      expect(savedUser).toBeDefined();
      expect(savedUser.email).toBeNull();
      expect(savedUser.passwordHash).toBeNull();
      expect(savedUser.type).toBe("THROWAWAY");
    });

    it("creates a throwaway account with name and phone number", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/users",
        headers: { cookie: employeeCookie },
        payload: {
          type: "THROWAWAY",
          name: "John",
          phoneNumber: "+39333888777",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.CREATED);
      const body = res.json();
      expect(body.id).toBeTypeOf("number");
      expect(body.email).toBeNull();
      expect(body.name).toBe("John");
      expect(body.surname).toBeNull();
      expect(body.phoneNumber).toBe("+39333888777");
      expect(body.type).toBe("THROWAWAY");

      // Verify user in database
      const [savedUser] = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, body.id));
      expect(savedUser).toBeDefined();
      expect(savedUser.email).toBeNull();
      expect(savedUser.phoneNumber).toBe("+39333888777");
      expect(savedUser.passwordHash).toBeNull();
      expect(savedUser.type).toBe("THROWAWAY");
    });
  });
});
