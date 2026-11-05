import { asc } from "drizzle-orm";
import { db } from "../db/database.ts";
import { allergensTable } from "../db/schema.ts";

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
