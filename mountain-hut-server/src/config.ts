import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => Number(val))
    .default(3000),
  DB_FILE_NAME: z.url().default("file:local.db"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters long"),
  SESSION_SALT: z
    .string()
    .length(16, "SESSION_SALT must be exactly 16 characters (16 bytes) long"),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "Couldn't parse .env file: ",
    JSON.stringify(_env.error, null, 2),
  );
  process.exit(1);
}

export const env = _env.data;
