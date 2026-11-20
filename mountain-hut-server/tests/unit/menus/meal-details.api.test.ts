import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import {
  allergensTable,
  dishAllergenTable,
  dishesTable,
  menuDishesTable,
  menusTable,
  timeSlotMenuTable,
  timeSlotTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

/**
 * MH-133: integration tests for the meal details API (MH-11), through the
 * real route and a temporary SQLite database: local.db is never touched.
 */
vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __mealTestClient: client, __mealTestCleanup: cleanup };
});

const { db, __mealTestClient: client, __mealTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    db: typeof import("../../../src/db/database.ts")["db"];
    __mealTestClient: Client;
    __mealTestCleanup: () => void;
  };
const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

const DAY = "2030-06-15";
const OTHER_DAY = "2030-06-16";

function getMeals(query: string) {
  return app.inject({ method: "GET", url: `/api/v1/meals${query}` });
}

// Lunch: Alpino + a canceled menu. Dinner: Cacciatore + Alpino. Breakfast: no menu.
async function seedMeals() {
  await db.insert(timeSlotTable).values([
    { id: 1, date: DAY, from: "19:00", to: "21:00" },
    { id: 2, date: DAY, from: "12:00", to: "14:00" },
    { id: 3, date: OTHER_DAY, from: "12:00", to: "14:00" },
    { id: 4, date: DAY, from: "08:00", to: "09:00" },
  ]);
  await db.insert(allergensTable).values([
    { id: 1, name: "Milk" },
    { id: 2, name: "Eggs" },
    { id: 3, name: "Wheat" },
  ]);
  await db.insert(dishesTable).values([
    { id: 1, name: "Strudel", description: "Apple strudel", course: "DESSERT" },
    { id: 2, name: "Canederli", description: null, course: "MAIN" },
    { id: 3, name: "Tagliere", description: "Cold cuts and cheese", course: "APPETIZER" },
    { id: 4, name: "Patate", description: null, course: "SIDE" },
  ]);
  await db.insert(dishAllergenTable).values([
    { dishId: 1, allergenId: 3 },
    { dishId: 1, allergenId: 2 },
    { dishId: 1, allergenId: 1 },
    { dishId: 2, allergenId: 3 },
    { dishId: 2, allergenId: 2 },
    { dishId: 3, allergenId: 1 },
  ]);
  await db.insert(menusTable).values([
    { id: 1, name: "Menu Alpino", type: "TEMPLATE" },
    { id: 2, name: "Menu Vecchio", type: "CANCELED" },
    { id: 3, name: "Menu Cacciatore", type: "MODIFIED" },
  ]);
  await db.insert(menuDishesTable).values([
    { menuId: 1, dishId: 1 },
    { menuId: 1, dishId: 2 },
    { menuId: 1, dishId: 3 },
    { menuId: 1, dishId: 4 },
    { menuId: 2, dishId: 2 },
    { menuId: 3, dishId: 3 },
  ]);
  await db.insert(timeSlotMenuTable).values([
    { slotId: 2, menuId: 1 },
    { slotId: 2, menuId: 2 },
    { slotId: 1, menuId: 3 },
    { slotId: 1, menuId: 1 },
    { slotId: 3, menuId: 1 },
  ]);
}

beforeAll(async () => {
  await app.ready();
});

beforeEach(async () => {
  await resetTestDatabase(client);
  await seedMeals();
});

afterAll(async () => {
  await app.close();
  await client.close();
  cleanup();
});

describe("MH-133 GET /api/v1/meals", () => {
  it("returns the meal times of the day by start time, each with its menus", async () => {
    const res = await getMeals(`?date=${DAY}`);

    expect(res.statusCode).toBe(200);
    const meals = res.json();
    expect(meals.map((m: { from: string; to: string }) => `${m.from}-${m.to}`)).toEqual([
      "08:00-09:00",
      "12:00-14:00",
      "19:00-21:00",
    ]);
    expect(meals.map((m: { menus: { name: string }[] }) => m.menus.map((menu) => menu.name))).toEqual([
      [],
      ["Menu Alpino"],
      ["Menu Alpino", "Menu Cacciatore"],
    ]);
    expect(meals[1]).toMatchObject({ slotId: 2, date: DAY });
  });

  it("lists the dishes in serving order, each with its allergens", async () => {
    const [, lunch] = (await getMeals(`?date=${DAY}`)).json();
    const [alpino] = lunch.menus;

    expect(alpino).toMatchObject({ id: 1, name: "Menu Alpino", type: "TEMPLATE" });
    expect(alpino.dishes.map((d: { name: string }) => d.name)).toEqual([
      "Tagliere",
      "Canederli",
      "Patate",
      "Strudel",
    ]);
    expect(alpino.dishes[3]).toEqual({
      id: 1,
      name: "Strudel",
      description: "Apple strudel",
      course: "DESSERT",
      allergens: [
        { id: 2, name: "Eggs" },
        { id: 1, name: "Milk" },
        { id: 3, name: "Wheat" },
      ],
    });
    expect(alpino.dishes[2]).toMatchObject({ name: "Patate", description: null, allergens: [] });
  });

  it("gives each menu all the allergens of its dishes, so a party can pick a suitable one", async () => {
    const [, , dinner] = (await getMeals(`?date=${DAY}`)).json();
    const [alpino, cacciatore] = dinner.menus;

    expect(alpino.allergens).toEqual([
      { id: 2, name: "Eggs" },
      { id: 1, name: "Milk" },
      { id: 3, name: "Wheat" },
    ]);
    expect(cacciatore.allergens).toEqual([{ id: 1, name: "Milk" }]);
  });

  it("leaves out canceled menus", async () => {
    const [, lunch] = (await getMeals(`?date=${DAY}`)).json();

    expect(lunch.menus.map((m: { name: string }) => m.name)).not.toContain("Menu Vecchio");
  });

  it("returns only the meal times of the requested day", async () => {
    const meals = (await getMeals(`?date=${OTHER_DAY}`)).json();

    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ slotId: 3, from: "12:00", menus: [{ name: "Menu Alpino" }] });
  });

  it("returns an empty list for a day without meal times", async () => {
    const res = await getMeals("?date=2030-06-20");

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("is open to every user, guests included", async () => {
    const res = await getMeals(`?date=${DAY}`);

    expect(res.statusCode).toBe(200);
  });

  it.each([
    ["no date", ""],
    ["an empty date", "?date="],
    ["an impossible date", "?date=2030-13-01"],
    ["a wrong format", "?date=15-06-2030"],
    ["text", "?date=tomorrow"],
  ])("refuses %s", async (_description, query) => {
    const res = await getMeals(query);

    expect(res.statusCode).toBe(400);
  });
});