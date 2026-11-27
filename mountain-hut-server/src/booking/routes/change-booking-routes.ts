import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError } from "../services/booking.ts";
import { changeBooking } from "../services/change-booking.ts";
import { requireHiker } from "#src/shared/hooks/require-role";

const changeSchema = z
  .object({
    slotId: z.number().int().positive().optional(),
    partySize: z.number().int().positive().max(1000).optional(),
    description: z.string().max(1000).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.slotId !== undefined ||
      value.partySize !== undefined ||
      value.description !== undefined,
    {
      message:
        "At least one of slotId, partySize, or description must be supplied",
    },
  );

export async function changeBookingRoutes(app: FastifyInstance) {
  app.patch(
    "/bookings/:bookingId",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Bookings"],
        summary: "Change my booking",
        description: `Roles: \`HIKER\`. Moves a booking to another slot, changes the party size,
or both. It is allowed within 48 hours of creating the booking, and the
new slot must still start at least 2 hours later.`,
        operationId: "changeBooking",
        // params: bookingParamSchema,
        // body: changeSchema,
        // response: {
        //   200: changedBookingSchema.describe("Booking changed"),
        //   400: errorSchema.describe("Invalid booking id or body"),
        //   401: errorSchema.describe("Nobody is signed in"),
        //   403: errorSchema.describe(
        //     "The signed-in user does not have the right role",
        //   ),
        //   404: errorSchema.describe(
        //     "The slot does not exist, or the booking does not exist or belongs to someone else",
        //   ),
        //   409: errorSchema.describe(
        //     "The booking is not `PLACED`, the 48 hours are over, the 2-hour limit has passed, the hiker already has a booking in that slot, or there are not enough seats.",
        //   ),
        // },
      },
    },
    async (request, reply) => {
      const rawId = (request.params as { bookingId: string }).bookingId;
      const bookingId = Number(rawId);
      const parsed = changeSchema.safeParse(request.body);

      if (
        !/^[1-9]\d*$/.test(rawId) ||
        !Number.isSafeInteger(bookingId) ||
        !parsed.success
      ) {
        return reply.status(400).send({
          error: "Invalid booking ID or request body",
          ...(!parsed.success ? { details: parsed.error.issues } : {}),
        });
      }

      try {
        const result = await changeBooking({
          ...parsed.data,
          bookingId,
          userId: request.user!.id,
        });
        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof BookingError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );
}
