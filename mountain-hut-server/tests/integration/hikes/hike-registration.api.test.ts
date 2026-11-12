import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { count } from "drizzle-orm";
import { hikesTable, usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __hikeTestClient: client, __hikeTestCleanup: cleanup };
});

const { db: testDb, __hikeTestClient: client, __hikeTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    db: typeof import("../../../src/db/database.ts")["db"];
    __hikeTestClient: Client;
    __hikeTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });
const PASSWORD = "hike-test-password";
let passwordHash: string;
let hikerCookie = "";
let otherCookie = "";
let staffCookie = "";
let managerCookie = "";

function payload() {
  const departure = new Date(Date.now() + 10 * 86_400_000);
  const expectedReturn = new Date(departure.getTime() + 8 * 3_600_000);
  return {
    departureAt: departure.toISOString(),
    expectedReturnAt: expectedReturn.toISOString(),
    routeDescription: "Via the north valley and the marked summit path",
    emergencyContactPhone: "+393331234567",
  };
}

function request(method: "GET" | "POST", url: string, cookie = "", body?: object) {
  return app.inject({
    method, url,
    headers: cookie ? { cookie } : {},
    ...(body ? { payload: body } : {}),
  });
}

async function login(email: string): Promise<string> {
  const result = await request("POST", "/api/v1/auth/login", "", {
    email, password: PASSWORD,
  });
  expect(result.statusCode).toBe(200);
  return [result.headers["set-cookie"]]
    .flat().filter((value): value is string => typeof value === "string")
    .map((value) => value.split(";")[0]).join("; ");
}

beforeAll(async () => {
  await app.ready();
  passwordHash = await argon2.hash(PASSWORD);
});

beforeEach(async () => {
  await resetTestDatabase(client);
  await testDb.insert(usersTable).values([
    { email: "hiker@example.com", passwordHash, name: "First", surname: "Hiker", type: "HIKER", phoneNumber: "+39000001" },
    { email: "other@example.com", passwordHash, name: "Other", surname: "Hiker", type: "HIKER", phoneNumber: "+39000002" },
    { email: "staff@example.com", passwordHash, name: "Hut", surname: "Employee", type: "EMPLOYEE" },
    { email: "manager@example.com", passwordHash, name: "Hut", surname: "Manager", type: "MANAGER" },
  ]);
  hikerCookie = await login("hiker@example.com");
  otherCookie = await login("other@example.com");
  staffCookie = await login("staff@example.com");
  managerCookie = await login("manager@example.com");
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-139 hike API", () => {
  it("registers a hike belonging to the logged-in hiker", async () => {
    const res = await request("POST", "/api/v1/hikes", hikerCookie, payload());
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      id: expect.any(Number), userId: 1,
      routeDescription: payload().routeDescription,
      emergencyContactPhone: "+393331234567",
    });
    expect((await testDb.select().from(hikesTable))).toHaveLength(1);
  });

  it("lists only the current hiker's hikes", async () => {
    expect((await request("POST", "/api/v1/hikes", hikerCookie, payload())).statusCode).toBe(201);
    expect((await request("POST", "/api/v1/hikes", otherCookie, payload())).statusCode).toBe(201);
    const mine = await request("GET", "/api/v1/hikes/mine", hikerCookie);
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toHaveLength(1);
    expect(mine.json()[0].userId).toBe(1);
    const others = await request("GET", "/api/v1/hikes/mine", otherCookie);
    expect(others.json()).toHaveLength(1);
    expect(others.json()[0].userId).toBe(2);
  });

  it("allows staff and managers to read hikes with contact information", async () => {
    await request("POST", "/api/v1/hikes", hikerCookie, payload());
    for (const cookie of [staffCookie, managerCookie]) {
      const res = await request("GET", "/api/v1/hikes", cookie);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].hiker).toEqual({
        name: "First", surname: "Hiker", phoneNumber: "+39000001",
      });
      expect(JSON.stringify(res.json())).not.toContain("passwordHash");
    }
  });

  it("rejects guests and staff registering hikes", async () => {
    expect((await request("POST", "/api/v1/hikes", "", payload())).statusCode).toBe(401);
    expect((await request("POST", "/api/v1/hikes", staffCookie, payload())).statusCode).toBe(403);
    expect((await request("POST", "/api/v1/hikes", managerCookie, payload())).statusCode).toBe(403);
    expect((await testDb.select({ n: count() }).from(hikesTable))[0].n).toBe(0);
  });

  it("rejects unauthorized reads", async () => {
    expect((await request("GET", "/api/v1/hikes/mine")).statusCode).toBe(401);
    expect((await request("GET", "/api/v1/hikes/mine", staffCookie)).statusCode).toBe(403);
    expect((await request("GET", "/api/v1/hikes")).statusCode).toBe(401);
    expect((await request("GET", "/api/v1/hikes", hikerCookie)).statusCode).toBe(403);
  });

  it("does not save malformed, late, or impersonated hikes", async () => {
    const base = payload();
    const invalidBodies = [
      { ...base, departureAt: new Date(Date.now() - 60_000).toISOString() },
      { ...base, expectedReturnAt: base.departureAt },
      { ...base, routeDescription: "" },
      { ...base, userId: 2 },
      { ...base, departureAt: "2026-12-15 09:00" },
    ];
    for (const data of invalidBodies) {
      const res = await request("POST", "/api/v1/hikes", hikerCookie, data);
      expect(res.statusCode).toBe(400);
    }
    expect((await testDb.select({ n: count() }).from(hikesTable))[0].n).toBe(0);
  });
});
