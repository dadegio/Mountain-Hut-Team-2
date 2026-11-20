import { apiFetch } from "../../shared/api/client.ts";
import type { MealTime } from "../types/meal.ts";

// Public: meal times of a day with their menus, dishes and allergens
export function getMeals(date: string): Promise<MealTime[]> {
  return apiFetch<MealTime[]>(`/meals?date=${encodeURIComponent(date)}`);
}