import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { todayString } from "./slot-rules.ts";
import { asc, count } from "drizzle-orm";
import { tablesTable, timeSlotTable, tableAvailabilityTable } from "../db/schema.ts";
import { resetTestDatabase } from "../test-support/test-database.ts";

/**
 * HTTP integration tests for the table and slot API (MH-34).
 *
 * Only the database connection is replaced, with a dedicated temporary SQLite
 * database: routes, validation and queries are the real ones, and local.db is
 * not touched.
 */
vi.mock("../db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../test-support/test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __integrationTestClient: client, __integrationTestCleanup: cleanup };
});

// Imported after vi.mock, so that the routes use the temporary SQLite database
const { db: testDb } = await import("../db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };
const { buildApp } = await import("../server.ts");
const app = buildApp({ logger: false });

const T1 = { id: 1, code: "T1", seats: 2 };
const T2 = { id: 2, code: "T2", seats: 4 };
const T3 = { id: 3, code: "T3", seats: 6 };

// Relative to today, so that the tests do not expire
function dayFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return todayString(d);
}

const DAY = dayFromToday(10);
const OTHER_DAY = dayFromToday(11);

function get(url: string) {
  return app.inject({ method: "GET", url });
}

function post(url: string, payload: Record<string, unknown>) {
  return app.inject({ method: "POST", url, payload });
}

function createSlot(overrides: Record<string, unknown> = {}) {
  return post("/api/slots", {
    date: DAY,
    from: "12:00",
    to: "13:00",
    tableIds: [1, 2],
    ...overrides,
  });
}

async function countRows(table: "tables" | "time_slots" | "table_availability") {
  switch (table) {
    case "tables": return (await testDb.select({ n: count() }).from(tablesTable))[0].n;
    case "time_slots": return (await testDb.select({ n: count() }).from(timeSlotTable))[0].n;
    case "table_availability": return (await testDb.select({ n: count() }).from(tableAvailabilityTable))[0].n;
  }
}

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetTestDatabase(client);
  await testDb.insert(tablesTable).values([T1, T2, T3]);
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("GET /api/tables", () => {
  it("lists all the tables, ordered by id", async () => {
    const res = await get("/api/tables");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([T1, T2, T3]);
  });

  it("returns an empty list when there are no tables", async () => {
    await testDb.delete(tablesTable);

    const res = await get("/api/tables");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

describe("POST /api/tables", () => {
  it("creates a table and returns it", async () => {
    const res = await post("/api/tables", { code: "T4", seats: 8 });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: expect.any(Number), code: "T4", seats: 8 });

    const list = await get("/api/tables");
    expect(list.json()).toContainEqual(res.json());
  });

  it("removes the spaces around the code", async () => {
    const res = await post("/api/tables", { code: "  T4  ", seats: 8 });

    expect(res.statusCode).toBe(201);
    expect(res.json().code).toBe("T4");
  });

  it("refuses a code that already exists and changes nothing", async () => {
    const res = await post("/api/tables", { code: "T1", seats: 10 });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "Table code T1 already exists" });

    const list = await get("/api/tables");
    expect(list.json()).toEqual([T1, T2, T3]);
  });

  it("treats the code as already existing after removing the spaces", async () => {
    const res = await post("/api/tables", { code: " T1 ", seats: 10 });

    expect(res.statusCode).toBe(409);
  });

  it.each([
    ["no code", { seats: 4 }, "code"],
    ["an empty code", { code: "", seats: 4 }, "code"],
    ["a code of only spaces", { code: "   ", seats: 4 }, "code"],
    ["a code over 20 characters", { code: "T".repeat(21), seats: 4 }, "code"],
    ["a code that is not text", { code: 7, seats: 4 }, "code"],
    ["no seats", { code: "T4" }, "seats"],
    ["0 seats", { code: "T4", seats: 0 }, "seats"],
    ["negative seats", { code: "T4", seats: -1 }, "seats"],
    ["decimal seats", { code: "T4", seats: 2.5 }, "seats"],
    ["seats as text", { code: "T4", seats: "4" }, "seats"],
  ])("refuses %s", async (_description, body, field) => {
    const res = await post("/api/tables", body);

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid request body");
    expect(res.json().details[0].path).toEqual([field]);
    expect(await countRows("tables")).toBe(3);
  });

  it("refuses unknown fields", async () => {
    const res = await post("/api/tables", { code: "T4", seats: 4, extra: true });

    expect(res.statusCode).toBe(400);
    expect(await countRows("tables")).toBe(3);
  });

  it("accepts a code of exactly 20 characters", async () => {
    const res = await post("/api/tables", { code: "T".repeat(20), seats: 4 });

    expect(res.statusCode).toBe(201);
  });
});

describe("POST /api/slots", () => {
  it("creates a slot and returns it with its tables and seats", async () => {
    const res = await createSlot();

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: expect.any(Number),
      date: DAY,
      from: "12:00",
      to: "13:00",
      totalSeats: 6,
      tables: [T1, T2],
    });
  });

  it("saves the slot and its tables in the database", async () => {
    const { id } = (await createSlot({ tableIds: [3, 1] })).json();

    const slots = await testDb.select().from(timeSlotTable);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: DAY, from: "12:00", to: "13:00" });

    const links = await testDb.select().from(tableAvailabilityTable)
      .orderBy(asc(tableAvailabilityTable.tableId));
    expect(links.map((row) => [row.slotId, row.tableId])).toEqual([
      [id, 1],
      [id, 3],
    ]);
  });

  it.each([
    ["an empty list", { tableIds: [] }],
    ["no list", { tableIds: undefined }],
  ])("allows a slot without tables (%s), with 0 seats", async (_description, body) => {
    const res = await createSlot(body);

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ totalSeats: 0, tables: [] });
    expect(await countRows("table_availability")).toBe(0);
  });

  describe("dates", () => {
    it("allows today", async () => {
      const res = await createSlot({ date: todayString() });

      expect(res.statusCode).toBe(201);
    });

    it("allows a date far in the future", async () => {
      const res = await createSlot({ date: dayFromToday(730) });

      expect(res.statusCode).toBe(201);
    });

    it("refuses a past date and saves nothing", async () => {
      const res = await createSlot({ date: dayFromToday(-1) });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "Cannot create a slot in the past" });
      expect(await countRows("time_slots")).toBe(0);
    });

    it.each([
      ["2026/12/10"],
      ["10-12-2026"],
      ["2026-1-5"],
      ["2027-02-30"],
      ["2027-13-01"],
      ["tomorrow"],
      [""],
      [20271210],
    ])("refuses the date %s", async (date) => {
      const res = await createSlot({ date });

      expect(res.statusCode).toBe(400);
      expect(res.json().details[0].path).toEqual(["date"]);
      expect(await countRows("time_slots")).toBe(0);
    });
  });

  describe("times", () => {
    it.each([
      ["start", "from", "9:00"],
      ["start", "from", "24:00"],
      ["start", "from", "12:60"],
      ["start", "from", "12:00:00"],
      ["start", "from", "noon"],
      ["end", "to", "9:00"],
      ["end", "to", "24:00"],
      ["end", "to", "12:60"],
    ])("refuses the %s time %s=%s", async (_description, field, value) => {
      const res = await createSlot({ [field]: value });

      expect(res.statusCode).toBe(400);
      expect(res.json().details.map((d: { path: string[] }) => d.path[0])).toContain(field);
      expect(await countRows("time_slots")).toBe(0);
    });

    it.each([
      ["ending before it starts", "14:00", "13:00"],
      ["ending when it starts", "13:00", "13:00"],
    ])("refuses a slot %s", async (_description, from, to) => {
      const res = await createSlot({ from, to });

      expect(res.statusCode).toBe(400);
      expect(res.json().details[0].message).toBe("'from' must be before 'to'");
      expect(await countRows("time_slots")).toBe(0);
    });

    it("accepts any duration, also outside meal hours", async () => {
      const res = await createSlot({ from: "00:00", to: "23:59" });

      expect(res.statusCode).toBe(201);
    });
  });

  describe("required fields", () => {
    it.each([["date"], ["from"], ["to"]])("refuses a slot without %s", async (field) => {
      const res = await createSlot({ [field]: undefined });

      expect(res.statusCode).toBe(400);
      expect(res.json().details.map((d: { path: string[] }) => d.path[0])).toContain(field);
    });

    it("refuses unknown fields", async () => {
      const res = await createSlot({ seats: 100 });

      expect(res.statusCode).toBe(400);
      expect(await countRows("time_slots")).toBe(0);
    });

    it("refuses a body that is not valid JSON", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/slots",
        headers: { "content-type": "application/json" },
        payload: "{ not json",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("tables", () => {
    it.each([
      ["not a list", 1],
      ["a list of text", ["1"]],
      ["with a decimal id", [1.5]],
      ["with id 0", [0]],
      ["with a negative id", [-1]],
    ])("refuses tableIds %s", async (_description, tableIds) => {
      const res = await createSlot({ tableIds });

      expect(res.statusCode).toBe(400);
      expect(res.json().details[0].path[0]).toBe("tableIds");
      expect(await countRows("time_slots")).toBe(0);
    });

    it("refuses the same table twice", async () => {
      const res = await createSlot({ tableIds: [1, 1] });

      expect(res.statusCode).toBe(400);
      expect(res.json().details[0].message).toBe("tableIds must not contain duplicates");
    });

    it("refuses unknown tables, naming them, and saves nothing", async () => {
      const res = await createSlot({ tableIds: [1, 98, 99] });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({ error: "Tables not found: 98, 99" });
      expect(await countRows("time_slots")).toBe(0);
      expect(await countRows("table_availability")).toBe(0);
    });

    it("allows the same table in different slots", async () => {
      await createSlot({ from: "12:00", to: "13:00", tableIds: [1] });
      const res = await createSlot({ from: "13:00", to: "14:00", tableIds: [1] });

      expect(res.statusCode).toBe(201);
    });
  });

  describe("overlapping slots", () => {
    beforeEach(async () => {
      expect((await createSlot({ from: "12:00", to: "14:00" })).statusCode).toBe(201);
    });

    it.each([
      ["identical", "12:00", "14:00"],
      ["starting during it", "13:00", "15:00"],
      ["ending during it", "11:00", "13:00"],
      ["inside it", "12:30", "13:30"],
      ["containing it", "11:00", "15:00"],
    ])("refuses a slot %s, naming the existing one", async (_description, from, to) => {
      const res = await createSlot({ from, to, tableIds: [3] });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: "Slot overlaps with existing slot 12:00-14:00" });
      expect(await countRows("time_slots")).toBe(1);
      expect(await countRows("table_availability")).toBe(2);
    });

    it.each([
      ["right after it", "14:00", "15:00"],
      ["right before it", "11:00", "12:00"],
      ["later the same day", "19:00", "21:00"],
    ])("allows a slot %s", async (_description, from, to) => {
      const res = await createSlot({ from, to });

      expect(res.statusCode).toBe(201);
    });

    it("allows the same time on another day", async () => {
      const res = await createSlot({ date: OTHER_DAY, from: "12:00", to: "14:00" });

      expect(res.statusCode).toBe(201);
    });

    it("lets only one of two identical requests sent together succeed", async () => {
      const [first, second] = await Promise.all([
        createSlot({ from: "19:00", to: "21:00" }),
        createSlot({ from: "19:00", to: "21:00" }),
      ]);

      expect([first.statusCode, second.statusCode].sort()).toEqual([201, 409]);
      expect(await countRows("time_slots")).toBe(2);
    });
  });

  it.todo("lets only EMPLOYEE and MANAGER create tables and slots (needs the login page)");
});

describe("GET /api/slots", () => {
  it("returns an empty list for a day without slots", async () => {
    const res = await get(`/api/slots?date=${DAY}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns only the slots of that day, ordered by start time", async () => {
    await createSlot({ from: "19:00", to: "21:00", tableIds: [1] });
    await createSlot({ from: "12:00", to: "13:00", tableIds: [2] });
    await createSlot({ date: OTHER_DAY, from: "08:00", to: "09:00", tableIds: [3] });

    const res = await get(`/api/slots?date=${DAY}`);

    expect(res.statusCode).toBe(200);
    expect(res.json().map((slot: { from: string }) => slot.from)).toEqual(["12:00", "19:00"]);
  });

  it("gives each slot its own tables and seats", async () => {
    await createSlot({ from: "12:00", to: "13:00", tableIds: [3, 1] });
    await createSlot({ from: "13:00", to: "14:00", tableIds: [2] });
    await createSlot({ from: "14:00", to: "15:00", tableIds: [] });

    const res = await get(`/api/slots?date=${DAY}`);

    expect(res.json()).toMatchObject([
      { from: "12:00", totalSeats: 8, tables: [T1, T3] },
      { from: "13:00", totalSeats: 4, tables: [T2] },
      { from: "14:00", totalSeats: 0, tables: [] },
    ]);
  });

  it.each([
    ["no date", ""],
    ["an impossible date", "?date=2027-02-30"],
    ["a wrong format", "?date=10-12-2027"],
    ["an empty date", "?date="],
  ])("refuses %s", async (_description, query) => {
    const res = await get(`/api/slots${query}`);

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid query parameters");
  });
});

describe("GET /api/slots/:id", () => {
  it("returns the slot with its tables and seats", async () => {
    const created = (await createSlot()).json();

    const res = await get(`/api/slots/${created.id}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(created);
  });

  it("returns a slot without tables, with 0 seats", async () => {
    const created = (await createSlot({ tableIds: [] })).json();

    const res = await get(`/api/slots/${created.id}`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ totalSeats: 0, tables: [] });
  });

  it("answers 404 for a slot that does not exist", async () => {
    const res = await get("/api/slots/999");

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "Time slot not found" });
  });

  it.each([["abc"], ["0"], ["-1"], ["1.5"]])("refuses the id %s", async (id) => {
    const res = await get(`/api/slots/${id}`);

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("Invalid path parameters");
  });
});

// What the employee defines here is what hikers can then book
describe("slots and availability", () => {
  it("makes a new slot available for the seats of its tables", async () => {
    const { id } = (await createSlot({ tableIds: [1, 2] })).json();

    const res = await get(`/api/availability?date=${DAY}&partySize=6`);

    expect(res.statusCode).toBe(200);
    expect(res.json().slots).toMatchObject([
      { slotId: id, availableSeats: 6, available: true },
    ]);
  });

  it("does not accept a party larger than the seats of the slot", async () => {
    await createSlot({ tableIds: [1, 2] });

    const res = await get(`/api/availability?date=${DAY}&partySize=7`);

    expect(res.json().slots).toMatchObject([{ availableSeats: 6, available: false }]);
  });

  it("offers no seats in a slot without tables", async () => {
    await createSlot({ tableIds: [] });

    const res = await get(`/api/availability?date=${DAY}`);

    expect(res.json().slots).toMatchObject([{ availableSeats: 0, available: false }]);
  });
});
