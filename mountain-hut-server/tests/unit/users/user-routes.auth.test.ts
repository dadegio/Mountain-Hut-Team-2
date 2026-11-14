import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { StatusCodes } from "http-status-codes";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { userRoutes } from "../../../src/users/user-routes.ts";
import { UserRepository } from "../../../src/users/user-repository.ts";

vi.mock("../../../src/users/user-repository.ts", () => ({
  UserRepository: {
    getUsersByName: vi.fn(),
    getUserByEmail: vi.fn(),
    getUserByPhoneNumber: vi.fn(),
  },
}));

describe("userRoutes authentication and authorization", () => {
  async function createTestApp(user: any = null) {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    app.addHook("preHandler", async (request) => {
      request.user = user;
    });

    await app.register(userRoutes);
    return app;
  }

  it("returns 401 when user is not authenticated", async () => {
    const app = await createTestApp(null);
    try {
      const response = await app.inject({
        method: "GET",
        url: "/?email=test@example.com",
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.json()).toEqual({ message: "Authentication required" });
    } finally {
      await app.close();
    }
  });

  it("returns 403 when user is a HIKER", async () => {
    const app = await createTestApp({
      id: 1,
      email: "hiker@example.com",
      name: "Hiker",
      surname: "User",
      phoneNumber: "123456789",
      type: "HIKER",
    });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/?email=test@example.com",
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual({
        message: "Forbidden: insufficient permissions",
      });
    } finally {
      await app.close();
    }
  });

  it("allows access when user is an EMPLOYEE", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
      id: 2,
      email: "hiker@example.com",
      name: "Hiker",
      surname: "User",
      phoneNumber: "123456789",
      passwordHash: "hash",
      type: "HIKER",
    });

    const app = await createTestApp({
      id: 3,
      email: "employee@example.com",
      name: "Employee",
      surname: "User",
      phoneNumber: "123456789",
      type: "EMPLOYEE",
    });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/?email=hiker@example.com",
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toEqual([
        expect.objectContaining({ email: "hiker@example.com" }),
      ]);
    } finally {
      await app.close();
    }
  });

  it("allows access when user is a MANAGER", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
      id: 2,
      email: "hiker@example.com",
      name: "Hiker",
      surname: "User",
      phoneNumber: "123456789",
      passwordHash: "hash",
      type: "HIKER",
    });

    const app = await createTestApp({
      id: 4,
      email: "manager@example.com",
      name: "Manager",
      surname: "User",
      phoneNumber: "123456789",
      type: "MANAGER",
    });
    try {
      const response = await app.inject({
        method: "GET",
        url: "/?email=hiker@example.com",
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toEqual([
        expect.objectContaining({ email: "hiker@example.com" }),
      ]);
    } finally {
      await app.close();
    }
  });
});
