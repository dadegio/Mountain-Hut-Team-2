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
  ): Promise<User[]> {
    const conditions: SQL[] = [];

    if (name.trim() !== "") {
      conditions.push(eq(sql`LOWER(${usersTable.name})`, name.toLowerCase()));
    }

    if (surname.trim() !== "") {
      conditions.push(
        eq(sql`LOWER(${usersTable.surname})`, surname.toLowerCase()),
      );
    }

    const rows = await db
      .select()
      .from(usersTable)
      .where(and(...conditions));

    return rows;
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
