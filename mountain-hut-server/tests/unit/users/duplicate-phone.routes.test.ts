import Fastify, { type FastifyRequest } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/users/user-repository.ts", () => ({
  UserRepository: {
    getUserByEmail: vi.fn(),
    getUserByPhoneNumber: vi.fn(),
    getUsersByName: vi.fn(),
    getUserById: vi.fn(),
    saveUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

import { UserRepository } from "../../../src/users/user-repository.ts";
import { authRoutes } from "../../../src/auth/auth-routes.ts";
import { userRoutes } from "../../../src/users/user-routes.ts";

const existingHiker = {
  id: 1,
  email: "mario.rossi@example.com",
  passwordHash: "hash",
  name: "Mario",
  surname: "Rossi",
  phoneNumber: "+393331234567",
  type: "HIKER",
};

const newHiker = {
  email: " NEW.Hiker@Example.com ",
  password: "password123",
  name: "Anna",
  surname: "Bianchi",
  phoneNumber: "+39 333 999 8888",
};

let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.resetAllMocks();
  app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const role = request.headers["x-test-role"];
    if (typeof role === "string") {
      request.user = { id: 9, type: role } as FastifyRequest["user"];
    }
  });
  await app.register(authRoutes);
  await app.register(userRoutes, { prefix: "/users" });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe("MH-183 register", () => {
  it("stores the email in lowercase and the phone without spaces", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null as never);
    vi.mocked(UserRepository.getUserByPhoneNumber).mockResolvedValue(null as never);
    vi.mocked(UserRepository.saveUser).mockResolvedValue({
      ...existingHiker,
      id: 2,
      email: "new.hiker@example.com",
      phoneNumber: "+393339998888",
    } as never);

    const response = await app.inject({ method: "POST", url: "/register", payload: newHiker });

    expect(response.statusCode).toBe(201);
    expect(UserRepository.getUserByEmail).toHaveBeenCalledWith("new.hiker@example.com");
    expect(UserRepository.saveUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new.hiker@example.com", phoneNumber: "+393339998888" }),
    );
  });

  it("rejects a phone number that is already registered", async () => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null as never);
    vi.mocked(UserRepository.getUserByPhoneNumber).mockResolvedValue(existingHiker as never);

    const response = await app.inject({
      method: "POST",
      url: "/register",
      payload: { ...newHiker, phoneNumber: "+39 333 123 4567" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "An account with this phone number already exists" });
    expect(UserRepository.saveUser).not.toHaveBeenCalled();
  });

  it("rejects a name made only of spaces", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/register",
      payload: { ...newHiker, name: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(UserRepository.saveUser).not.toHaveBeenCalled();
  });
});

describe("MH-183 staff creating accounts", () => {
  it.each([
    { type: "TEMPORARY", name: "Anna", surname: "Bianchi", email: "anna@example.com", phoneNumber: "+39 333 123 4567" },
    { type: "THROWAWAY", name: "Anna", phoneNumber: "+39 333 123 4567" },
  ])("rejects a $type account with a phone number already registered", async (body) => {
    vi.mocked(UserRepository.getUserByEmail).mockResolvedValue(null as never);
    vi.mocked(UserRepository.getUserByPhoneNumber).mockResolvedValue(existingHiker as never);

    const response = await app.inject({
      method: "POST",
      url: "/users",
      headers: { "x-test-role": "EMPLOYEE" },
      payload: body,
    });

    expect(response.statusCode).toBe(409);
    expect(UserRepository.saveUser).not.toHaveBeenCalled();
  });
});