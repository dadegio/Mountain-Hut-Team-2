import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .transform((val) => Number(val))
    .default(3000),
  DB_FILE_NAME: z.url().default("file:local.db"),

  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SMTP_USER: z.string().optional().transform((v) => v || undefined),
  SMTP_PASS: z.string().optional().transform((v) => v || undefined),
  MAIL_FROM_NAME: z.string().default("Mountain Hut"),
  MAIL_FROM_ADDRESS: z.email().default("booking@mountain-hut.test"),
  MAIL_REPLY_TO: z.string().optional().transform((v) => v || undefined),
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