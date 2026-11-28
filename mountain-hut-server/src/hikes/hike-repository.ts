import { and, asc, desc, eq, isNull, lte, type SQL } from "drizzle-orm";

import { db } from "#src/db/database";
import { hikesTable, usersTable } from "#src/db/schema";
import type { RegisterHikeInput } from "#src/hikes/hike-schema";

export class HikeRepository {
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

  static async listMyHikes(userId: number) {
    return db
      .select()
      .from(hikesTable)
      .where(eq(hikesTable.userId, userId))
      .orderBy(desc(hikesTable.departureAt), desc(hikesTable.id));
  }

  /** Staff-only: priority by expected return time, so overdue hikes appear first. */
  static async listStaffHikes(filter?: SQL) {
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
        completedAt: hikesTable.completedAt,
        hikerName: usersTable.name,
        hikerSurname: usersTable.surname,
        hikerPhoneNumber: usersTable.phoneNumber,
      })
      .from(hikesTable)
      .innerJoin(usersTable, eq(hikesTable.userId, usersTable.id))
      .where(filter)
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

  /** All registered hikes, including upcoming and completed ones. */
  static async listRegisteredHikes() {
    return HikeRepository.listStaffHikes();
  }

  /** Started but not confirmed complete; overdue hikes remain active. */
  static async listActiveHikes(now: Date = new Date()) {
    return HikeRepository.listStaffHikes(
      and(
        lte(hikesTable.departureAt, now.toISOString()),
        isNull(hikesTable.completedAt),
      ),
    );
  }
}
