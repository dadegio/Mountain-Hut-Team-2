import { and, asc, desc, eq, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "../db/database.ts";
import { hikesTable, usersTable } from "../db/schema.ts";
import type { RegisterHikeInput } from "./hike-validation.ts";

/** Only the authenticated user's id may be used; never trust a client userId. */
export async function registerHike(userId: number, input: RegisterHikeInput) {
  const [hike] = await db.insert(hikesTable).values({
    userId,
    departureAt: new Date(input.departureAt).toISOString(),
    expectedReturnAt: new Date(input.expectedReturnAt).toISOString(),
    destination: input.destination,
    routeDescription: input.routeDescription,
    intermediatePoints: input.intermediatePoints ?? [],
    emergencyContactPhone: input.emergencyContactPhone ?? null,
  }).returning();
  return hike;
}

export async function listMyHikes(userId: number) {
  return db.select().from(hikesTable)
    .where(eq(hikesTable.userId, userId))
    .orderBy(desc(hikesTable.departureAt), desc(hikesTable.id));
}

/** Staff-only: priority by expected return time, so overdue hikes appear first. */
async function listStaffHikes(filter?: SQL) {
  const rows = await db.select({
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
  }).from(hikesTable)
    .innerJoin(usersTable, eq(hikesTable.userId, usersTable.id))
    .where(filter)
    .orderBy(asc(hikesTable.expectedReturnAt), asc(hikesTable.id));

  return rows.map(({ hikerName, hikerSurname, hikerPhoneNumber, ...hike }) => ({
    ...hike,
    hiker: {
      name: hikerName,
      surname: hikerSurname,
      phoneNumber: hikerPhoneNumber,
    },
  }));
}

/** All registered hikes, including upcoming and completed ones. */
export async function listRegisteredHikes() {
  return listStaffHikes();
}

/** Started but not confirmed complete; overdue hikes remain active. */
export async function listActiveHikes(now: Date = new Date()) {
  return listStaffHikes(and(
    lte(hikesTable.departureAt, now.toISOString()),
    isNull(hikesTable.completedAt),
  ));
}
