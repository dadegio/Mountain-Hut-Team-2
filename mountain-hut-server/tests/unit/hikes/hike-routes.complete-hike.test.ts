import Fastify, { type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MH-214: unit tests for the routes of story MH-22 (task MH-191).
 * The service is mocked: only roles, validation and status codes are tested here.
 */
vi.mock("../../../src/hikes/hikes.ts", () => ({
  registerHike: vi.fn(),
  listMyHikes: vi.fn(),
  listRegisteredHikes: vi.fn(),
}));

// Keep the real outcome helpers, mock only the database update
vi.mock("../../../src/hikes/hike-completion.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/hikes/hike-completion.ts")>()),
  completeHike: vi.fn(),
}));

import { listMyHikes, registerHike } from "../../../src/hikes/hikes.ts";
import { completeHike } from "../../../src/hikes/hike-completion.ts";
import { hikeRoutes } from "../../../src/hikes/hike-routes.ts";

const SESSION_USER = 42;
const planned = {
  id: 5,
  userId: SESSION_USER,
  departureAt: "2030-06-15T08:00:00.000Z",
  expectedReturnAt: "2030-06-15T16:00:00.000Z",
  destination: "Monviso",
  routeDescription: "Via Lago Chiaretto",
  intermediatePoints: [],
  emergencyContactPhone: null,
  completedAt: null,
  createdAt: "2030-06-01 10:00:00",
};

let app: ReturnType<typeof Fastify>;

function complete(id: string | number, role?: string) {
  return app.inject({
    method: "PATCH",
    url: `/hikes/${id}/complete`,
    headers: role ? { "x-test-role": role } : {},
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  app = Fastify({ logger: false });
  // Isolate the routes from sessions and the database
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const role = request.headers["x-test-role"];
    if (typeof role === "string") {
      request.user = { id: SESSION_USER, type: role } as NonNullable<typeof request.user>;
    }
  });
  await app.register(hikeRoutes);
  await app.ready();
});

afterEach(async () => { await app.close(); });

describe("MH-214 PATCH /hikes/:id/complete", () => {
  it("returns the hike with its outcome for the signed-in hiker", async () => {
    const cancelled = { ...planned, completedAt: "2030-06-14T18:00:00.000Z", outcome: "CANCELLED" as const };
    vi.mocked(completeHike).mockResolvedValueOnce({ status: "completed", hike: cancelled });

    const response = await complete(5, "HIKER");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(cancelled);
    // The owner always comes from the session, never from the request
    expect(completeHike).toHaveBeenCalledExactlyOnceWith(5, SESSION_USER);
  });

  it("rejects callers who are not signed in", async () => {
    const response = await complete(5);
    expect(response.statusCode).toBe(401);
    expect(completeHike).not.toHaveBeenCalled();
  });

  it.each(["EMPLOYEE", "MANAGER", "TEMPORARY", "THROWAWAY"])("rejects %s", async (role) => {
    const response = await complete(5, role);
    expect(response.statusCode).toBe(403);
    expect(completeHike).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-1", "1.5"])("rejects the invalid hike id %s", async (id) => {
    const response = await complete(id, "HIKER");
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid hike id" });
    expect(completeHike).not.toHaveBeenCalled();
  });

  it("answers 404 when the hike is missing or belongs to someone else", async () => {
    vi.mocked(completeHike).mockResolvedValueOnce({ status: "not-found" });
    const response = await complete(5, "HIKER");
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Hike not found" });
  });

  it("answers 409 when the hike was already completed or cancelled", async () => {
    vi.mocked(completeHike).mockResolvedValueOnce({ status: "already-completed" });
    const response = await complete(5, "HIKER");
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Hike already completed or cancelled" });
  });

  it("hides the details when the update fails", async () => {
    vi.mocked(completeHike).mockRejectedValueOnce(new Error("database failed"));
    const response = await complete(5, "HIKER");
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
  });
});

describe("MH-214 outcome in the hiker's other hike responses", () => {
  it("adds the outcome to every hike in GET /hikes/mine", async () => {
    const done = { ...planned, id: 6, completedAt: "2030-06-15T15:00:00.000Z" };
    vi.mocked(listMyHikes).mockResolvedValueOnce([planned, done]);

    const response = await app.inject({ method: "GET", url: "/hikes/mine", headers: { "x-test-role": "HIKER" } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { ...planned, outcome: null },
      { ...done, outcome: "COMPLETED" },
    ]);
  });

  it("adds a null outcome to a newly registered hike", async () => {
    vi.mocked(registerHike).mockResolvedValueOnce(planned);

    const response = await app.inject({
      method: "POST",
      url: "/hikes",
      headers: { "x-test-role": "HIKER" },
      payload: {
        departureAt: "2030-06-15T08:00:00.000Z",
        expectedReturnAt: "2030-06-15T16:00:00.000Z",
        destination: "Monviso",
        routeDescription: "Via Lago Chiaretto",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ...planned, outcome: null });
  });
});
