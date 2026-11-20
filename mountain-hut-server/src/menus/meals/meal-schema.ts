import { z } from "zod";
import { DISH_TYPE, MENU_TYPES } from "#src/db/schema";

export const mealQuerySchema = z.object({
  date: z.iso.date(),
});

const mealAllergenSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const mealDishSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  course: z.enum(DISH_TYPE),
  allergens: z.array(mealAllergenSchema),
});

const mealMenuSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(MENU_TYPES),
  allergens: z.array(mealAllergenSchema),
  dishes: z.array(mealDishSchema),
});

export const mealSlotSchema = z.object({
  slotId: z.number().int(),
  date: z.string(),
  from: z.string(),
  to: z.string(),
  menus: z.array(mealMenuSchema),
});