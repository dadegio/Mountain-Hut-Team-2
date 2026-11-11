import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError, createBooking } from "./booking.ts";
import { hutSlotStartMs } from "./booking-rules.ts";
import { SmtpEmailSender, type EmailSender } from "../notifications/sender.ts";
import { sendBookingConfirmation } from "../notifications/confirmation.ts";
import { listBookingsForUser } from "./list-bookings.ts";

export interface BookingRoutesOptions {
  emailSender?: EmailSender;
}

const bookingSchema = z.object({
  slotId: z.number().int().positive(),
  partySize: z.number().int().positive().max(1000),
  description: z.string().max(1000).optional(),
  allergenIds: z.array(z.number().int().positive()).optional().default([]),
  requirements: z.string().max(1000).optional(),
}).strict();

export async function bookingRoutes(
  app: FastifyInstance,
  options: BookingRoutesOptions = {},
) {
  const mailSender = options.emailSender ?? new SmtpEmailSender();

  app.get("/api/bookings/mine", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    if (request.user.type !== "HIKER") {
      return reply
        .status(403)
        .send({ error: "Only hikers can view their bookings" });
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
      const effectiveDescription = parsed.data.description !== undefined
        ? parsed.data.description
        : parsed.data.requirements;

      const booking = await createBooking({
        userId: request.user.id,
        slotId: parsed.data.slotId,
        partySize: parsed.data.partySize,
        description: effectiveDescription,
        allergenIds: parsed.data.allergenIds,
      });

      // Invio della mail di conferma all'hiker loggato
      try {
        const slotStart = new Date(hutSlotStartMs(booking.date, booking.from));
        const slotEnd = new Date(hutSlotStartMs(booking.date, booking.to));
        const reference = `MH-${booking.reservations[0]?.reservationId ?? booking.slotId}`;
        const hikerName = `${request.user.name} ${request.user.surname}`.trim();

        let emailRequirements: string | undefined = undefined;
        const allergenNames = booking.allergens.map((a) => a.name);
        if (allergenNames.length > 0 && booking.description) {
          emailRequirements = `Allergens: ${allergenNames.join(", ")}. Details: ${booking.description}`;
        } else if (allergenNames.length > 0) {
          emailRequirements = `Allergens: ${allergenNames.join(", ")}`;
        } else if (booking.description) {
          emailRequirements = booking.description;
        }

        sendBookingConfirmation(mailSender, request.user.email, {
          reference,
          hikerName,
          slotStart,
          slotEnd,
          partySize: booking.partySize,
          requirements: emailRequirements,
        }).catch((err) => {
          request.log.error(err, "Failed to send booking confirmation email");
        });
      } catch (err) {
        request.log.error(err, "Error preparing booking confirmation email");
      }

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
