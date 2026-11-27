import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/database.ts";
import { hikesTable, hikePartyMembersTable } from "../db/schema.ts";
import type { HikePartyInput } from "./party-validation.ts";

// The owner counts as one person and is already represented by usersTable.
function partyResponse(partySize: number, members: (typeof hikePartyMembersTable.$inferSelect)[]) {
  return { partySize, members };
}

/** Staff may read any hike; a hiker may read only their own. */
export async function listHikeParty(hikeId: number, ownerId?: number) {
  const [hike] = await db.select({ id: hikesTable.id, partySize: hikesTable.partySize }).from(hikesTable).where(
    ownerId === undefined ? eq(hikesTable.id, hikeId)
      : and(eq(hikesTable.id, hikeId), eq(hikesTable.userId, ownerId)),
  );
  if (!hike) return null;
  const members = await db.select().from(hikePartyMembersTable)
    .where(eq(hikePartyMembersTable.hikeId, hikeId))
    .orderBy(asc(hikePartyMembersTable.id));
  return partyResponse(hike.partySize, members);
}

/** Replace the complete list atomically; ownership is checked inside the transaction. */
export async function replaceHikeParty(hikeId: number, ownerId: number, party: HikePartyInput) {
  return db.transaction(async (tx) => {
    const [hike] = await tx.select({ id: hikesTable.id }).from(hikesTable).where(
      and(eq(hikesTable.id, hikeId), eq(hikesTable.userId, ownerId)),
    );
    if (!hike) return null;
    await tx.update(hikesTable).set({ partySize: party.partySize }).where(eq(hikesTable.id, hikeId));
    await tx.delete(hikePartyMembersTable).where(eq(hikePartyMembersTable.hikeId, hikeId));
    const members = party.members.length === 0 ? [] : await tx.insert(hikePartyMembersTable)
      .values(party.members.map((member) => ({ ...member, hikeId }))).returning();
    return partyResponse(party.partySize, members);
  });
}
