import { type InferSelectModel } from "drizzle-orm";

import { db } from "#src/db/database";
import { dishesTable } from "#src/db/schema";

export type Dish = InferSelectModel<typeof dishesTable>;

export class DishRepository {
  static async getDishes(): Promise<Dish[]> {
    return await db.select().from(dishesTable);
  }
}
