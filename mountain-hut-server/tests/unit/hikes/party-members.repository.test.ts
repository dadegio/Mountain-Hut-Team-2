import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { hikesTable, usersTable } from "../../../src/db/schema.ts";
import { resetTestDatabase } from "../../test-database.ts";

vi.mock("../../../src/db/database.ts", async () => {
  const { createIsolatedTestDatabase } = await import("../../test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return { db, __client: client, __cleanup: cleanup };
});
const { db, __client: client, __cleanup: cleanup } =
  (await import("../../../src/db/database.ts")) as unknown as {
    db: typeof import("../../../src/db/database.ts")["db"];
    __client: Client;
    __cleanup: () => void;
  };
const { listHikeParty, replaceHikeParty } = await import("../../../src/hikes/party-members.ts");
const { registerHike } = await import("../../../src/hikes/hikes.ts");
let ownerId: number, otherId: number, hikeId: number;
const planned = {
  departureAt: "2030-07-01T08:00:00Z", expectedReturnAt: "2030-07-01T16:00:00Z",
  destination: "Monviso", routeDescription: "Via Lago Chiaretto",
};
beforeEach(async () => {
  await resetTestDatabase(client);
  const users = await db.insert(usersTable).values([
    { name: "Owner", surname: "One", email: "owner@example.test", passwordHash: "hash", type: "HIKER" },
    { name: "Other", surname: "Two", email: "other@example.test", passwordHash: "hash", type: "HIKER" },
  ]).returning();
  ownerId = users[0].id;
  otherId = users[1].id;
  const [hike] = await db.insert(hikesTable).values({ ...planned, userId: ownerId }).returning();
  hikeId = hike.id;
});
afterAll(async () => { await client.close(); cleanup(); });

describe("MH-221 party member persistence", () => {
  it("defaults an existing hike to one person", async () => {
    expect(await listHikeParty(hikeId, ownerId)).toEqual({ partySize: 1, members: [] });
  });
  it("stores and reads members including optional fields", async () => {
    const result = await replaceHikeParty(hikeId, ownerId, { partySize: 3, members: [{ name: "Anna" }, { name: "Luca", surname: "Rossi", phoneNumber: "123456" }] });
    expect(result?.partySize).toBe(3);
    expect(await listHikeParty(hikeId, ownerId)).toEqual(result);
    expect(await listHikeParty(hikeId)).toEqual(result);
    expect(result?.members[0]).toMatchObject({ name: "Anna", surname: null, phoneNumber: null });
  });
  it("replaces a party and allows returning to a solo hike", async () => {
    await replaceHikeParty(hikeId, ownerId, { partySize: 2, members: [{ name: "Anna" }] });
    const updated = await replaceHikeParty(hikeId, ownerId, { partySize: 2, members: [{ name: "Luca" }] });
    expect(updated?.members.map((m) => m.name)).toEqual(["Luca"]);
    expect(await replaceHikeParty(hikeId, ownerId, { partySize: 1, members: [] })).toEqual({ partySize: 1, members: [] });
    expect(await listHikeParty(hikeId, ownerId)).toEqual({ partySize: 1, members: [] });
  });
  it("does not allow another hiker to read or alter the party", async () => {
    expect(await listHikeParty(hikeId, otherId)).toBeNull();
    expect(await replaceHikeParty(hikeId, otherId, { partySize: 2, members: [{ name: "Anna" }] })).toBeNull();
    expect(await listHikeParty(hikeId, ownerId)).toEqual({ partySize: 1, members: [] });
  });
  it("returns null for a missing hike", async () => {
    expect(await listHikeParty(999999)).toBeNull();
    expect(await replaceHikeParty(999999, ownerId, { partySize: 1, members: [] })).toBeNull();
  });
  it("persists a party when registering a new hike", async () => {
    const hike = await registerHike(ownerId, { ...planned, party: { partySize: 2, members: [{ name: "Anna" }] } });
    expect(await listHikeParty(hike.id, ownerId)).toMatchObject({ partySize: 2, members: [{ name: "Anna" }] });
  });
});
