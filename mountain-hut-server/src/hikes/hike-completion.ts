import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/database.ts";
import { hikesTable } from "../db/schema.ts";

/**
 * MH-22: a hiker marks their hike as completed.
 * Completing it before the planned departure means the hike was cancelled
 * (course clarification of 25 Nov 2026), so no extra column is needed.
 */
export type HikeOutcome = "COMPLETED" | "CANCELLED";

type HikeRow = typeof hikesTable.$inferSelect;

export function hikeOutcome(
  hike: Pick<HikeRow, "departureAt" | "completedAt">,
): HikeOutcome | null {
  if (hike.completedAt === null) return null;
  // Both are UTC ISO 8601 instants, so comparing the strings compares the times
  return hike.completedAt < hike.departureAt ? "CANCELLED" : "COMPLETED";
}

export function withOutcome<T extends Pick<HikeRow, "departureAt" | "completedAt">>(hike: T) {
  return { ...hike, outcome: hikeOutcome(hike) };
}

export type CompleteHikeResult =
  | { status: "completed"; hike: HikeRow & { outcome: HikeOutcome | null } }
  // Missing, or owned by another hiker: the route answers 404 in both cases
  | { status: "not-found" }
  | { status: "already-completed" };

/** Only the authenticated user's id may be used; never trust a client userId. */
export async function completeHike(
  hikeId: number,
  userId: number,
  now: Date = new Date(),
): Promise<CompleteHikeResult> {
  // One conditional update: of two requests sent together (a double click)
  // only one can change the row, and the other one gets "already-completed"
  const [updated] = await db.update(hikesTable)
    .set({ completedAt: now.toISOString() })
    .where(and(
      eq(hikesTable.id, hikeId),
      eq(hikesTable.userId, userId),
      isNull(hikesTable.completedAt),
    ))
    .returning();
  if (updated) return { status: "completed", hike: withOutcome(updated) };

  // Nothing changed: find out why
  const [hike] = await db.select({ userId: hikesTable.userId })
    .from(hikesTable)
    .where(eq(hikesTable.id, hikeId))
    .limit(1);
  if (!hike || hike.userId !== userId) return { status: "not-found" };
  return { status: "already-completed" };
}
