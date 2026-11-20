import argon2 from "argon2";
import * as schema from "./schema.ts";
import { db } from "./database.ts";

// "YYYY-MM-DD" of today + offset days, so demo slots are always in the future
function dayFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

async function main() {
  console.log("Seeding database...");

  // Children first, otherwise the foreign keys block the deletes
  await db.delete(schema.reservationAllergensTable);
  await db.delete(schema.reservationsTable);
  await db.delete(schema.tableAvailabilityTable);
  await db.delete(schema.timeSlotTable);
  await db.delete(schema.tablesTable);
  await db.delete(schema.usersTable);
  await db.delete(schema.allergensTable);

  const insertedUsers = await db
    .insert(schema.usersTable)
    .values([
      {
        email: "mario.rossi@example.com",
        passwordHash: await argon2.hash("mariorossi"),
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+393331234567",
      },
      {
        email: "giulia.verdi@example.com",
        passwordHash: await argon2.hash("giuliaverdi"),
        name: "Giulia",
        surname: "Verdi",
        phoneNumber: "+393339876543",
        type: "HIKER",
      },
      {
        email: "luca.neri@example.com",
        passwordHash: await argon2.hash("lucaneri"),
        name: "Luca",
        surname: "Neri",
        phoneNumber: "+393335554433",
        type: "EMPLOYEE",
      },
      {
        email: "test.employee@example.com",
        passwordHash: await argon2.hash("Password123!"),
        name: "Test",
        surname: "Employee",
        type: "EMPLOYEE",
      },
    ])
    .returning();

  console.log(`Successfully inserted ${insertedUsers.length} users.`);

  const insertedTables = await db
    .insert(schema.tablesTable)
    .values([
      { code: "T1", seats: 2 },
      { code: "T2", seats: 2 },
      { code: "T3", seats: 4 },
      { code: "T4", seats: 4 },
      { code: "T5", seats: 6 },
      { code: "T6", seats: 8 },
    ])
    .returning();
  const tableId = (code: string) =>
    insertedTables.find((t) => t.code === code)!.id;

  console.log(`Successfully inserted ${insertedTables.length} tables.`);

  const tomorrow = dayFromToday(1);
  const dayAfter = dayFromToday(2);
  const insertedSlots = await db
    .insert(schema.timeSlotTable)
    .values([
      { date: tomorrow, from: "12:00", to: "13:00" },
      { date: tomorrow, from: "13:00", to: "14:00" },
      { date: tomorrow, from: "19:00", to: "21:00" },
      { date: dayAfter, from: "12:00", to: "14:00" },
    ])
    .returning();

  // Different table sets per slot, e.g. fewer tables for the second lunch shift
  const slotTables = [
    ["T1", "T2", "T3", "T4", "T5", "T6"],
    ["T3", "T4", "T5"],
    ["T1", "T2", "T3", "T4", "T5", "T6"],
    ["T3", "T4", "T6"],
  ];
  await db.insert(schema.tableAvailabilityTable).values(
    insertedSlots.flatMap((slot, i) =>
      slotTables[i].map((code) => ({
        slotId: slot.id,
        tableId: tableId(code),
      })),
    ),
  );

  console.log(`Successfully inserted ${insertedSlots.length} time slots.`);

  const hiker = insertedUsers.find((u) => u.type === "HIKER")!;
  await db.insert(schema.reservationsTable).values({
    userId: hiker.id,
    slotId: insertedSlots[0].id,
    tableId: tableId("T3"),
    partySize: 3,
  });

  console.log("Successfully inserted 1 reservation.");

  const insertedAllergens = await db
    .insert(schema.allergensTable)
    .values([
      { name: "Milk" },
      { name: "Eggs" },
      { name: "Peanuts" },
      { name: "Tree Nuts" },
      { name: "Soybeans" },
      { name: "Wheat" },
      { name: "Fish" },
      { name: "Shellfish" },
    ])
    .returning();

  console.log(`Successfully inserted ${insertedAllergens.length} allergens.`);

  // Helper to look up allergen IDs by name
  const allergenId = (name: string) =>
    insertedAllergens.find((a) => a.name.toLowerCase() === name.toLowerCase())!
      .id;

  // --- 1. DISHES ---
  const insertedDishes = await db
    .insert(schema.dishesTable)
    .values([
      // Appetizers
      {
        name: "Tagliere del Rifugio",
        description:
          "Assortimento di salumi e formaggi tipici locali con pane di segale",
        course: "APPETIZER",
      },
      {
        name: "Crostini ai Funghi Porcini",
        description: "Crostini di pane casereccio con porcini trifolati",
        course: "APPETIZER",
      },
      // Mains
      {
        name: "Polenta con Spezzatino di Capriolo",
        description:
          "Polenta taragna macinata a pietra servita con spezzatino di capriolo stufato",
        course: "MAIN",
      },
      {
        name: "Canederli allo Speck in Brodo",
        description:
          "Tradizionali canederli tirolesi allo speck serviti in brodo di manzo",
        course: "MAIN",
      },
      {
        name: "Pizzoccheri Valtellinesi",
        description:
          "Tagliatelle di grano saraceno con patate, verza e formaggio Casera fuso",
        course: "MAIN",
      },
      // Sides
      {
        name: "Crauti Stufati",
        description: "Crauti cotti a fuoco lento con bacche di ginepro",
        course: "SIDE",
      },
      {
        name: "Patate al Forno con Rosmarino",
        description: "Patate di montagna arrostite con rosmarino fresco",
        course: "SIDE",
      },
      // Desserts
      {
        name: "Strudel di Mele Caldo",
        description:
          "Strudel artigianale con mele montane, cannella e salsa alla vaniglia",
        course: "DESSERT",
      },
      {
        name: "Torta di Grano Saraceno e Mirtilli Rossi",
        description:
          "Torta morbida tipica farcita con confettura di mirtilli rossi selvatici",
        course: "DESSERT",
      },
      // Beverages
      {
        name: "Grappa al Pino Cembro",
        description: "Grappa artigianale aromatizzata con pigne di cirmolo",
        course: "BEVERAGE",
      },
    ])
    .returning();

  const dishId = (name: string) =>
    insertedDishes.find((d) => d.name === name)!.id;

  console.log(`Successfully inserted ${insertedDishes.length} dishes.`);

  // --- 2. DISH_ALLERGEN ---
  await db.insert(schema.dishAllergenTable).values([
    // Tagliere: Milk (cheeses), Wheat (rye bread)
    { dishId: dishId("Tagliere del Rifugio"), allergenId: allergenId("Milk") },
    { dishId: dishId("Tagliere del Rifugio"), allergenId: allergenId("Wheat") },

    // Crostini: Wheat (bread)
    {
      dishId: dishId("Crostini ai Funghi Porcini"),
      allergenId: allergenId("Wheat"),
    },

    // Polenta: Milk (butter / cheese in taragna)
    {
      dishId: dishId("Polenta con Spezzatino di Capriolo"),
      allergenId: allergenId("Milk"),
    },

    // Canederli: Wheat (flour/bread), Eggs, Milk
    {
      dishId: dishId("Canederli allo Speck in Brodo"),
      allergenId: allergenId("Wheat"),
    },
    {
      dishId: dishId("Canederli allo Speck in Brodo"),
      allergenId: allergenId("Eggs"),
    },
    {
      dishId: dishId("Canederli allo Speck in Brodo"),
      allergenId: allergenId("Milk"),
    },

    // Pizzoccheri: Milk (Casera cheese & butter), Wheat
    {
      dishId: dishId("Pizzoccheri Valtellinesi"),
      allergenId: allergenId("Milk"),
    },
    {
      dishId: dishId("Pizzoccheri Valtellinesi"),
      allergenId: allergenId("Wheat"),
    },

    // Strudel: Wheat, Eggs, Milk
    {
      dishId: dishId("Strudel di Mele Caldo"),
      allergenId: allergenId("Wheat"),
    },
    { dishId: dishId("Strudel di Mele Caldo"), allergenId: allergenId("Eggs") },
    { dishId: dishId("Strudel di Mele Caldo"), allergenId: allergenId("Milk") },

    // Torta Saraceno: Eggs, Milk, Tree Nuts (hazelnuts/almonds)
    {
      dishId: dishId("Torta di Grano Saraceno e Mirtilli Rossi"),
      allergenId: allergenId("Eggs"),
    },
    {
      dishId: dishId("Torta di Grano Saraceno e Mirtilli Rossi"),
      allergenId: allergenId("Milk"),
    },
    {
      dishId: dishId("Torta di Grano Saraceno e Mirtilli Rossi"),
      allergenId: allergenId("Tree Nuts"),
    },
  ]);

  console.log("Successfully linked allergens to dishes.");

  // --- 3. MENUS ---
  const insertedMenus = await db
    .insert(schema.menusTable)
    .values([
      {
        name: "Menu Degustazione del Rifugio",
        type: "TEMPLATE",
      },
      {
        name: "Menu Tradizionale Alpino",
        type: "TEMPLATE",
      },
      {
        name: "Menu Cacciatore Speciale",
        type: "MODIFIED",
      },
    ])
    .returning();

  const menuId = (name: string) =>
    insertedMenus.find((m) => m.name === name)!.id;

  console.log(`Successfully inserted ${insertedMenus.length} menus.`);

  // --- 4. MENU_DISHES ---
  await db.insert(schema.menuDishesTable).values([
    // Menu Degustazione del Rifugio
    {
      menuId: menuId("Menu Degustazione del Rifugio"),
      dishId: dishId("Tagliere del Rifugio"),
    },
    {
      menuId: menuId("Menu Degustazione del Rifugio"),
      dishId: dishId("Pizzoccheri Valtellinesi"),
    },
    {
      menuId: menuId("Menu Degustazione del Rifugio"),
      dishId: dishId("Crauti Stufati"),
    },
    {
      menuId: menuId("Menu Degustazione del Rifugio"),
      dishId: dishId("Strudel di Mele Caldo"),
    },
    {
      menuId: menuId("Menu Degustazione del Rifugio"),
      dishId: dishId("Grappa al Pino Cembro"),
    },

    // Menu Tradizionale Alpino
    {
      menuId: menuId("Menu Tradizionale Alpino"),
      dishId: dishId("Crostini ai Funghi Porcini"),
    },
    {
      menuId: menuId("Menu Tradizionale Alpino"),
      dishId: dishId("Canederli allo Speck in Brodo"),
    },
    {
      menuId: menuId("Menu Tradizionale Alpino"),
      dishId: dishId("Patate al Forno con Rosmarino"),
    },
    {
      menuId: menuId("Menu Tradizionale Alpino"),
      dishId: dishId("Torta di Grano Saraceno e Mirtilli Rossi"),
    },

    // Menu Cacciatore Speciale
    {
      menuId: menuId("Menu Cacciatore Speciale"),
      dishId: dishId("Tagliere del Rifugio"),
    },
    {
      menuId: menuId("Menu Cacciatore Speciale"),
      dishId: dishId("Polenta con Spezzatino di Capriolo"),
    },
    {
      menuId: menuId("Menu Cacciatore Speciale"),
      dishId: dishId("Crauti Stufati"),
    },
    {
      menuId: menuId("Menu Cacciatore Speciale"),
      dishId: dishId("Grappa al Pino Cembro"),
    },
  ]);

  console.log("Successfully linked dishes to menus.");
}

main().catch((e) => {
  console.error(`Failed to seed database: ${e}`);
  process.exit(1);
});
