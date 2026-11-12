import { describe, expect, it, vi } from "vitest";
import { copyWeek } from "../../../src/slots/api/slots-api.ts";
import { apiFetch } from "../../../src/shared/api/client.ts";

vi.mock("../../../src/shared/api/client.ts", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

describe("MH-129 copy-week API client", () => {
  it("sends the exact MH-125 request to the versioned endpoint", async () => {
    const response = {
      sourceWeekStart: "2099-01-12",
      targetWeekStart: "2099-01-19",
      weeks: 2,
      copiedSlots: 6,
    };
    vi.mocked(apiFetch).mockResolvedValueOnce(response);
    const request = { sourceWeekStart: response.sourceWeekStart, targetWeekStart: response.targetWeekStart, weeks: 2 };
    expect(await copyWeek(request)).toEqual(response);
    expect(apiFetch).toHaveBeenCalledWith("/slots/copy-week", {
      method: "POST", body: JSON.stringify(request),
    });
  });
});
