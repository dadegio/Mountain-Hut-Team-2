
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError, createBooking } from "./booking.ts";

const bookingSchema = z.object({
  userId: z.number().int().positive(),
  slotId: z.number().int().positive(),
  partySize: z.number().int().positive().max(1000),
}).strict();

export async function bookingRoutes(app: FastifyInstance) {
  app.post("/api/bookings", async (request, reply) => {
    const parsed = bookingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    try {
      const booking = await createBooking(parsed.data);
      return reply.status(201).send(booking);
    } catch (error) {
      if (error instanceof BookingError) {
        return reply.status(error.statusCode).send({
          error: error.message,
        });
      }

      request.log.error(error);
      return reply.status(500).send({
        error: "Internal server error",
      });
    }
  });
}
