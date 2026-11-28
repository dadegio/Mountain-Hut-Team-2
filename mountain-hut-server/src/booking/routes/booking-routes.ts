import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BookingError, createBooking } from "../services/booking.ts";
import { hutSlotStartMs } from "../rules/booking-rules.ts";
import {
  SmtpEmailSender,
  type EmailSender,
} from "../../notifications/sender.ts";
import { listBookingsForUser } from "../services/list-bookings.ts";
import { sendBookingConfirmation } from "../services/booking-notification.ts";
import { requireHiker } from "#src/shared/hooks/require-role";

export interface BookingRoutesOptions {
  emailSender?: EmailSender;
}

const bookingSchema = z
  .object({
    slotId: z.number().int().positive(),
    partySize: z.number().int().positive().max(1000),
    description: z.string().max(1000).optional(),
    allergenIds: z.array(z.number().int().positive()).optional().default([]),
    requirements: z.string().max(1000).optional(),
  })
  .strict();

export async function bookingRoutes(
  app: FastifyInstance,
  options: BookingRoutesOptions = {},
) {
  const mailSender = options.emailSender ?? new SmtpEmailSender();

  app.get(
    "/bookings/mine",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Bookings"],
        summary: "List my bookings",
        description:
          "Roles: `HIKER`. Newest slot first, including past and canceled bookings.",
        operationId: "listMyBookings",
        // response: {
        //   200: z
        //     .array(myBookingSchema)
        //     .describe("The bookings of the signed-in hiker"),
        //   401: errorSchema.describe("Nobody is signed in"),
        //   403: errorSchema.describe(
        //     "The signed-in user does not have the right role",
        //   ),
        // },
      },
    },
    async (request, reply) => {
      try {
        return reply
          .status(200)
          .send(await listBookingsForUser(request.user!.id));
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.post(
    "/bookings",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Bookings"],
        summary: "Book a slot",
        description: `Roles: \`HIKER\`. The booking is for the signed-in hiker, who then gets a
confirmation email.

A booking must be made at least 2 hours before the slot starts, and a
hiker can have one active booking per slot.`,
        operationId: "createBooking",
        // body: bookingSchema,
        // response: {
        //   201: createdBookingSchema.describe("Booking placed"),
        //   400: errorSchema.describe(
        //     "Invalid body, or an allergen does not exist",
        //   ),
        //   401: errorSchema.describe("Nobody is signed in"),
        //   403: errorSchema.describe(
        //     "The signed-in user does not have the right role",
        //   ),
        //   404: errorSchema.describe("The slot does not exist"),
        //   409: errorSchema.describe(
        //     "The 2-hour limit has passed, the hiker already has a booking in this slot, or there are not enough seats.",
        //   ),
        // },
      },
    },
    async (request, reply) => {
      const parsed = bookingSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: parsed.error.issues,
        });
      }

      try {
        const effectiveDescription =
          parsed.data.description !== undefined
            ? parsed.data.description
            : parsed.data.requirements;

        const booking = await createBooking({
          userId: request.user!.id,
          slotId: parsed.data.slotId,
          partySize: parsed.data.partySize,
          description: effectiveDescription,
          allergenIds: parsed.data.allergenIds,
        });

        // Send email to hiker
        try {
          const slotStart = new Date(
            hutSlotStartMs(booking.date, booking.from),
          );
          const slotEnd = new Date(hutSlotStartMs(booking.date, booking.to));
          const reference = `MH-${booking.reservations[0]?.reservationId ?? booking.slotId}`;
          const hikerName =
            `${request.user!.name} ${request.user!.surname}`.trim();

          let emailRequirements: string | undefined = undefined;
          const allergenNames = booking.allergens.map((a) => a.name);
          if (allergenNames.length > 0 && booking.description) {
            emailRequirements = `Allergens: ${allergenNames.join(", ")}. Details: ${booking.description}`;
          } else if (allergenNames.length > 0) {
            emailRequirements = `Allergens: ${allergenNames.join(", ")}`;
          } else if (booking.description) {
            emailRequirements = booking.description;
          }

          // This is a bit hacky, but:
          // 1. The `requireHiker` prehandler ensures that the user is a registered hiker
          // 2. The database schema forces hikers to always have an email address
          sendBookingConfirmation(mailSender, request.user!.email ?? "", {
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
    },
  );
}
