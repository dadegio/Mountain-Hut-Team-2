import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { eq, type InferSelectModel } from "drizzle-orm";
import { db } from "../db/database.ts";
import { passwordResetTokensTable } from "../db/schema.ts";

const TOKEN_EXPIRY_MINUTES = 24 * 60; // 24 hours per NIST guidelines

export type PasswordResetToken = InferSelectModel<
  typeof passwordResetTokensTable
>;

export const PasswordResetRepository = {
  /**
   * Generates a plain-text token, stores its hash in the DB,
   * and returns the plain-text token to be emailed to the user.
   */
  async createToken(userId: number): Promise<string> {
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = await argon2.hash(plainToken);

    const expiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString();

    // Invalidate any previous token for this user
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, userId));

    await db.insert(passwordResetTokensTable).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return plainToken;
  },

  /**
   * Finds a valid (non-expired) token row that matches the plain-text token.
   * Returns null if not found or expired.
   */
  async findValidToken(plainToken: string): Promise<PasswordResetToken | null> {
    const rows = await db.select().from(passwordResetTokensTable).all();

    for (const row of rows) {
      const matches = await argon2.verify(row.tokenHash, plainToken);
      if (!matches) continue;

      const expired = new Date(row.expiresAt) <= new Date();
      if (expired) return null;

      return row;
    }

    return null;
  },

  async deleteByUserId(userId: number): Promise<void> {
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, userId));
  },
};
