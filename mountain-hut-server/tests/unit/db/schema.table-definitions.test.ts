import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import {
  allergensTable,
  reservationsTable,
  reservationAllergensTable,
  tableAvailabilityTable,
  tablesTable,
  timeSlotTable,
  usersTable,
} from "../../../src/db/schema.ts";

describe("schema table definitions", () => {
  it("defines unique user emails, table codes, and allergen names", () => {
    for (const [table, columnName] of [
      [usersTable, "email"],
      [tablesTable, "code"],
      [allergensTable, "name"],
    ] as const) {
      const column = getTableConfig(table).columns.find(
        (item) => item.name === columnName,
      );
      expect(column?.isUnique).toBe(true);
    }
  });

  it("prevents duplicate slots for the same date and time range", () => {
    const [constraint] = getTableConfig(timeSlotTable).uniqueConstraints;
    expect(constraint.columns.map((column) => column.name)).toEqual([
      "date",
      "from",
      "to",
    ]);
  });

  it("uses composite primary keys for table and allergen associations", () => {
    expect(
      getTableConfig(tableAvailabilityTable).primaryKeys[0].columns.map(
        (column) => column.name,
      ),
    ).toEqual(["slot_id", "table_id"]);
    expect(
      getTableConfig(reservationAllergensTable).primaryKeys[0].columns.map(
        (column) => column.name,
      ),
    ).toEqual(["allergen_id", "reservation_id"]);
  });

  it("declares cascading foreign keys for association rows", () => {
    const tableAvailabilityForeignKeys =
      getTableConfig(tableAvailabilityTable).foreignKeys;
    const reservationAllergensForeignKeys =
      getTableConfig(reservationAllergensTable).foreignKeys;

    expect(tableAvailabilityForeignKeys).toHaveLength(2);
    expect(reservationAllergensForeignKeys).toHaveLength(2);
    expect(
      [...tableAvailabilityForeignKeys, ...reservationAllergensForeignKeys]
        .map((foreignKey) => foreignKey.onDelete),
    ).toContain("cascade");
    for (const foreignKey of [
      ...tableAvailabilityForeignKeys,
      ...reservationAllergensForeignKeys,
    ]) {
      expect(foreignKey.reference().columns).toHaveLength(1);
      expect(foreignKey.reference().foreignColumns).toHaveLength(1);
    }
  });

  it("requires each reservation to reference an existing user, slot, and table", () => {
    const foreignKeys = getTableConfig(reservationsTable).foreignKeys;
    expect(foreignKeys).toHaveLength(3);
    for (const foreignKey of foreignKeys) {
      expect(foreignKey.reference().columns).toHaveLength(1);
      expect(foreignKey.reference().foreignColumns).toHaveLength(1);
    }
  });
});
