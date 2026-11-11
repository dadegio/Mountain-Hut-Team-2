import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/booking/availability.ts", () => ({
  getAvailability: vi.fn(),
}));

import { getAvailability } from "../../../src/booking/availability.ts";
import { availabilityRoutes } from "../../../src/booking/availability-routes.ts";

const mockedGetAvailability = vi.mocked(getAvailability);

async function createApp() {
  const app = Fastify({ logger: false });
  await app.register(availabilityRoutes);
  return app;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("availability-routes query behavior", () => {
  it.each([
    ["malformed date", "not-a-date"],
    ["impossible calendar date", "2026-02-30"],
  ])("rejects a %s", async (_description, date) => {
    const app = await createApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/availability?date=${date}`,
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Invalid query parameters",
      });
      expect(mockedGetAvailability).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each(["0", "-1", "1.5", "1001"])("rejects partySize=%s", async (partySize) => {
    const app = await createApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/availability?date=2026-11-06&partySize=${partySize}`,
      });

      expect(response.statusCode).toBe(400);
      expect(mockedGetAvailability).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("uses the default party size and returns all date slots", async () => {
    const availability = {
      date: "2026-11-06",
      partySize: 1,
      slots: [{ slotId: 7, from: "12:00", to: "13:00" }],
    };
    mockedGetAvailability.mockResolvedValue(availability as Awaited<ReturnType<typeof getAvailability>>);
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/availability?date=2026-11-06",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(availability);
      expect(mockedGetAvailability).toHaveBeenCalledWith("2026-11-06", 1);
    } finally {
      await app.close();
    }
  });

  it("returns only the requested slot", async () => {
    const availability = {
      date: "2026-11-06",
      partySize: 2,
      slots: [
        { slotId: 7, from: "12:00", to: "13:00" },
        { slotId: 8, from: "19:00", to: "20:00" },
      ],
    };
    mockedGetAvailability.mockResolvedValue(availability as Awaited<ReturnType<typeof getAvailability>>);
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/availability?date=2026-11-06&partySize=2&slotId=8",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        date: "2026-11-06",
        partySize: 2,
        slots: [availability.slots[1]],
      });
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the requested slot is not configured for the date", async () => {
    mockedGetAvailability.mockResolvedValue({
      date: "2026-11-06",
      partySize: 2,
      slots: [],
    });
    const app = await createApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/availability?date=2026-11-06&slotId=99",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: "Slot not configured for date",
      });
    } finally {
      await app.close();
    }
  });
});
