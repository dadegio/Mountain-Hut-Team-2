import type { FastifyInstance } from "fastify";
import { BookingError } from "../services/booking.ts";
import { cancelBooking } from "../services/cancel-booking.ts";
import { requireHiker } from "#src/shared/hooks/require-role";

export async function cancelBookingRoutes(app: FastifyInstance) {
  app.delete(
    "/bookings/:bookingId",
    { preHandler: requireHiker },
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
