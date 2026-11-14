import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/allergens/allergens.ts", () => ({
  listAllergens: vi.fn(),
}));

import { listAllergens } from "../../../src/allergens/allergens.ts";
import { allergenRoutes } from "../../../src/allergens/allergen-routes.ts";

afterEach(() => {
  vi.resetAllMocks();
});

describe("allergen-routes error response", () => {
  it("logs the service error and responds with 500", async () => {
    vi.mocked(listAllergens).mockRejectedValue(new Error("Database unavailable"));
    const app = Fastify({ logger: false });
    const logError = vi.spyOn(app.log, "error");
    await app.register(allergenRoutes);

    try {
      const response = await app.inject({
        method: "GET",
        url: "/allergens",
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: "Internal server error" });
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Database unavailable" }),
      );
    } finally {
      await app.close();
    }
  });
});
