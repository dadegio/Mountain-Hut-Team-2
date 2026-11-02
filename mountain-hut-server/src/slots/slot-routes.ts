import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SlotError, createSlot, getSlot, listSlots } from "./slots.ts";
import { createTable, listTables } from "./tables.ts";

const time = z.iso.time({ precision: -1 }); // "HH:MM"

const createTableSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    seats: z.number().int().positive(),
  })
  .strict();

const createSlotSchema = z
  .object({
    date: z.iso.date(),
    from: time,
    to: time,
    // A slot can be created without tables: it then has 0 seats
    tableIds: z.array(z.number().int().positive()).default([]),
  })
  .strict()
  .refine((slot) => slot.from < slot.to, {
    message: "'from' must be before 'to'",
    path: ["to"],
  })
  .refine((slot) => new Set(slot.tableIds).size === slot.tableIds.length, {
    message: "tableIds must not contain duplicates",
    path: ["tableIds"],
  });

const listSlotsQuerySchema = z.object({ date: z.iso.date() });

const slotParamsSchema = z.object({ id: z.coerce.number().int().positive() });

function sendError(request: FastifyRequest, reply: FastifyReply, error: unknown) {
  if (error instanceof SlotError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  request.log.error(error);
  return reply.status(500).send({ error: "Internal server error" });
}

// TODO(MH-7): creating tables and slots is for EMPLOYEE and MANAGER only,
// add the role check once authentication is available
export async function slotRoutes(app: FastifyInstance) {
  app.get("/api/tables", async () => listTables());

  app.post("/api/tables", async (request, reply) => {
    const parsed = createTableSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    try {
      const table = await createTable(parsed.data);
      return reply.status(201).send(table);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.get("/api/slots", async (request, reply) => {
    const parsed = listSlotsQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    return listSlots(parsed.data.date);
  });

  app.get("/api/slots/:id", async (request, reply) => {
    const parsed = slotParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid path parameters",
        details: parsed.error.issues,
      });
    }

    try {
      return await getSlot(parsed.data.id);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });

  app.post("/api/slots", async (request, reply) => {
    const parsed = createSlotSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    try {
      const slot = await createSlot(parsed.data);
      return reply.status(201).send(slot);
    } catch (error) {
      return sendError(request, reply, error);
    }
  });
}
