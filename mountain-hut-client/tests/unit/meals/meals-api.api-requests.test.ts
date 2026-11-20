import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMeals } from "../../../src/meals/api/meals-api.ts";
import { apiFetch } from "../../../src/shared/api/client.ts";

vi.mock("../../../src/shared/api/client.ts", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

describe("MH-134 meals API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads the meals of a day from /meals", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);

    expect(await getMeals("2026-11-21")).toEqual([]);
    expect(apiFetch).toHaveBeenCalledWith("/meals?date=2026-11-21");
  });

  it("passes on the errors of the backend", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("API error 500"));

    await expect(getMeals("2026-11-21")).rejects.toThrow("API error 500");
  });
});