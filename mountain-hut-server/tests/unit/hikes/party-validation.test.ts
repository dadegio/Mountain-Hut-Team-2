import { describe, expect, it } from "vitest";
import { hikePartySchema, hikeIdParamsSchema } from "../../../src/hikes/party-validation.ts";
import { registerHikeSchema } from "../../../src/hikes/hike-validation.ts";

const member = { name: "Anna", surname: "Rossi", phoneNumber: "+39123456" };
const hike = {
  departureAt: "2030-07-01T08:00:00Z",
  expectedReturnAt: "2030-07-01T16:00:00Z",
  destination: "Monviso", routeDescription: "Via Lago Chiaretto",
};

describe("MH-221 party validation", () => {
  it("accepts a solo hiker and a group with all additional members", () => {
    expect(hikePartySchema.safeParse({ partySize: 1, members: [] }).success).toBe(true);
    expect(hikePartySchema.safeParse({ partySize: 2, members: [member] }).success).toBe(true);
  });
  it("requires only a nonblank name and trims fields", () => {
    expect(hikePartySchema.parse({ partySize: 2, members: [{ name: " Anna " }] }).members)
      .toEqual([{ name: "Anna" }]);
    expect(hikePartySchema.safeParse({ partySize: 2, members: [{ name: " " }] }).success).toBe(false);
  });
  it.each([0, -1, 1.5, 1001, "2"])("rejects invalid party size %s", (partySize) => {
    expect(hikePartySchema.safeParse({ partySize, members: [] }).success).toBe(false);
  });
  it("accepts none or some additional member details", () => {
    expect(hikePartySchema.safeParse({ partySize: 4, members: [] }).success).toBe(true);
    expect(hikePartySchema.safeParse({ partySize: 3, members: [member] }).success).toBe(true);
  });
  it("rejects too many members", () => {
    expect(hikePartySchema.safeParse({ partySize: 1, members: [member] }).success).toBe(false);
    expect(hikePartySchema.safeParse({ partySize: 2, members: [member, member] }).success).toBe(false);
  });
  it("rejects unexpected member fields, including user and hike ids", () => {
    expect(hikePartySchema.safeParse({ partySize: 2, members: [{ ...member, hikeId: 7 }] }).success).toBe(false);
  });
  it.each(["0", "-1", "abc", "1.5"])("rejects invalid hike id %s", (id) => {
    expect(hikeIdParamsSchema.safeParse({ id }).success).toBe(false);
  });
  it("preserves old registration requests and validates an optional party", () => {
    expect(registerHikeSchema.safeParse(hike).success).toBe(true);
    expect(registerHikeSchema.safeParse({ ...hike, party: { partySize: 2, members: [member] } }).success).toBe(true);
    expect(registerHikeSchema.safeParse({ ...hike, party: { partySize: 2, members: [] } }).success).toBe(true);
    expect(registerHikeSchema.safeParse({ ...hike, party: { partySize: 4, members: [member] } }).success).toBe(true);
    expect(registerHikeSchema.safeParse({ ...hike, party: { partySize: 1, members: [member] } }).success).toBe(false);
  });
});
