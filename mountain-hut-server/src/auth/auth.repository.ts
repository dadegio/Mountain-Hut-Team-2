import { db } from "../db/database.ts";
import { eq } from "drizzle-orm";
import { usersTable, type UserType } from "../db/schema.ts";

export interface CreateUserData {
  email: string;
  passwordHash: string;
  name: string;
  surname: string;
  phoneNumber?: string;
  type: UserType;
}

export default class AuthRepository {
  static async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return user ?? null;
  }

  static async getUserById(id: number) {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        surname: usersTable.surname,
        phone_number: usersTable.phoneNumber,
        type: usersTable.type,
      })
      .from(usersTable)
      .where(eq(usersTable.id, id))
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
