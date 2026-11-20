import { asc } from "drizzle-orm";
import { db } from "#src/db/database";
import { allergensTable } from "#src/db/schema";

export interface Allergen {
  id: number;
  name: string;
}

export async function listAllergens(): Promise<Allergen[]> {
  return db
    .select({
      id: allergensTable.id,
      name: allergensTable.name,
    })
    .from(allergensTable)
    .orderBy(asc(allergensTable.id));
}
