import Fastify, { type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/hikes/hikes.ts", () => ({
  registerHike: vi.fn(),
  listMyHikes: vi.fn(),
  listRegisteredHikes: vi.fn(),
  listActiveHikes: vi.fn(),
}));

import { listActiveHikes } from "../../../src/hikes/hikes.ts";
import { hikeRoutes } from "../../../src/hikes/hike-routes.ts";

let app: ReturnType<typeof Fastify>;
const endpoint = "/hikes/active";

beforeEach(async () => {
  vi.resetAllMocks();
  app = Fastify({ logger: false });
  // Isolate route authorization from session/database infrastructure.
  app.addHook("preHandler", async (request: FastifyRequest) => {
    const role = request.headers["x-test-role"];
    if (typeof role === "string") {
      request.user = { id: 1, type: role } as NonNullable<typeof request.user>;
    }
  });
  await app.register(hikeRoutes);
  await app.ready();
});

afterEach(async () => { await app.close(); });

describe("MH-213 active hikes route", () => {
  it.each(["EMPLOYEE", "MANAGER"])("allows %s", async (role) => {
    vi.mocked(listActiveHikes).mockResolvedValueOnce([]);
    const response = await app.inject({ method: "GET", url: endpoint, headers: { "x-test-role": role } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    expect(listActiveHikes).toHaveBeenCalledOnce();
  });

  it("rejects unauthenticated callers", async () => {
    const response = await app.inject({ method: "GET", url: endpoint });
    expect(response.statusCode).toBe(401);
    expect(listActiveHikes).not.toHaveBeenCalled();
  });

  it.each(["HIKER", "TEMPORARY", "THROWAWAY"])("rejects %s", async (role) => {
    const response = await app.inject({ method: "GET", url: endpoint, headers: { "x-test-role": role } });
    expect(response.statusCode).toBe(403);
    expect(listActiveHikes).not.toHaveBeenCalled();
  });

  it("returns a generic server error when the query fails", async () => {
    vi.mocked(listActiveHikes).mockRejectedValueOnce(new Error("database failed"));
    const response = await app.inject({ method: "GET", url: endpoint, headers: { "x-test-role": "EMPLOYEE" } });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
  });
});
