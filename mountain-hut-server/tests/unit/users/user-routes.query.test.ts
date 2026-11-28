import Fastify from "fastify";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

describe("userRoutes: query registered users by name, surname, email, phone", () => {
  async function createTestApp() {
    const app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    // Mock an authenticated employee user
    app.addHook("preHandler", async (request) => {
      request.user = {
        id: 1,
        email: "staff@hut.test",
        name: "Staff",
        surname: "Member",
        phoneNumber: "+390000000",
        type: "EMPLOYEE",
      };
    });

    await app.register(userRoutes);
    return app;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user by email and formats the response", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue({
      id: 10,
      email: "hiker@example.com",
      passwordHash: "hash123",
      name: "Mario",
      surname: "Rossi",
      phoneNumber: "+39333111222",
      type: "HIKER",
    });

    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/?email=hiker@example.com",
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(UserRepository.getUserByEmail).toHaveBeenCalledWith("hiker@example.com");
      expect(res.json()).toEqual([
        {
          id: 10,
          email: "hiker@example.com",
          name: "Mario",
          surname: "Rossi",
          phoneNumber: "+39333111222",
          type: "HIKER",
        },
      ]);
    } finally {
      await app.close();
    }
  });

  it("fetches users by name and surname", async () => {
    vi.mocked(UserRepository.getUsersByName).mockResolvedValue([
      {
        id: 11,
        email: "mario.rossi@example.com",
        passwordHash: "hash",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+39333111222",
        type: "HIKER",
      },
      {
        id: 12,
        email: "mario.rossi.2@example.com",
        passwordHash: null,
        name: "Mario",
        surname: "Rossi",
        phoneNumber: null,
        type: "TEMPORARY",
      },
    ]);

    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/?name=Mario&surname=Rossi",
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(UserRepository.getUsersByName).toHaveBeenCalledWith("Mario", "Rossi");
      const data = res.json();
      expect(data).toHaveLength(2);
      expect(data[0].type).toBe("HIKER");
      expect(data[1].type).toBe("TEMPORARY");
    } finally {
      await app.close();
    }
  });

  it("fetches user by phoneNumber", async () => {
    vi.mocked(UserRepository.getUserByPhoneNumber).mockResolvedValue({
      id: 20,
      email: null,
      passwordHash: null,
      name: "Anonymous",
      surname: null,
      phoneNumber: "+39333999888",
      type: "THROWAWAY",
    });

    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/?phoneNumber=%2B39333999888",
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(UserRepository.getUserByPhoneNumber).toHaveBeenCalledWith("+39333999888");
      expect(res.json()).toEqual([
        {
          id: 20,
          email: null,
          name: "Anonymous",
          surname: null,
          phoneNumber: "+39333999888",
          type: "THROWAWAY",
        },
      ]);
    } finally {
      await app.close();
    }
  });

  it("returns 404 when user is not found", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null);

    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/?email=nonexistent@example.com",
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual({ error: "User Not Found" });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when query has no matching name/surname results", async () => {
    vi.mocked(UserRepository.getUsersByName).mockResolvedValue([]);

    const app = await createTestApp();
    try {
      const res = await app.inject({
        method: "GET",
        url: "/?name=Unknown",
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual({ error: "User Not Found" });
    } finally {
      await app.close();
    }
  });
});
