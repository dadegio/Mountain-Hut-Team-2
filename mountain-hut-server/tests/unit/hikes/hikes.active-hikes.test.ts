import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { hikesTable, usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

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
const { listActiveHikes, listRegisteredHikes } = await import("../../../src/hikes/hikes.ts");

const now = new Date("2030-06-15T12:00:00.000Z");
const base = {
  userId: 1,
  departureAt: "2030-06-15T08:00:00.000Z",
  expectedReturnAt: "2030-06-15T16:00:00.000Z",
  destination: "Monviso",
  routeDescription: "Via Lago Chiaretto",
  intermediatePoints: ["Viso Mozzo"],
};

beforeEach(async () => {
  await resetTestDatabase(client);
  await db.insert(usersTable).values({
    id: 1, email: "hiker@example.com", passwordHash: "hash",
    name: "Anna", surname: "Alpine", type: "HIKER", phoneNumber: "+39000001",
  });
});

afterAll(async () => {
  await client.close();
  cleanup();
});

describe("MH-213 active hikes query", () => {
  it("returns only started, uncompleted hikes, sorted by expected return and ID", async () => {
    await db.insert(hikesTable).values([
      { ...base, id: 1 },
      { ...base, id: 2, expectedReturnAt: "2030-06-15T10:00:00.000Z" },
      { ...base, id: 3, departureAt: "2030-06-15T13:00:00.000Z" },
      { ...base, id: 4, completedAt: "2030-06-15T11:00:00.000Z" },
      { ...base, id: 5, departureAt: now.toISOString() },
    ]);
    const rows = await listActiveHikes(now);
    expect(rows.map((hike) => hike.id)).toEqual([2, 1, 5]);
    expect(rows[0]).toMatchObject({
      destination: "Monviso", routeDescription: "Via Lago Chiaretto",
      intermediatePoints: ["Viso Mozzo"], completedAt: null,
      hiker: { name: "Anna", surname: "Alpine", phoneNumber: "+39000001" },
    });
    expect(JSON.stringify(rows)).not.toContain("passwordHash");
    expect(await listRegisteredHikes()).toHaveLength(5);
  });

  it("returns an empty array when there are no active hikes", async () => {
    await db.insert(hikesTable).values({ ...base, departureAt: "2030-06-16T08:00:00.000Z", expectedReturnAt: "2030-06-16T16:00:00.000Z" });
    expect(await listActiveHikes(now)).toEqual([]);
  });
});
