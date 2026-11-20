import { and, asc, eq, inArray, ne } from "drizzle-orm";

import { db } from "#src/db/database";
import {
  allergensTable,
  dishAllergenTable,
  dishesTable,
  menuDishesTable,
  menusTable,
  timeSlotMenuTable,
  timeSlotTable,
  type DishType,
  type MenuType,
} from "#src/db/schema";
import { allergensOf, compareDishes } from "#src/menus/meals/meal-helpers";

export interface MealAllergen {
  id: number;
  name: string;
}

export interface MealDish {
  id: number;
  name: string;
  description: string | null;
  course: DishType;
  allergens: MealAllergen[];
}

export interface MealMenu {
  id: number;
  name: string;
  type: MenuType;
  allergens: MealAllergen[]; // all allergens of its dishes
  dishes: MealDish[];
}

export interface MealSlot {
  slotId: number;
  date: string;
  from: string;
  to: string;
  menus: MealMenu[];
}

export class MealRepository {
  /** The meal times (slots) of a day, with the menus they offer, each dish with its allergens. */
  static async getMealsForDate(date: string): Promise<MealSlot[]> {
    const slots = await db
      .select()
      .from(timeSlotTable)
      .where(eq(timeSlotTable.date, date))
      .orderBy(asc(timeSlotTable.from));
    if (slots.length === 0) return [];

    // The menus specified for these slots (MH-10); canceled menus are no longer served
    const slotMenus = await db
      .select({ slotId: timeSlotMenuTable.slotId, menu: menusTable })
      .from(timeSlotMenuTable)
      .innerJoin(menusTable, eq(timeSlotMenuTable.menuId, menusTable.id))
      .where(
        and(
          inArray(timeSlotMenuTable.slotId, slots.map((slot) => slot.id)),
          ne(menusTable.type, "CANCELED"),
        ),
      )
      .orderBy(asc(menusTable.name));

    const menuIds = [...new Set(slotMenus.map((row) => row.menu.id))];
    const menuDishes =
      menuIds.length === 0
        ? []
        : await db
            .select({ menuId: menuDishesTable.menuId, dish: dishesTable })
            .from(menuDishesTable)
            .innerJoin(dishesTable, eq(menuDishesTable.dishId, dishesTable.id))
            .where(inArray(menuDishesTable.menuId, menuIds));

    const dishIds = [...new Set(menuDishes.map((row) => row.dish.id))];
    const dishAllergens =
      dishIds.length === 0
        ? []
        : await db
            .select({ dishId: dishAllergenTable.dishId, allergen: allergensTable })
            .from(dishAllergenTable)
            .innerJoin(allergensTable, eq(dishAllergenTable.allergenId, allergensTable.id))
            .where(inArray(dishAllergenTable.dishId, dishIds))
            .orderBy(asc(allergensTable.name));

    const allergensByDish = new Map<number, MealAllergen[]>();
    for (const { dishId, allergen } of dishAllergens) {
      const list = allergensByDish.get(dishId) ?? [];
      list.push({ id: allergen.id, name: allergen.name });
      allergensByDish.set(dishId, list);
    }

    const dishesByMenu = new Map<number, MealDish[]>();
    for (const { menuId, dish } of menuDishes) {
      const list = dishesByMenu.get(menuId) ?? [];
      list.push({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        course: dish.course,
        allergens: allergensByDish.get(dish.id) ?? [],
      });
      dishesByMenu.set(menuId, list);
    }

    const menusBySlot = new Map<number, MealMenu[]>();
    for (const { slotId, menu } of slotMenus) {
      const dishes = [...(dishesByMenu.get(menu.id) ?? [])].sort(compareDishes);
      const list = menusBySlot.get(slotId) ?? [];
      list.push({
        id: menu.id,
        name: menu.name,
        type: menu.type,
        allergens: allergensOf(dishes),
        dishes,
      });
      menusBySlot.set(slotId, list);
    }

    return slots.map((slot) => ({
      slotId: slot.id,
      date: slot.date,
      from: slot.from,
      to: slot.to,
      menus: menusBySlot.get(slot.id) ?? [],
    }));
  }
}