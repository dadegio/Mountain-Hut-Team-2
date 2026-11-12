import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMyHikes, registerHike, getRegisteredHikes } from "../../../src/hikes/api/hikes-api.ts";
import { apiFetch } from "../../../src/shared/api/client.ts";

vi.mock("../../../src/shared/api/client.ts", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const hike = {
  id: 7,
  userId: 1,
  departureAt: "2030-06-15T06:00:00.000Z",
  expectedReturnAt: "2030-06-15T15:00:00.000Z",
  routeDescription: "Lake loop on trail 12",
  emergencyContactPhone: null,
  createdAt: "2030-06-01 10:00:00",
};

describe("MH-140 hikes API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts a new hike to /hikes and returns the saved one", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(hike);
    const request = {
      departureAt: hike.departureAt,
      expectedReturnAt: hike.expectedReturnAt,
      routeDescription: hike.routeDescription,
    };

    expect(await registerHike(request)).toEqual(hike);
    expect(apiFetch).toHaveBeenCalledWith("/hikes", {
      method: "POST",
      body: JSON.stringify(request),
    });
  });

  it("reads the hiker's own hikes from /hikes/mine", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([hike]);

    expect(await getMyHikes()).toEqual([hike]);
    expect(apiFetch).toHaveBeenCalledWith("/hikes/mine");
  });

  it("passes on the errors of the backend", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("Departure must be in the future"));

    await expect(getMyHikes()).rejects.toThrow("Departure must be in the future");
  });

  it("reads all registered hikes for staff from /hikes", async () => {
    const staffHike = { ...hike, hiker: { name: "Mario", surname: "Rossi", phoneNumber: null } };
    vi.mocked(apiFetch).mockResolvedValueOnce([staffHike]);

    expect(await getRegisteredHikes()).toEqual([staffHike]);
    expect(apiFetch).toHaveBeenCalledWith("/hikes");
  });
});