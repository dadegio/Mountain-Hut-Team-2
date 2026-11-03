import {
  usersTable,
  tablesTable,
  timeSlotTable,
  tableAvailabilityTable,
  reservationsTable,
} from "./schema.ts";
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
  await db.delete(reservationsTable);
  await db.delete(tableAvailabilityTable);
  await db.delete(timeSlotTable);
  await db.delete(tablesTable);
  await db.delete(usersTable);

  const insertedUsers = await db
    .insert(usersTable)
    .values([
      {
        email: "mario.rossi@example.com",
        passwordHash:
          "$argon2id$v=19$m=65536,p=4,t=3$IBNUxTebRIza6FaSgh9hAg$/f0tf4M/7dGqBiPeW2kHbl8HjxZaoC7vEnog03X2ZdM",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+393331234567",
      },
      {
        email: "giulia.verdi@example.com",
        passwordHash:
          "$argon2id$v=19$m=65536,p=4,t=3$XkzEBkjCbMbjvjZ/5o8x3Q$+LsVAXAz2h/rUqAHOg2xJtZCgOnJJIpFRiH8gVscCVw",
        name: "Giulia",
        surname: "Verdi",
        phoneNumber: "+393339876543",
        type: "HIKER",
      },
      {
        email: "luca.neri@example.com",
        passwordHash:
          "$argon2id$v=19$m=65536,p=4,t=3$2eIkRe17LgnjfnIsFU9Dpw$e+yhlsOoFJyIg15S9P8/lWzvkuxnrzbqnk7It4iRcXk",
        name: "Luca",
        surname: "Neri",
        phoneNumber: "+393335554433",
        type: "EMPLOYEE",
      },
    ])
    .returning();

  console.log(`Successfully inserted ${insertedUsers.length} users.`);

  const insertedTables = await db
    .insert(tablesTable)
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
    .insert(timeSlotTable)
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
  await db.insert(tableAvailabilityTable).values(
    insertedSlots.flatMap((slot, i) =>
      slotTables[i].map((code) => ({
        slotId: slot.id,
        tableId: tableId(code),
      })),
    ),
  );

  console.log(`Successfully inserted ${insertedSlots.length} time slots.`);

  const hiker = insertedUsers.find((u) => u.type === "HIKER")!;
  await db.insert(reservationsTable).values({
    userId: hiker.id,
    slotId: insertedSlots[0].id,
    tableId: tableId("T3"),
    partySize: 3,
  });

  console.log("Successfully inserted 1 reservation.");
}

main().catch((e) => {
  console.error(`Failed to seed database: ${e}`);
  process.exit(1);
});
