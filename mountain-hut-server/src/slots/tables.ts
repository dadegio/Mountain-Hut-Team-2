import { asc, eq } from "drizzle-orm";
import { db } from "../db/database.ts";
import { tablesTable } from "../db/schema.ts";
import { SlotError } from "./slots.ts";

export interface CreateTableInput {
  code: string;
  seats: number;
}

export async function listTables() {
  return db.select().from(tablesTable).orderBy(asc(tablesTable.id));
}

export async function createTable(input: CreateTableInput) {
  return db.transaction(
    async (tx) => {
      const [existing] = await tx
        .select()
        .from(tablesTable)
        .where(eq(tablesTable.code, input.code))
        .limit(1);

      if (existing) {
        throw new SlotError(409, `Table code ${input.code} already exists`);
      }

      const [table] = await tx.insert(tablesTable).values(input).returning();
      return table;
    },
    { behavior: "immediate" },
  );
}
