import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { allergensTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../../src/test-support/test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../../src/test-support/test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __integrationTestClient: client, __integrationTestCleanup: cleanup };
});

const { db: testDb } = await import("../../../src/db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const { listAllergens } = await import("../../../src/allergens/allergens.ts");

const app = buildApp({ logger: false });

const SEED_ALLERGENS = [
  { id: 1, name: "Milk" },
  { id: 2, name: "Eggs" },
  { id: 3, name: "Peanuts" },
  { id: 4, name: "Tree Nuts" },
  { id: 5, name: "Soybeans" },
  { id: 6, name: "Wheat" },
  { id: 7, name: "Fish" },
  { id: 8, name: "Shellfish" },
];

async function seedAllergens() {
  await resetTestDatabase(client);
  await testDb.insert(allergensTable).values(SEED_ALLERGENS);
}

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await seedAllergens();
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("Allergens API & Service", () => {
  describe("listAllergens", () => {
    it("returns all allergens ordered by id", async () => {
      const result = await listAllergens();
      expect(result).toHaveLength(8);
      expect(result).toEqual(SEED_ALLERGENS);
    });

    it("returns an empty list when no allergens exist", async () => {
      await resetTestDatabase(client);
      const result = await listAllergens();
      expect(result).toEqual([]);
    });
  });

  describe("GET /api/allergens", () => {
    it("returns 200 with the list of available allergens", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/allergens",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual(SEED_ALLERGENS);
    });
  });
});
