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
const { HikesRepository } = await import("../../../src/hikes/hikes.ts");

const base = {
  destination: "Monviso",
  routeDescription: "Via Lago Chiaretto",
  intermediatePoints: [],
};

beforeEach(async () => {
  await resetTestDatabase(client);
  await db.insert(usersTable).values([
    { id: 1, email: "anna@example.com", passwordHash: "hash", name: "Anna", surname: "Alpine", type: "HIKER", phoneNumber: "+39000001" },
    { id: 2, email: "luca@example.com", passwordHash: "hash", name: "Luca", surname: "Neri", type: "HIKER", phoneNumber: "+39000002" },
  ]);
  // Anna is out from 08:00 to 16:00 UTC
  await db.insert(hikesTable).values({
    ...base,
    userId: 1,
    departureAt: "2030-06-15T08:00:00.000Z",
    expectedReturnAt: "2030-06-15T16:00:00.000Z",
  });
});

afterAll(async () => {
  await client.close();
  cleanup();
});

describe("MH-183 overlapping hikes", () => {
  it.each([
    ["inside the existing hike", "2030-06-15T10:00:00Z", "2030-06-15T12:00:00Z"],
    ["starting before and ending during it", "2030-06-15T06:00:00Z", "2030-06-15T09:00:00Z"],
    ["covering it completely", "2030-06-15T07:00:00Z", "2030-06-15T18:00:00Z"],
    ["with a time-zone offset", "2030-06-15T17:30:00+02:00", "2030-06-15T19:00:00+02:00"],
  ])("finds an overlap %s", async (_case, from, to) => {
    expect(await HikesRepository.findOverlappingHike(1, from, to)).not.toBeNull();
  });

  it.each([
    ["right after it ends", "2030-06-15T16:00:00Z", "2030-06-15T18:00:00Z"],
    ["later the same day", "2030-06-15T17:00:00Z", "2030-06-15T19:00:00Z"],
    ["ending right when it starts", "2030-06-15T06:00:00Z", "2030-06-15T08:00:00Z"],
  ])("allows a hike %s", async (_case, from, to) => {
    expect(await HikesRepository.findOverlappingHike(1, from, to)).toBeNull();
  });

  it("does not compare with another hiker's hikes", async () => {
    expect(
      await HikesRepository.findOverlappingHike(2, "2030-06-15T10:00:00Z", "2030-06-15T12:00:00Z"),
    ).toBeNull();
  });
});