import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import argon2 from "argon2";
import type { Client } from "@libsql/client";
import { count, eq } from "drizzle-orm";
import {
  reservationsTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";
import { addUtcDays } from "../../../src/slots/week-copy-plan.ts";

// Real Fastify routes + real isolated SQLite DB: never touches local.db.
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __copyWeekClient: client, __copyWeekCleanup: cleanup };
});

const { db } = await import("../../../src/db/database.ts");
const { __copyWeekClient: client, __copyWeekCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __copyWeekClient: Client;
    __copyWeekCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

function nextSafeMonday(): string {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const untilNextMonday = (8 - day.getUTCDay()) % 7 || 7;
  // Put the template at least a week ahead for repeatability in any timezone.
  day.setUTCDate(day.getUTCDate() + untilNextMonday + 7);
  return day.toISOString().slice(0, 10);
}

const sourceWeekStart = nextSafeMonday();
const targetWeekStart = addUtcDays(sourceWeekStart, 7);
const thirdWeekStart = addUtcDays(sourceWeekStart, 14);
const password = "copy-week-test-passphrase";
let passwordHash = "";
let employeeCookie = "";
let managerCookie = "";
let hikerCookie = "";

async function createUsers() {
  for (const [email, role] of [
    ["employee@copy.test", "EMPLOYEE"],
    ["manager@copy.test", "MANAGER"],
    ["hiker@copy.test", "HIKER"],
  ]) {
    await client.execute({
      sql: "INSERT INTO users (email, password_hash, name, surname, type) VALUES (?, ?, 'Test', 'User', ?)",
      args: [email, passwordHash, role],
    });
  }
}

async function login(email: string): Promise<string> {
  const response = await app.inject({
    method: "POST", url: "/api/v1/auth/login", payload: { email, password },
  });
  expect(response.statusCode).toBe(200);
  const raw = response.headers["set-cookie"];
  return [raw]
    .flat()
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.split(";")[0])
    .join("; ");
}

function copyWeek(
  payload: Record<string, unknown> = {},
  cookie = employeeCookie,
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/slots/copy-week",
    payload: { sourceWeekStart, targetWeekStart, weeks: 1, ...payload },
    headers: cookie ? { cookie } : {},
  });
}

async function seedSourceWeek() {
  // Monday has two tables, Wednesday no tables, Sunday a third table.
  const slots = await db.insert(timeSlotTable).values([
    { date: sourceWeekStart, from: "12:00", to: "13:30" },
    { date: addUtcDays(sourceWeekStart, 2), from: "19:00", to: "21:00" },
    { date: addUtcDays(sourceWeekStart, 6), from: "12:00", to: "14:00" },
  ]).returning();
  await db.insert(tableAvailabilityTable).values([
    { slotId: slots[0].id, tableId: 1 },
    { slotId: slots[0].id, tableId: 2 },
    { slotId: slots[2].id, tableId: 3 },
  ]);
  return slots;
}

async function countRows(table: "slots" | "tables" | "links" | "reservations") {
  if (table === "slots") return (await db.select({ n: count() }).from(timeSlotTable))[0].n;
  if (table === "tables") return (await db.select({ n: count() }).from(tablesTable))[0].n;
  if (table === "links") return (await db.select({ n: count() }).from(tableAvailabilityTable))[0].n;
  return (await db.select({ n: count() }).from(reservationsTable))[0].n;
}

beforeAll(async () => {
  await app.ready();
  passwordHash = await argon2.hash(password);
  await createUsers();
  employeeCookie = await login("employee@copy.test");
  managerCookie = await login("manager@copy.test");
  hikerCookie = await login("hiker@copy.test");
});

beforeEach(async () => {
  await resetTestDatabase(client);
  await createUsers();
  await db.insert(tablesTable).values([
    { code: "T1", seats: 2 },
    { code: "T2", seats: 4 },
    { code: "T3", seats: 6 },
  ]);
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-125 / MH-144 POST /api/v1/slots/copy-week", () => {
  it("copies all weekdays and their table links without duplicating table entities or bookings", async () => {
    const source = await seedSourceWeek();
    await db.insert(reservationsTable).values({
      userId: 3, slotId: source[0].id, tableId: 1, partySize: 1,
    });

    const response = await copyWeek();
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      sourceWeekStart, targetWeekStart, weeks: 1, copiedSlots: 3,
    });
    expect(await countRows("slots")).toBe(6);
    expect(await countRows("links")).toBe(6);
    expect(await countRows("tables")).toBe(3);
    expect(await countRows("reservations")).toBe(1);

    const copied = await db.select().from(timeSlotTable);
    const targetSlots = copied.filter((slot) => slot.date >= targetWeekStart);
    expect(targetSlots.map((slot) => [slot.date, slot.from, slot.to]).sort()).toEqual([
      [targetWeekStart, "12:00", "13:30"],
      [addUtcDays(targetWeekStart, 2), "19:00", "21:00"],
      [addUtcDays(targetWeekStart, 6), "12:00", "14:00"],
    ].sort());
    const monday = targetSlots.find((slot) => slot.date === targetWeekStart)!;
    const wednesday = targetSlots.find((slot) => slot.date === addUtcDays(targetWeekStart, 2))!;
    const sunday = targetSlots.find((slot) => slot.date === addUtcDays(targetWeekStart, 6))!;
    const mondayLinks = await db.select().from(tableAvailabilityTable)
      .where(eq(tableAvailabilityTable.slotId, monday.id));
    expect(mondayLinks.map((row) => row.tableId).sort()).toEqual([1, 2]);
    expect(await db.select().from(tableAvailabilityTable)
      .where(eq(tableAvailabilityTable.slotId, wednesday.id))).toHaveLength(0);
    const sundayLinks = await db.select().from(tableAvailabilityTable)
      .where(eq(tableAvailabilityTable.slotId, sunday.id));
    expect(sundayLinks.map((row) => row.tableId)).toEqual([3]);
  });

  it("repeats the source week into two destination weeks", async () => {
    await seedSourceWeek();
    const response = await copyWeek({ weeks: 2 });
    expect(response.statusCode).toBe(201);
    expect(response.json().copiedSlots).toBe(6);
    expect(await countRows("slots")).toBe(9);
    const destinations = await db.select().from(timeSlotTable);
    expect(destinations.filter((s) => s.date >= thirdWeekStart)).toHaveLength(3);
  });

  it("defaults to copying one week when weeks is omitted", async () => {
    await seedSourceWeek();
    const response = await copyWeek({ weeks: undefined });
    expect(response.statusCode).toBe(201);
    expect(response.json().weeks).toBe(1);
    expect(response.json().copiedSlots).toBe(3);
  });

  it("accepts a manager and denies hikers and anonymous callers", async () => {
    await seedSourceWeek();
    expect((await copyWeek({}, "")).statusCode).toBe(401);
    expect((await copyWeek({}, hikerCookie)).statusCode).toBe(403);
    expect(await countRows("slots")).toBe(3);
    expect((await copyWeek({}, managerCookie)).statusCode).toBe(201);
  });

  it.each([
    [{ sourceWeekStart: addUtcDays(sourceWeekStart, 1) }, 400],
    [{ targetWeekStart: addUtcDays(targetWeekStart, 1) }, 400],
    [{ targetWeekStart: "2020-01-06" }, 400],
    [{ targetWeekStart: sourceWeekStart }, 400],
    [{ sourceWeekStart: thirdWeekStart, weeks: 2 }, 400],
    [{ weeks: 0 }, 400],
    [{ weeks: 13 }, 400],
    [{ weeks: 1.5 }, 400],
    [{ extra: true }, 400],
    [{ sourceWeekStart: "not-a-date" }, 400],
  ])("rejects invalid input %j", async (payload, status) => {
    await seedSourceWeek();
    const response = await copyWeek(payload);
    expect(response.statusCode).toBe(status);
    expect(await countRows("slots")).toBe(3);
  });

  it("returns 404 and creates nothing when the source week is empty", async () => {
    const response = await copyWeek();
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatch(/source week/i);
    expect(await countRows("slots")).toBe(0);
  });

  it("returns 409 and does not copy any week when a later target week conflicts", async () => {
    await seedSourceWeek();
    await db.insert(timeSlotTable).values({
      date: addUtcDays(thirdWeekStart, 2), from: "20:00", to: "22:00",
    });
    const response = await copyWeek({ weeks: 2 });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatch(/overlap/i);
    expect(await countRows("slots")).toBe(4);
    expect(await countRows("links")).toBe(3);
  });

  it("keeps non-overlapping existing target slots intact", async () => {
    await seedSourceWeek();
    await db.insert(timeSlotTable).values({
      date: targetWeekStart, from: "15:00", to: "16:00",
    });
    const response = await copyWeek();
    expect(response.statusCode).toBe(201);
    expect(await countRows("slots")).toBe(7);
  });

  it("rolls back previously inserted copies when SQLite fails during a later insert", async () => {
    await seedSourceWeek();
    const failingDay = addUtcDays(targetWeekStart, 2);
    // Trigger simulates a DB write failure (not a preflight validation error).
    await client.execute(`CREATE TRIGGER fail_copy_on_wednesday
      BEFORE INSERT ON time_slots
      WHEN NEW.date = '${failingDay}'
      BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;`);
    try {
      const response = await copyWeek();
      expect(response.statusCode).toBe(500);
      expect(await countRows("slots")).toBe(3);
      expect(await countRows("links")).toBe(3);
    } finally {
      await client.execute("DROP TRIGGER IF EXISTS fail_copy_on_wednesday");
    }
  });
});
