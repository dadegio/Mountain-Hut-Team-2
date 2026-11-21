import { describe, it, expect, vi, beforeEach } from "vitest";
import argon2 from "argon2";

describe("Password Reset logic", () => {
  it("generates a 64-character hex token and hashes it", async () => {
    const { randomBytes } = await import("node:crypto");
    const plainToken = randomBytes(32).toString("hex");
    expect(plainToken).toHaveLength(64);

    const hash = await argon2.hash(plainToken);
    const matches = await argon2.verify(hash, plainToken);
    expect(matches).toBe(true);

    const wrongMatches = await argon2.verify(hash, "wrongtoken123");
    expect(wrongMatches).toBe(false);
  });

  it("checks expiration properly", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const isPastExpired = new Date(past) <= new Date();
    const isFutureExpired = new Date(future) <= new Date();

    expect(isPastExpired).toBe(true);
    expect(isFutureExpired).toBe(false);
  });
});
