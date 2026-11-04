
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError, createBooking } from "./booking.ts";
import { listBookingsForUser } from "./list-bookings.ts";

const bookingSchema = z.object({
  slotId: z.number().int().positive(),
  partySize: z.number().int().positive().max(1000),
}).strict();

export async function bookingRoutes(app: FastifyInstance) {
  app.get("/api/bookings/mine", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    if (request.user.type !== "HIKER") {
      return reply.status(403).send({ error: "Only hikers can view their bookings" });
    }

    try {
      return reply.status(200).send(await listBookingsForUser(request.user.id));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.post("/api/bookings", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    if (request.user.type !== "HIKER") {
      return reply.status(403).send({ error: "Only hikers can book tables" });
    }

    const parsed = bookingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    try {
      const booking = await createBooking({ ...parsed.data, userId: request.user.id });
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
