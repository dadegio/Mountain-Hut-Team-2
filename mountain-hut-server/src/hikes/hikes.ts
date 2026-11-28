import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "#src/db/database";
import { hikesTable, usersTable } from "#src/db/schema";
import type { RegisterHikeInput } from "#src/hikes/hike-schema";

export class HikesRepository {
  /** Only the authenticated user's id may be used; never trust a client userId. */
  static async registerHike(userId: number, input: RegisterHikeInput) {
    const [hike] = await db
      .insert(hikesTable)
      .values({
        userId,
        departureAt: new Date(input.departureAt).toISOString(),
        expectedReturnAt: new Date(input.expectedReturnAt).toISOString(),
        destination: input.destination,
        routeDescription: input.routeDescription,
        intermediatePoints: input.intermediatePoints ?? [],
        emergencyContactPhone: input.emergencyContactPhone ?? null,
      })
      .returning();
    return hike;
  }

  /**
   * MH-183: a hiker cannot be on two hikes at the same time.
   * Two hikes overlap when one starts before the other ends.
   * Dates are stored as UTC ISO strings, so comparing them as text is safe.
   * TODO: once completedAt (MH-22) is on dev, also skip completed hikes.
   */
  static async findOverlappingHike(
    userId: number,
    departureAt: string,
    expectedReturnAt: string,
  ) {
    const from = new Date(departureAt).toISOString();
    const to = new Date(expectedReturnAt).toISOString();
    const [hike] = await db
      .select({ id: hikesTable.id })
      .from(hikesTable)
      .where(
        and(
          eq(hikesTable.userId, userId),
          lt(hikesTable.departureAt, to),
          gt(hikesTable.expectedReturnAt, from),
        ),
      )
      .limit(1);
    return hike ?? null;
  }

  static async listMyHikes(userId: number) {
    return db
      .select()
      .from(hikesTable)
      .where(eq(hikesTable.userId, userId))
      .orderBy(desc(hikesTable.departureAt), desc(hikesTable.id));
  }

  /** Staff-only: priority by expected return time, so overdue hikes appear first. */
  static async listRegisteredHikes() {
    const rows = await db
      .select({
        id: hikesTable.id,
        userId: hikesTable.userId,
        departureAt: hikesTable.departureAt,
        expectedReturnAt: hikesTable.expectedReturnAt,
        destination: hikesTable.destination,
        routeDescription: hikesTable.routeDescription,
        intermediatePoints: hikesTable.intermediatePoints,
        emergencyContactPhone: hikesTable.emergencyContactPhone,
        createdAt: hikesTable.createdAt,
        hikerName: usersTable.name,
        hikerSurname: usersTable.surname,
        hikerPhoneNumber: usersTable.phoneNumber,
      })
      .from(hikesTable)
      .innerJoin(usersTable, eq(hikesTable.userId, usersTable.id))
      .orderBy(asc(hikesTable.expectedReturnAt), asc(hikesTable.id));

    return rows.map(
      ({ hikerName, hikerSurname, hikerPhoneNumber, ...hike }) => ({
        ...hike,
        hiker: {
          name: hikerName,
          surname: hikerSurname,
          phoneNumber: hikerPhoneNumber,
        },
      }),
    );
  }
}