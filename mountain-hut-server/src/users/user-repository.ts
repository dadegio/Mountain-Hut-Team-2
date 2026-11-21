import { db } from "../db/database.ts";
import { eq, and, SQL, type InferSelectModel, sql } from "drizzle-orm";
import { usersTable, type UserType } from "../db/schema.ts";

export interface UserData {
  email: string | null;
  passwordHash: string | null;
  name: string;
  surname: string | null;
  phoneNumber: string | null;
  type: UserType;
}

export type User = InferSelectModel<typeof usersTable>;

export class UserRepository {
  static async getUserByEmail(email: string): Promise<User | null> {
    const cleanEmail = email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(sql`LOWER(${usersTable.email})`, cleanEmail))
      .limit(1);
    return user ?? null;
  }

  static async getUserById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return user ?? null;
  }

  static async getUsersByName(
    name: string = "",
    surname: string = "",
  ): Promise<User[] | null> {
    const cleanName = name.trim().toLowerCase();
    const cleanSurname = surname.trim().toLowerCase();

    const conditions: SQL[] = [
      ...(cleanName ? [eq(sql`LOWER(${usersTable.name})`, cleanName)] : []),
      ...(cleanSurname
        ? [eq(sql`LOWER(${usersTable.surname})`, cleanSurname)]
        : []),
    ];

    if (conditions.length === 0) {
      return null;
    }

    return db
      .select()
      .from(usersTable)
      .where(and(...conditions));
  }

  static async getUserByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phoneNumber, phoneNumber))
      .limit(1);
    return user ?? null;
  }

  static async saveUser(data: UserData): Promise<User> {
    const [newUser] = await db.insert(usersTable).values(data).returning();
    return newUser;
  }

  static async updatePasswordHash(
    userId: number,
    passwordHash: string,
  ): Promise<void> {
    await db
      .update(usersTable)
      .set({ passwordHash })
      .where(eq(usersTable.id, userId));
  }

  static async updateUser(userId: number, newData: UserData): Promise<boolean> {
    const [updated] = await db
      .update(usersTable)
      .set(newData)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    return Boolean(updated);
  }
}
