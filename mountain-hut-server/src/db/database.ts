import { drizzle } from "drizzle-orm/libsql";
import { env } from "../config.ts";

export const db = drizzle(env.DB_FILE_NAME!);
