import { asc } from "drizzle-orm";

import { db } from "#src/db/database";
import { allergensTable } from "#src/db/schema";
import type { Allergen } from "#src/menus/allergens/allergen-schema";

export class AllergenRepository {
  static async listAllergens(): Promise<Allergen[]> {
    return db
      .select({
        id: allergensTable.id,
        name: allergensTable.name,
      })
      .from(allergensTable)
      .orderBy(asc(allergensTable.id));
  }
}
