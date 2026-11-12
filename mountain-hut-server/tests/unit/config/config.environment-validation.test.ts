import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("dotenv", () => ({
  default: { config: vi.fn() },
}));

const configuredVariables = [
  "PORT",
  "DB_FILE_NAME",
  "SESSION_SECRET",
  "SESSION_SALT",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "MAIL_FROM_NAME",
  "MAIL_FROM_ADDRESS",
  "MAIL_REPLY_TO",
] as const;

const savedVariables = new Map(
  configuredVariables.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of configuredVariables) {
    const value = savedVariables.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("config environment validation", () => {
  it("uses documented defaults and normalizes optional mail settings", async () => {
    for (const name of configuredVariables) delete process.env[name];
    process.env.SESSION_SECRET = "a".repeat(32);
    process.env.SESSION_SALT = "1234567890123456";

    const { env, mailConfig } = await import("../../../src/config.ts");

    expect(env.PORT).toBe(3000);
    expect(env.DB_FILE_NAME).toBe("file:local.db");
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.SMTP_USER).toBeUndefined();
    expect(env.SMTP_PASS).toBeUndefined();
    expect(env.MAIL_REPLY_TO).toBeUndefined();
    expect(mailConfig.from).toBe('"Mountain Hut" <booking@mountain-hut.test>');
  });

  it("coerces explicit SMTP settings and builds mail configuration", async () => {
    for (const name of configuredVariables) delete process.env[name];
    Object.assign(process.env, {
      PORT: "3100",
      DB_FILE_NAME: "file:custom.db",
      SESSION_SECRET: "b".repeat(32),
      SESSION_SALT: "abcdefghijklmnop",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_SECURE: "true",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      MAIL_FROM_NAME: "Hut",
      MAIL_FROM_ADDRESS: "booking@example.test",
      MAIL_REPLY_TO: "reply@example.test",
    });

    const { env, mailConfig } = await import("../../../src/config.ts");

    expect(env).toMatchObject({
      PORT: 3100,
      DB_FILE_NAME: "file:custom.db",
      SMTP_PORT: 587,
      SMTP_SECURE: true,
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      MAIL_REPLY_TO: "reply@example.test",
    });
    expect(mailConfig).toMatchObject({
      host: "smtp.example.test",
      secure: true,
      user: "mailer",
      pass: "secret",
      from: '"Hut" <booking@example.test>',
      replyTo: "reply@example.test",
    });
  });

  it("logs validation errors and exits for invalid environment values", async () => {
    for (const name of configuredVariables) delete process.env[name];
    process.env.SESSION_SECRET = "c".repeat(32);
    process.env.SESSION_SALT = "abcdefghijklmnop";
    process.env.SMTP_PORT = "0";
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);

    await expect(import("../../../src/config.ts")).rejects.toThrow();

    expect(logError).toHaveBeenCalledWith(
      "Couldn't parse .env file: ",
      expect.stringContaining("SMTP_PORT"),
    );
    expect(exit).toHaveBeenCalledWith(1);
  });
});
