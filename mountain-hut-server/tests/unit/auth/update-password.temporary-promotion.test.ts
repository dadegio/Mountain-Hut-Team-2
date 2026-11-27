import Fastify from "fastify";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StatusCodes } from "http-status-codes";
import argon2 from "argon2";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { authRoutes } from "../../../src/auth/auth-routes.ts";
import { UserRepository } from "../../../src/users/user-repository.ts";
import { PasswordResetRepository } from "../../../src/auth/auth-repository.ts";
import { emailSender } from "../../../src/notifications/sender.ts";

vi.mock("../../../src/users/user-repository.ts", () => ({
  UserRepository: {
    getUserByEmail: vi.fn(),
    saveUser: vi.fn(),
    getUserById: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("../../../src/auth/auth-repository.ts", () => ({
  PasswordResetRepository: {
    createToken: vi.fn(),
    findValidToken: vi.fn(),
    deleteByUserId: vi.fn(),
  },
}));

vi.mock("../../../src/notifications/sender.ts", () => ({
  emailSender: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("argon2", () => ({
  default: {
    hash: vi.fn(async (pw: string) => `new_hash_${pw}`),
    verify: vi.fn(async (h: string, p: string) => h === `new_hash_${p}`),
  },
}));

describe("API call to change user account information: POST /reset-password", () => {
  async function createTestApp() {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(authRoutes);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates password, promotes TEMPORARY user to HIKER, and deletes the token", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(PasswordResetRepository.findValidToken).mockResolvedValue({
        id: 1,
        userId: 42,
        tokenHash: "token_hash",
        createdAt: "2099-01-01T00:00:00.000Z",
        expiresAt: "2099-01-02T00:00:00.000Z",
      });

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 42,
        email: "temp@example.com",
        passwordHash: "old_temporary_hash",
        name: "Temporary",
        surname: "Hiker",
        phoneNumber: "+39111222333",
        type: "TEMPORARY",
      });

      vi.mocked(UserRepository.updateUser).mockResolvedValue(true);

      const res = await app.inject({
        method: "POST",
        url: "/reset-password",
        payload: {
          token: "valid-plain-token",
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual({ message: "Password reset successfully." });
      expect(argon2.hash).toHaveBeenCalledWith("BrandNewPassword123!");
      expect(PasswordResetRepository.deleteByUserId).toHaveBeenCalledWith(42);

      // Verify user promotion to HIKER and updated hash
      expect(UserRepository.updateUser).toHaveBeenCalledWith(42, {
        id: 42,
        email: "temp@example.com",
        passwordHash: "new_hash_BrandNewPassword123!",
        name: "Temporary",
        surname: "Hiker",
        phoneNumber: "+39111222333",
        type: "HIKER", // Promoted!
      });

      // Verify security confirmation email is sent
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "temp@example.com",
          subject: "Mountain Hut — Password changed successfully",
          text: expect.stringContaining(
            "Your password has been changed successfully.",
          ),
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("updates password for a standard HIKER without changing type", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(PasswordResetRepository.findValidToken).mockResolvedValue({
        id: 2,
        userId: 50,
        tokenHash: "token_hash",
        createdAt: "2099-01-01T00:00:00.000Z",
        expiresAt: "2099-01-02T00:00:00.000Z",
      });

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 50,
        email: "regular@example.com",
        passwordHash: "old_hash",
        name: "Regular",
        surname: "User",
        phoneNumber: "+39123456",
        type: "HIKER",
      });

      vi.mocked(UserRepository.updateUser).mockResolvedValue(true);

      const res = await app.inject({
        method: "POST",
        url: "/reset-password",
        payload: {
          token: "valid-plain-token",
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(UserRepository.updateUser).toHaveBeenCalledWith(
        50,
        expect.objectContaining({
          type: "HIKER",
          passwordHash: "new_hash_BrandNewPassword123!",
        }),
      );
      expect(PasswordResetRepository.deleteByUserId).toHaveBeenCalledWith(50);
    } finally {
      await app.close();
    }
  });

  it("rejects password reuse with 400 Bad Request if user provides their existing password", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(PasswordResetRepository.findValidToken).mockResolvedValue({
        id: 3,
        userId: 42,
        tokenHash: "token_hash",
        createdAt: "2099-01-01T00:00:00.000Z",
        expiresAt: "2099-01-02T00:00:00.000Z",
      });

      vi.mocked(UserRepository.getUserById).mockResolvedValue({
        id: 42,
        email: "hiker@example.com",
        passwordHash: "new_hash_CurrentSecretPassword123",
        name: "Hiker",
        surname: "Explorer",
        phoneNumber: "+39111222333",
        type: "HIKER",
      });

      const res = await app.inject({
        method: "POST",
        url: "/reset-password",
        payload: {
          token: "valid-plain-token",
          newPassword: "CurrentSecretPassword123",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({
        error:
          "For safety reasons, you cannot change the password to your old one.",
      });
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
      expect(PasswordResetRepository.deleteByUserId).not.toHaveBeenCalled();
      expect(emailSender.send).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request when token is invalid or expired", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(PasswordResetRepository.findValidToken).mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/reset-password",
        payload: {
          token: "invalid-token",
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({
        error: "Invalid or expired reset token.",
      });
      expect(UserRepository.getUserById).not.toHaveBeenCalled();
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 Bad Request when user does not exist", async () => {
    const app = await createTestApp();
    try {
      vi.mocked(PasswordResetRepository.findValidToken).mockResolvedValue({
        id: 4,
        userId: 9999,
        tokenHash: "token_hash",
        createdAt: "2099-01-01T00:00:00.000Z",
        expiresAt: "2099-01-02T00:00:00.000Z",
      });

      vi.mocked(UserRepository.getUserById).mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/reset-password",
        payload: {
          token: "valid-token",
          newPassword: "BrandNewPassword123!",
        },
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual({ error: "User not found." });
      expect(UserRepository.updateUser).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
