import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError } from "./booking.ts";
import { changeBooking } from "./change-booking.ts";

const changeSchema = z.object({
  // Provisional until the MH-7 session replaces client-supplied userId.
  userId: z.number().int().positive(),
  slotId: z.number().int().positive().optional(),
  partySize: z.number().int().positive().max(1000).optional(),
}).strict().refine(
  (value) => value.slotId !== undefined || value.partySize !== undefined,
  { message: "At least one of slotId or partySize must be supplied" },
);

export async function changeBookingRoutes(app: FastifyInstance) {
  app.patch("/api/bookings/:bookingId", async (request, reply) => {
    const rawId = (request.params as { bookingId: string }).bookingId;
    const bookingId = Number(rawId);
    const parsed = changeSchema.safeParse(request.body);

    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(bookingId) || !parsed.success) {
      return reply.status(400).send({
        error: "Invalid booking ID or request body",
        ...(!parsed.success ? { details: parsed.error.issues } : {}),
      });
    }

    try {
      const result = await changeBooking({ bookingId, ...parsed.data });
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof BookingError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
