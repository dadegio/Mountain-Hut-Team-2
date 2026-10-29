import { usersTable } from "./schema.ts";
import { db } from "./database.ts";

async function main() {
  console.log("Seeding database...");

  db.delete(usersTable).run();

  const insertedUsers = await db
    .insert(usersTable)
    .values([
      {
        email: "mario.rossi@example.com",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: 3331234567,
        type: "HIKER",
        // createdAt: new Date(),
      },
      {
        email: "giulia.verdi@example.com",
        name: "Giulia",
        surname: "Verdi",
        phoneNumber: 3339876543,
        type: "HIKER",
      },
      {
        email: "luca.neri@example.com",
        name: "Luca",
        surname: "Neri",
        phoneNumber: 3335554433,
        type: "EMPLOYEE",
      },
    ])
    .returning();

  console.log(`Successfully inserted ${insertedUsers.length} users.`);
}

main().catch((e) => {
  console.error(`Failed to seed database: ${e}`);
  process.exit(1);
});
