import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import {
  usersTable,
  passwordResetTokensTable,
} from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";
import { emailSender } from "../../../src/notifications/sender.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

// Mock email sending
vi.spyOn(emailSender, "send").mockResolvedValue(undefined);

const { db: testDb } = await import("../../../src/db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };

const { buildApp } = await import("../../../src/server.ts");
const app = buildApp({ logger: false });

describe("Password Reset Integration Flow", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    cleanup();
  });

  beforeEach(async () => {
    await resetTestDatabase(client);
    vi.clearAllMocks();
  });

  it("completes the forgot password and reset password flow end-to-end", async () => {
    const passwordHash = await argon2.hash("oldpassword123");
    const [user] = await testDb
      .insert(usersTable)
      .values({
        email: "hiker@test.com",
        passwordHash,
        name: "Mario",
        surname: "Rossi",
        type: "HIKER",
      })
      .returning();

    // 1. Request password reset
    const forgotRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email: "hiker@test.com" },
    });

    expect(forgotRes.statusCode).toBe(200);
    expect(emailSender.send).toHaveBeenCalledTimes(1);

    // Check token was stored in DB
    const tokens = await testDb
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, user.id));
    expect(tokens).toHaveLength(1);

    // Extract the token passed to emailSender
    const callArgs = vi.mocked(emailSender.send).mock.calls[0][0];
    const match = callArgs.text.match(/token=([a-f0-9]+)/);
    expect(match).not.toBeNull();
    const plainToken = match![1];

    // 2. Reset password with that token
    const resetRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: {
        token: plainToken,
        newPassword: "brandnewpassword456",
      },
    });

    expect(resetRes.statusCode).toBe(200);

    // Confirmation email should have been sent
    expect(emailSender.send).toHaveBeenCalledTimes(2);
    const confirmationCall = vi.mocked(emailSender.send).mock.calls[1][0];
    expect(confirmationCall.to).toBe("hiker@test.com");
    expect(confirmationCall.subject).toContain("Password changed successfully");
    expect(confirmationCall.text).toContain(
      "Your password has been changed successfully.",
    );

    // Token should now be consumed/deleted
    const remainingTokens = await testDb
      .select()
      .from(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, user.id));
    expect(remainingTokens).toHaveLength(0);

    // Verify user can log in with new password
    const [updatedUser] = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id));
    const valid = await argon2.verify(
      updatedUser.passwordHash ?? "",
      "brandnewpassword456",
    );
    expect(valid).toBe(true);

    const oldValid = await argon2.verify(
      updatedUser.passwordHash ?? "",
      "oldpassword123",
    );
    expect(oldValid).toBe(false);
  });

  it("returns 400 when attempting to reuse the old password", async () => {
    const passwordHash = await argon2.hash("currentSecret123");
    const [user] = await testDb
      .insert(usersTable)
      .values({
        email: "hiker2@test.com",
        passwordHash,
        name: "Luigi",
        surname: "Bianchi",
        type: "HIKER",
      })
      .returning();

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email: "hiker2@test.com" },
    });

    const callArgs = vi.mocked(emailSender.send).mock.calls[0][0];
    const match = callArgs.text.match(/token=([a-f0-9]+)/);
    const plainToken = match![1];

    const resetRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: {
        token: plainToken,
        newPassword: "currentSecret123",
      },
    });

    expect(resetRes.statusCode).toBe(400);
    expect(JSON.parse(resetRes.body).error).toBe(
      "For safety reasons, you cannot change the password to your old one.",
    );
  });

  it("returns 400 when reset token is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/reset-password",
      payload: {
        token: "completely-invalid-token",
        newPassword: "brandnewpassword456",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe(
      "Invalid or expired reset token.",
    );
  });

  it("returns 200 on forgot password even if email does not exist (privacy)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      payload: { email: "nonexistent@test.com" },
    });

    expect(res.statusCode).toBe(200);
    expect(emailSender.send).not.toHaveBeenCalled();
  });
});
