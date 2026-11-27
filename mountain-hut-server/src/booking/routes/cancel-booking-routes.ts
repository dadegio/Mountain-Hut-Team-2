import type { FastifyInstance } from "fastify";
import { BookingError } from "../services/booking.ts";
import { cancelBooking } from "../services/cancel-booking.ts";
import { requireHiker } from "#src/shared/hooks/require-role";

export async function cancelBookingRoutes(app: FastifyInstance) {
  app.delete(
    "/bookings/:bookingId",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Bookings"],
        summary: "Cancel a booking",
        description: `Roles: \`HIKER\`. Cancels a booking before the slot starts. All table
reservations for this booking are set to \`CANCELED\`, releasing the seats.`,
        operationId: "cancelBooking",
        // params: bookingParamSchema,
        // response: {
        //   200: canceledBookingSchema.describe("Booking canceled"),
        //   400: errorSchema.describe("Invalid booking id"),
        //   401: errorSchema.describe("Nobody is signed in"),
        //   403: errorSchema.describe(
        //     "The signed-in user does not have the right role",
        //   ),
        //   404: errorSchema.describe(
        //     "The booking does not exist or belongs to someone else",
        //   ),
        //   409: errorSchema.describe(
        //     "The booking is not `PLACED` or the time slot has already started",
        //   ),
        // },
      },
    },
    async (request, reply) => {
      const rawId = (request.params as { bookingId: string }).bookingId;
      const bookingId = Number(rawId);

      if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(bookingId)) {
        return reply.status(400).send({
          error: "Invalid booking ID",
        });
      }

      try {
        const result = await cancelBooking({
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
