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
import { resetTestDatabase } from "../../test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };

const { UserRepository } = await import("../../../src/users/user-repository.ts");

describe("UserRepository", () => {
  afterAll(async () => {
    cleanup();
  });

  beforeEach(async () => {
    await resetTestDatabase(client);
  });

  describe("saveUser and getUserById", () => {
    it("creates and retrieves a standard hiker account", async () => {
      const created = await UserRepository.saveUser({
        email: "hiker@test.com",
        passwordHash: "secret_hash",
        name: "Mario",
        surname: "Rossi",
        phoneNumber: "+39333111222",
        type: "HIKER",
      });

      expect(created.id).toBeDefined();
      expect(created.type).toBe("HIKER");

      const fetched = await UserRepository.getUserById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.email).toBe("hiker@test.com");
      expect(fetched?.name).toBe("Mario");
      expect(fetched?.surname).toBe("Rossi");
    });

    it("creates and retrieves a temporary account", async () => {
      const created = await UserRepository.saveUser({
        email: "temp@test.com",
        passwordHash: "temp_hash",
        name: "Anna",
        surname: "Verdi",
        phoneNumber: "+39333555666",
        type: "TEMPORARY",
      });

      expect(created.type).toBe("TEMPORARY");
      const fetched = await UserRepository.getUserById(created.id);
      expect(fetched?.type).toBe("TEMPORARY");
    });

    it("creates a throwaway account with only name and optional phone number", async () => {
      const created = await UserRepository.saveUser({
        email: null,
        passwordHash: null,
        name: "WalkIn Guest",
        surname: null,
        phoneNumber: "+39111222333",
        type: "THROWAWAY",
      });

      expect(created.id).toBeDefined();
      expect(created.name).toBe("WalkIn Guest");
      expect(created.email).toBeNull();
      expect(created.surname).toBeNull();
      expect(created.type).toBe("THROWAWAY");

      const fetched = await UserRepository.getUserById(created.id);
      expect(fetched?.type).toBe("THROWAWAY");
      expect(fetched?.email).toBeNull();
    });
  });

  describe("getUserByEmail", () => {
    it("finds a user by email", async () => {
      await UserRepository.saveUser({
        email: "search@test.com",
        passwordHash: "hash",
        name: "Elena",
        surname: "Bianchi",
        phoneNumber: null,
        type: "HIKER",
      });

      const user = await UserRepository.getUserByEmail("search@test.com");
      expect(user).not.toBeNull();
      expect(user?.name).toBe("Elena");
    });

    it("returns null for non-existing email", async () => {
      const user = await UserRepository.getUserByEmail("missing@test.com");
      expect(user).toBeNull();
    });
  });

  describe("getUsersByName", () => {
    beforeEach(async () => {
      await UserRepository.saveUser({
        email: "u1@test.com",
        passwordHash: "h1",
        name: "Marco",
        surname: "Polo",
        phoneNumber: null,
        type: "HIKER",
      });
      await UserRepository.saveUser({
        email: "u2@test.com",
        passwordHash: "h2",
        name: "Marco",
        surname: "Rossi",
        phoneNumber: null,
        type: "HIKER",
      });
      await UserRepository.saveUser({
        email: "u3@test.com",
        passwordHash: "h3",
        name: "Giulia",
        surname: "Rossi",
        phoneNumber: null,
        type: "HIKER",
      });
    });

    it("finds users by first name only (case-insensitive)", async () => {
      const results = await UserRepository.getUsersByName("marco", "");
      expect(results).toHaveLength(2);
      expect(results?.map((u) => u.surname).sort()).toEqual(["Polo", "Rossi"]);
    });

    it("finds users by surname only", async () => {
      const results = await UserRepository.getUsersByName("", "rossi");
      expect(results).toHaveLength(2);
      expect(results?.map((u) => u.name).sort()).toEqual(["Giulia", "Marco"]);
    });

    it("finds exact match for both name and surname", async () => {
      const results = await UserRepository.getUsersByName("Marco", "Polo");
      expect(results).toHaveLength(1);
      expect(results?.[0].email).toBe("u1@test.com");
    });

    it("returns null when neither name nor surname is given", async () => {
      const results = await UserRepository.getUsersByName("   ", "   ");
      expect(results).toBeNull();
    });
  });

  describe("getUserByPhoneNumber", () => {
    it("finds a user by phone number", async () => {
      await UserRepository.saveUser({
        email: "phone@test.com",
        passwordHash: "h",
        name: "Luca",
        surname: "Neri",
        phoneNumber: "+393401234567",
        type: "HIKER",
      });

      const user = await UserRepository.getUserByPhoneNumber("+393401234567");
      expect(user).not.toBeNull();
      expect(user?.email).toBe("phone@test.com");
    });

    it("returns null when phone number does not match", async () => {
      const user = await UserRepository.getUserByPhoneNumber("+390000000000");
      expect(user).toBeNull();
    });
  });

  describe("updateUser (change user account information)", () => {
    it("updates user fields and promotes temporary user", async () => {
      const user = await UserRepository.saveUser({
        email: "temp@hut.test",
        passwordHash: "temp_hash",
        name: "Temp",
        surname: "User",
        phoneNumber: "+39111",
        type: "TEMPORARY",
      });

      const success = await UserRepository.updateUser(user.id, {
        email: "temp@hut.test",
        passwordHash: "new_secure_hash",
        name: "UpdatedName",
        surname: "UpdatedSurname",
        phoneNumber: "+39222",
        type: "HIKER", // promoted
      });

      expect(success).toBe(true);

      const updated = await UserRepository.getUserById(user.id);
      expect(updated?.name).toBe("UpdatedName");
      expect(updated?.surname).toBe("UpdatedSurname");
      expect(updated?.phoneNumber).toBe("+39222");
      expect(updated?.type).toBe("HIKER");
      expect(updated?.passwordHash).toBe("new_secure_hash");
    });

    it("returns false when updating non-existent user", async () => {
      const success = await UserRepository.updateUser(99999, {
        email: "nope@test.com",
        passwordHash: "h",
        name: "Ghost",
        surname: null,
        phoneNumber: null,
        type: "THROWAWAY",
      });

      expect(success).toBe(false);
    });
  });
});
