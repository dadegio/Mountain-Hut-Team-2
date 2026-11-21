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
    createToken: vi.fn().mockResolvedValue("mocked_reset_token_12345"),
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
    hash: vi.fn(async (pw: string) => `hashed_${pw}`),
    verify: vi.fn(async (hash: string, plain: string) => hash === `hashed_${plain}`),
  },
}));

describe("Account creation API: standard, temporary, and throwaway accounts", () => {
  async function createTestApp() {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.addHook("preHandler", async (req) => {
      (req as any).session = {
        set: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      };
    });

    await app.register(authRoutes);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Standard Account (HIKER)", () => {
    it("creates a standard hiker account with password hashing", async () => {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null);
      vi.mocked(UserRepository.saveUser).mockImplementation(async (data) => ({
        id: 101,
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        surname: data.surname,
        phoneNumber: data.phoneNumber,
        type: data.type,
      }));

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "HIKER",
            name: "Giulia",
            surname: "Verdi",
            email: "giulia@example.com",
            phoneNumber: "+39333000111",
            password: "password123",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.CREATED);
        expect(argon2.hash).toHaveBeenCalledWith("password123");
        expect(UserRepository.saveUser).toHaveBeenCalledWith({
          email: "giulia@example.com",
          passwordHash: "hashed_password123",
          name: "Giulia",
          surname: "Verdi",
          phoneNumber: "+39333000111",
          type: "HIKER",
        });
        expect(res.json()).toEqual({
          id: 101,
          email: "giulia@example.com",
          name: "Giulia",
          surname: "Verdi",
          phoneNumber: "+39333000111",
          type: "HIKER",
        });
      } finally {
        await app.close();
      }
    });

    it("returns 409 Conflict if email already exists", async () => {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
        id: 99,
        email: "existing@example.com",
        passwordHash: "hash",
        name: "Existing",
        surname: "User",
        phoneNumber: null,
        type: "HIKER",
      });

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "HIKER",
            name: "New",
            surname: "User",
            email: "existing@example.com",
            phoneNumber: "+39111",
            password: "password123",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.CONFLICT);
        expect(res.json()).toEqual({ message: "An account with this email already exists" });
        expect(UserRepository.saveUser).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });

  describe("Temporary Accounts (created by employee)", () => {
    it("creates a temporary account with an automatically generated password", async () => {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null);
      vi.mocked(UserRepository.saveUser).mockImplementation(async (data) => ({
        id: 202,
        email: data.email,
        passwordHash: data.passwordHash,
        name: data.name,
        surname: data.surname,
        phoneNumber: data.phoneNumber,
        type: data.type,
      }));

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "TEMPORARY",
            name: "Paolo",
            surname: "Bianchi",
            email: "paolo.temp@example.com",
            phoneNumber: "+39333444555",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.CREATED);

        // Verify that argon2 was called with generated password containing PaoloBianchi
        expect(argon2.hash).toHaveBeenCalledWith(
          expect.stringMatching(/^PaoloBianchi\d{3}$/),
        );

        expect(UserRepository.saveUser).toHaveBeenCalledWith({
          email: "paolo.temp@example.com",
          passwordHash: expect.stringMatching(/^hashed_PaoloBianchi\d{3}$/),
          name: "Paolo",
          surname: "Bianchi",
          phoneNumber: "+39333444555",
          type: "TEMPORARY",
        });

        const body = res.json();
        expect(body.id).toBe(202);
        expect(body.type).toBe("TEMPORARY");
        expect(body.email).toBe("paolo.temp@example.com");
        expect(body.temporaryPassword).toMatch(/^PaoloBianchi\d{3}$/);

        // Verify password reset token was created for user 202
        expect(PasswordResetRepository.createToken).toHaveBeenCalledWith(202);

        // Verify setup email with temporary password and reset link was sent
        expect(emailSender.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "paolo.temp@example.com",
            subject: "Mountain Hut — Your temporary password and setup link",
            text: expect.stringContaining(body.temporaryPassword),
          }),
        );
      } finally {
        await app.close();
      }
    });
  });

  describe("Throwaway Accounts (name and optional phone number)", () => {
    it("creates a throwaway account with only name and valid user_id", async () => {
      vi.mocked(UserRepository.saveUser).mockResolvedValue({
        id: 303,
        email: null,
        passwordHash: null,
        name: "Quick Booking Guest",
        surname: null,
        phoneNumber: null,
        type: "THROWAWAY",
      });

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "THROWAWAY",
            name: "Quick Booking Guest",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.CREATED);
        // Password hash must NOT be called for throwaway accounts
        expect(argon2.hash).not.toHaveBeenCalled();

        expect(UserRepository.saveUser).toHaveBeenCalledWith({
          email: null,
          passwordHash: null,
          name: "Quick Booking Guest",
          surname: null,
          phoneNumber: null,
          type: "THROWAWAY",
        });

        expect(res.json()).toEqual({
          id: 303,
          email: null,
          name: "Quick Booking Guest",
          surname: null,
          phoneNumber: null,
          type: "THROWAWAY",
        });
      } finally {
        await app.close();
      }
    });

    it("creates a throwaway account with name and phone number", async () => {
      vi.mocked(UserRepository.saveUser).mockResolvedValue({
        id: 304,
        email: null,
        passwordHash: null,
        name: "John",
        surname: null,
        phoneNumber: "+39333888777",
        type: "THROWAWAY",
      });

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "THROWAWAY",
            name: "John",
            phoneNumber: "+39333888777",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.CREATED);
        expect(res.json()).toEqual({
          id: 304,
          email: null,
          name: "John",
          surname: null,
          phoneNumber: "+39333888777",
          type: "THROWAWAY",
        });
      } finally {
        await app.close();
      }
    });

    it("rejects throwaway account registration if name is missing", async () => {
      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/register",
          payload: {
            type: "THROWAWAY",
            name: "",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      } finally {
        await app.close();
      }
    });
  });

  describe("Login flow for TEMPORARY accounts", () => {
    it("sends password reset email on login when user is TEMPORARY", async () => {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
        id: 501,
        email: "temp@example.com",
        passwordHash: "hashed_temppass123",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+39333111222",
        type: "TEMPORARY",
      });

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/login",
          payload: {
            email: "temp@example.com",
            password: "temppass123",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(PasswordResetRepository.createToken).toHaveBeenCalledWith(501);
        expect(emailSender.send).toHaveBeenCalledWith(
          expect.objectContaining({
            to: "temp@example.com",
            subject: "Mountain Hut — Set your password",
          }),
        );
      } finally {
        await app.close();
      }
    });

    it("does not send email on login when user is HIKER", async () => {
      vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
        id: 502,
        email: "hiker@example.com",
        passwordHash: "hashed_mypassword",
        name: "Luigi",
        surname: "Verdi",
        phoneNumber: "+39333999888",
        type: "HIKER",
      });

      const app = await createTestApp();
      try {
        const res = await app.inject({
          method: "POST",
          url: "/login",
          payload: {
            email: "hiker@example.com",
            password: "mypassword",
          },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(emailSender.send).not.toHaveBeenCalled();
      } finally {
        await app.close();
      }
    });
  });
});
