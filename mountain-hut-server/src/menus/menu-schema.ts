import { z } from "zod";
import { MENU_TYPES } from "#src/db/schema";
import { dishSchema } from "#src/menus/dishes/dish-routes";

export const getMenuQuerySchema = z.object({
  type: z.enum(MENU_TYPES).optional(),
});
export type GetMenuQuery = z.infer<typeof getMenuQuerySchema>;

export const menuSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: z.enum(MENU_TYPES),
  dishes: z.array(dishSchema),
});
export type MenuWithDishes = z.infer<typeof menuSchema>;

export const createMenuSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(MENU_TYPES),
  dishes: z.array(z.number().int().positive()),
});
export type CreateMenuInput = z.infer<typeof createMenuSchema>;

export const menuParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
export type MenuParams = z.infer<typeof menuParamsSchema>;
