import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { hikesTable, usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

/**
 * MH-214: unit tests for story MH-22 (confirm safe arrival), task MH-191.
 * A hike completed before its planned departure is a cancelled hike
 * (course clarification of 25 Nov 2026).
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __testClient: client, __testCleanup: cleanup };
});

const { db, __testClient: client, __testCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    db: typeof import("../../../src/db/database.ts")["db"];
    __testClient: Client;
    __testCleanup: () => void;
  };
const { completeHike, hikeOutcome, withOutcome } =
  await import("../../../src/hikes/hike-completion.ts");

const ANNA = 1;
const BRUNO = 2;
const DEPARTURE = "2030-06-15T08:00:00.000Z";
const RETURN = "2030-06-15T16:00:00.000Z";

const hike = {
  userId: ANNA,
  departureAt: DEPARTURE,
  expectedReturnAt: RETURN,
  destination: "Monviso",
  routeDescription: "Via Lago Chiaretto",
};

async function completedAtOf(id: number) {
  const [row] = await db.select({ completedAt: hikesTable.completedAt })
    .from(hikesTable).where(eq(hikesTable.id, id));
  return row.completedAt;
}

beforeEach(async () => {
  await resetTestDatabase(client);
  await db.insert(usersTable).values([
    { id: ANNA, email: "anna@example.com", passwordHash: "hash", name: "Anna", surname: "Alpine", type: "HIKER" },
    { id: BRUNO, email: "bruno@example.com", passwordHash: "hash", name: "Bruno", surname: "Bivouac", type: "HIKER" },
  ]);
});

afterAll(async () => {
  await client.close();
  cleanup();
});

describe("MH-214 hike outcome", () => {
  it("is null while the hike is not completed", () => {
    expect(hikeOutcome({ departureAt: DEPARTURE, completedAt: null })).toBeNull();
  });

  it("is CANCELLED when the hike is completed before its departure", () => {
    expect(hikeOutcome({ departureAt: DEPARTURE, completedAt: "2030-06-15T07:59:59.999Z" }))
      .toBe("CANCELLED");
  });

  it("is COMPLETED when the hike is completed exactly at its departure", () => {
    expect(hikeOutcome({ departureAt: DEPARTURE, completedAt: DEPARTURE })).toBe("COMPLETED");
  });

  it("is COMPLETED when the hiker comes back late, after the expected return", () => {
    expect(hikeOutcome({ departureAt: DEPARTURE, completedAt: "2030-06-15T20:00:00.000Z" }))
      .toBe("COMPLETED");
  });

  it("adds the outcome and keeps every other field", () => {
    const row = { id: 7, destination: "Monviso", departureAt: DEPARTURE, completedAt: null };
    expect(withOutcome(row)).toEqual({ ...row, outcome: null });
  });
});

describe("MH-214 complete a hike", () => {
  it("cancels a hike that has not started yet", async () => {
    const [planned] = await db.insert(hikesTable).values(hike).returning();
    const now = new Date("2030-06-14T18:00:00.000Z");

    const result = await completeHike(planned.id, ANNA, now);

    expect(result).toEqual({
      status: "completed",
      hike: { ...planned, completedAt: now.toISOString(), outcome: "CANCELLED" },
    });
    expect(await completedAtOf(planned.id)).toBe(now.toISOString());
  });

  it("completes a hike that has started", async () => {
    const [started] = await db.insert(hikesTable).values(hike).returning();
    const now = new Date("2030-06-15T15:30:00.000Z");

    const result = await completeHike(started.id, ANNA, now);

    expect(result).toMatchObject({
      status: "completed",
      hike: { id: started.id, completedAt: now.toISOString(), outcome: "COMPLETED" },
    });
  });

  it("does not find a hike that does not exist", async () => {
    expect(await completeHike(999, ANNA)).toEqual({ status: "not-found" });
  });

  it("does not find, and does not change, another hiker's hike", async () => {
    const [annas] = await db.insert(hikesTable).values(hike).returning();

    expect(await completeHike(annas.id, BRUNO)).toEqual({ status: "not-found" });
    expect(await completedAtOf(annas.id)).toBeNull();
  });

  it("refuses a second completion and keeps the first time", async () => {
    const [done] = await db.insert(hikesTable).values(hike).returning();
    const first = new Date("2030-06-15T15:30:00.000Z");
    await completeHike(done.id, ANNA, first);

    const again = await completeHike(done.id, ANNA, new Date("2030-06-15T17:00:00.000Z"));

    expect(again).toEqual({ status: "already-completed" });
    expect(await completedAtOf(done.id)).toBe(first.toISOString());
  });

  it("lets only one of two requests sent together complete the hike", async () => {
    const [doubleClick] = await db.insert(hikesTable).values(hike).returning();

    const results = await Promise.all([
      completeHike(doubleClick.id, ANNA),
      completeHike(doubleClick.id, ANNA),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(["already-completed", "completed"]);
  });

  it("changes only the selected hike", async () => {
    const [first, second] = await db.insert(hikesTable).values([hike, hike]).returning();

    await completeHike(first.id, ANNA);

    expect(await completedAtOf(second.id)).toBeNull();
  });
});
