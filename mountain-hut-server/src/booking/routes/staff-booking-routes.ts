import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError, createBooking } from "../services/booking.ts";
import { requireStaff } from "#src/shared/hooks/require-role";

// MH-07: staff may reserve for an EXISTING hiker. The temporary-hiker flow
// depends on separate schema/auth work and is intentionally not accepted here.
const staffBookingSchema = z
  .object({
    hikerId: z.number().int().positive(),
    slotId: z.number().int().positive(),
    partySize: z.number().int().positive().max(1000),
  })
  .strict();

export async function staffBookingRoutes(app: FastifyInstance) {
  app.post(
    "/staff/bookings",
    { preHandler: requireStaff },
    async (request, reply) => {
      const parsed = staffBookingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: parsed.error.issues,
        });
      }

      const { hikerId, slotId, partySize } = parsed.data;
      try {
        // Only authenticated staff can bypass the hiker two-hour cutoff.
        // The slot must not have started; all other booking rules remain.
        const booking = await createBooking({
          userId: hikerId,
          slotId,
          partySize,
          allowStaffLateBooking: true,
        });
        return reply.status(201).send(booking);
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
