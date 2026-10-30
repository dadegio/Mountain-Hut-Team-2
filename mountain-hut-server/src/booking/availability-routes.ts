
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getAvailability } from "./availability.ts";

const realDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const querySchema = z.object({
  date: z.string().refine(realDate),
  partySize: z.coerce.number()
    .int().positive().max(1000).default(1),
  slotId: z.coerce.number()
    .int().positive().optional(),
});

export async function availabilityRoutes(
  app: FastifyInstance
) {
  app.get("/api/availability", async (request, reply) => {
    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { date, partySize, slotId } = parsed.data;
    const availability = await getAvailability(
      date,
      partySize
    );

    if (slotId === undefined) {
      return availability;
    }

    const slot = availability.slots.find(
      item => item.slotId === slotId
    );

    if (!slot) {
      return reply.status(404).send({
        error: "Slot not configured for date",
      });
    }

    return { date, partySize, slots: [slot] };
  });
}
