import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const serverDir = path.resolve(fileURLToPath(import.meta.url), "../..");
dotenv.config({ path: path.resolve(serverDir, ".env") });
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => Number(val))
    .default(3000),
  DB_FILE_NAME: z.url().default("file:local.db"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters long")
    .default("gristle9-flagship-savior-starting-charting"),
  SESSION_SALT: z
    .string()
    .length(16, "SESSION_SALT must be exactly 16 characters (16 bytes) long")
    .default("5Mk0vhGuVqBXYSdH"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  SMTP_PASS: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  MAIL_FROM_NAME: z.string().default("Mountain Hut"),
  MAIL_FROM_ADDRESS: z.email().default("booking@mountain-hut.test"),
  MAIL_REPLY_TO: z.string().optional().transform((v) => v || undefined),
  APP_URL: z.url().default("http://localhost:5173"),
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

export const mailConfig = {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  user: env.SMTP_USER,
  pass: env.SMTP_PASS,
  from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`,
  replyTo: env.MAIL_REPLY_TO,
};
