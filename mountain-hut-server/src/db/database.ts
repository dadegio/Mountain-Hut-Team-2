import { drizzle } from "drizzle-orm/libsql";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config.ts";

function resolveDbUrl(dbUrl: string): string {
  if (dbUrl.startsWith("file:") && !dbUrl.startsWith("file:/")) {
    const filename = dbUrl.slice("file:".length);
    const serverDir = path.resolve(fileURLToPath(import.meta.url), "../../..");
    return `file:${path.resolve(serverDir, filename)}`;
  }
  return dbUrl;
}

export const db = drizzle(resolveDbUrl(env.DB_FILE_NAME!));
