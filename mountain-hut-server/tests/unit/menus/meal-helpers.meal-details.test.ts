import { describe, expect, it } from "vitest";
import { allergensOf, compareDishes } from "../../../src/menus/meals/meal-helpers.ts";
import type { DishType } from "../../../src/db/schema.ts";

const dish = (name: string, course: DishType) => ({ name, course });
const allergen = (id: number, name: string) => ({ id, name });

describe("MH-133 meal helpers", () => {
  describe("dish order", () => {
    it("orders the dishes as they are served", () => {
      const dishes = [
        dish("Grappa", "BEVERAGE"),
        dish("Strudel", "DESSERT"),
        dish("Patate", "SIDE"),
        dish("Canederli", "MAIN"),
        dish("Tagliere", "APPETIZER"),
      ];

      expect([...dishes].sort(compareDishes).map((d) => d.course)).toEqual([
        "APPETIZER",
        "MAIN",
        "SIDE",
        "DESSERT",
        "BEVERAGE",
      ]);
    });

    it("orders dishes of the same course by name", () => {
      const dishes = [dish("Pizzoccheri", "MAIN"), dish("Canederli", "MAIN"), dish("Polenta", "MAIN")];

      expect([...dishes].sort(compareDishes).map((d) => d.name)).toEqual([
        "Canederli",
        "Pizzoccheri",
        "Polenta",
      ]);
    });
  });

  describe("allergens of a menu", () => {
    it("collects each allergen of the dishes once, by name", () => {
      const dishes = [
        { allergens: [allergen(3, "Wheat"), allergen(2, "Eggs")] },
        { allergens: [allergen(1, "Milk"), allergen(3, "Wheat")] },
        { allergens: [] },
      ];

      expect(allergensOf(dishes)).toEqual([
        allergen(2, "Eggs"),
        allergen(1, "Milk"),
        allergen(3, "Wheat"),
      ]);
    });

    it("is empty for dishes without allergens", () => {
      expect(allergensOf([{ allergens: [] }, { allergens: [] }])).toEqual([]);
      expect(allergensOf([])).toEqual([]);
    });
  });
});