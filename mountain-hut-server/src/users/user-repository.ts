import { db } from "../db/database.ts";
import { eq, and, SQL, type InferSelectModel, sql } from "drizzle-orm";
import { usersTable, type UserType } from "../db/schema.ts";

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
  surname: string;
  phoneNumber?: string;
  type: UserType;
}

export type User = InferSelectModel<typeof usersTable>;

export class UserRepository {
  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
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

  static async createUser(data: CreateUserData) {
    const [newUser] = await db.insert(usersTable).values(data).returning({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      surname: usersTable.surname,
      phone_number: usersTable.phoneNumber,
      type: usersTable.type,
    });
    return newUser;
  }
}
