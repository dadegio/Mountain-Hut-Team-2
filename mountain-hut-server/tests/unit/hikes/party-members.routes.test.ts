import Fastify, { type FastifyRequest } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/hikes/hikes.ts", () => ({
  registerHike: vi.fn(), listMyHikes: vi.fn(), listRegisteredHikes: vi.fn(),
}));
vi.mock("../../../src/hikes/party-members.ts", () => ({
  listHikeParty: vi.fn(), replaceHikeParty: vi.fn(),
}));

import { hikeRoutes } from "../../../src/hikes/hike-routes.ts";
import { listHikeParty, replaceHikeParty } from "../../../src/hikes/party-members.ts";

const url = "/hikes/12/party-members";
const input = { partySize: 2, members: [{ name: "Anna" }] };
const party = { partySize: 2, members: [{ id: 1, hikeId: 12, name: "Anna", surname: null, phoneNumber: null }] };
let app: ReturnType<typeof Fastify>;

beforeEach(async () => {
  vi.resetAllMocks();
  app = Fastify();
  app.addHook("preHandler", async (request) => {
    const role = request.headers["x-test-role"];
    if (typeof role === "string") request.user = { id: 7, type: role } as FastifyRequest["user"];
  });
  await app.register(hikeRoutes);
  await app.ready();
});
afterEach(async () => { await app.close(); });
const headers = (role: string) => ({ "x-test-role": role });

describe("MH-221 party member routes", () => {
  it("returns 401 to guests", async () => {
    expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url, payload: input })).statusCode).toBe(401);
  });
  it("passes the authenticated owner id on reads and updates", async () => {
    vi.mocked(listHikeParty).mockResolvedValue(party);
    vi.mocked(replaceHikeParty).mockResolvedValue(party);
    const get = await app.inject({ method: "GET", url, headers: headers("HIKER") });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual(party);
    expect(listHikeParty).toHaveBeenCalledWith(12, 7);
    const put = await app.inject({ method: "PUT", url, headers: headers("HIKER"), payload: input });
    expect(put.statusCode).toBe(200);
    expect(replaceHikeParty).toHaveBeenCalledWith(12, 7, input);
  });
  it.each(["EMPLOYEE", "MANAGER"])("allows %s to read but not write", async (role) => {
    vi.mocked(listHikeParty).mockResolvedValue(party);
    expect((await app.inject({ method: "GET", url, headers: headers(role) })).statusCode).toBe(200);
    expect(listHikeParty).toHaveBeenCalledWith(12, undefined);
    expect((await app.inject({ method: "PUT", url, headers: headers(role), payload: input })).statusCode).toBe(403);
    expect(replaceHikeParty).not.toHaveBeenCalled();
  });
  it.each(["TEMPORARY", "THROWAWAY"])("rejects role %s", async (role) => {
    expect((await app.inject({ method: "GET", url, headers: headers(role) })).statusCode).toBe(403);
    expect((await app.inject({ method: "PUT", url, headers: headers(role), payload: input })).statusCode).toBe(403);
  });
  it("returns 404 for an unavailable or nonowned hike", async () => {
    vi.mocked(listHikeParty).mockResolvedValue(null);
    vi.mocked(replaceHikeParty).mockResolvedValue(null);
    expect((await app.inject({ method: "GET", url, headers: headers("HIKER") })).statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url, headers: headers("HIKER"), payload: input })).statusCode).toBe(404);
  });
  it("rejects invalid ids and mismatched counts before calling services", async () => {
    expect((await app.inject({ method: "GET", url: "/hikes/0/party-members", headers: headers("HIKER") })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url, headers: headers("HIKER"), payload: { partySize: 3, members: [] } })).statusCode).toBe(400);
    expect(listHikeParty).not.toHaveBeenCalled();
    expect(replaceHikeParty).not.toHaveBeenCalled();
  });
  it("handles service errors", async () => {
    vi.mocked(listHikeParty).mockRejectedValue(new Error("DB error"));
    vi.mocked(replaceHikeParty).mockRejectedValue(new Error("DB error"));
    expect((await app.inject({ method: "GET", url, headers: headers("HIKER") })).statusCode).toBe(500);
    expect((await app.inject({ method: "PUT", url, headers: headers("HIKER"), payload: input })).statusCode).toBe(500);
  });
});
