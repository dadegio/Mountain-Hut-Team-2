import { DISH_TYPE, type DishType } from "#src/db/schema";

// Dishes in the order they are served, then by name
export function compareDishes(
  a: { course: DishType; name: string },
  b: { course: DishType; name: string },
): number {
  return DISH_TYPE.indexOf(a.course) - DISH_TYPE.indexOf(b.course) || a.name.localeCompare(b.name);
}

// Every allergen in a set of dishes, once each, by name. A party can see at a
// glance whether a whole menu suits them (MH-11).
export function allergensOf<A extends { id: number; name: string }>(
  dishes: { allergens: A[] }[],
): A[] {
  const byId = new Map<number, A>();
  for (const dish of dishes) {
    for (const allergen of dish.allergens) byId.set(allergen.id, allergen);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}