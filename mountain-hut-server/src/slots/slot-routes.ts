import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { SlotError, createSlot, getSlot, listSlots } from "./slots.ts";
import { copyWeeklySchedule } from "./copy-week.ts";
import { createTable, listTables } from "./tables.ts";
import { requireStaff } from "#src/shared/hooks/require-role";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const time = z.iso.time({ precision: -1 }); // "HH:MM"
// MH-89: keep in sync with MAX_TABLE_SEATS in the client's AddTableForm
const MAX_TABLE_SEATS = 20;

const createTableSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    seats: z.number().int().positive().max(MAX_TABLE_SEATS),
  })
  .strict();

const createSlotSchema = z
  .object({
    date: z.iso.date(),
    from: time,
    to: time,
    // A slot can be created without tables: it then has 0 seats
    tableIds: z.array(z.number().int().positive()).default([]),
    menuIds: z.array(z.number().int().positive()).default([]),
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

const copyWeekSchema = z
  .object({
    sourceWeekStart: z.iso.date(),
    targetWeekStart: z.iso.date(),
    weeks: z.number().int().min(1).max(12).default(1),
  })
  .strict();

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
) {
  if (error instanceof SlotError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }

  request.log.error(error);
  return reply.status(500).send({ error: "Internal server error" });
}

export const slotRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/tables",
    {
      schema: {
        tags: ["Tables"],
        summary: "List all tables",
        // response: {
        //   [StatusCodes.OK]: z.array(tableSchema),
        // },
      },
    },
    async () => listTables(),
  );

  typed.post(
    "/tables",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Tables"],
        summary: "Create a table",
        description: "Roles: `EMPLOYEE`, `MANAGER`.",
        // body: createTableSchema,
        // response: {
        //   [StatusCodes.CREATED]: tableSchema,
        //   [StatusCodes.CONFLICT]: errorSchema,
        // },
      },
    },
    async (request, reply) => {
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
    },
  );

  typed.get(
    "/slots",
    {
      schema: {
        tags: ["Slots"],
        summary: "List the slots of a day",
        // querystring: listSlotsQuerySchema,
      },
    },
    async (request, reply) => {
      const parsed = listSlotsQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          details: parsed.error.issues,
        });
      }

      return listSlots(parsed.data.date);
    },
  );

  typed.post(
    "/slots/copy-week",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Slots"],
        summary: "Repeat a week's slots and table allocations",
        description: `Roles: \`EMPLOYEE\`, \`MANAGER\`.

Copies slot times and existing table associations from a Monday-Sunday source week into one or more consecutive destination weeks.

- It does not copy table records, reservations or menus.
- Existing destination slots (overlapping or not) are replaced only when none has active bookings.
- Canceled bookings in replaced slots are deleted.
- If any destination week has active bookings, no destination week is modified (409).
- Both start dates must be Mondays; the first destination Monday must not be in the past.
- The source and destination periods cannot overlap.`,
        operationId: "copyWeeklySchedule",
        // body: copyWeekSchema,
        // response: {
        //   [StatusCodes.CREATED]: copyWeekResponseSchema,
        //   [StatusCodes.NOT_FOUND]: errorSchema,
        //   [StatusCodes.CONFLICT]: errorSchema,
        // },
      },
    },
    async (request, reply) => {
      const parsed = copyWeekSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          details: parsed.error.issues,
        });
      }
      try {
        return reply.status(201).send(await copyWeeklySchedule(parsed.data));
      } catch (error) {
        return sendError(request, reply, error);
      }
    },
  );

  typed.get(
    "/slots/:id",
    {
      schema: {
        tags: ["Slots"],
        summary: "Get a slot",
        operationId: "getSlot",
        // params: slotParamsSchema,
        // response: {
        //   [StatusCodes.OK]: slotSchema,
        //   [StatusCodes.NOT_FOUND]: errorSchema,
        // },
      },
    },
    async (request, reply) => {
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
    },
  );

  typed.post(
    "/slots",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Slots"],
        summary: "Create a slot",
        description: "Roles: `EMPLOYEE`, `MANAGER`.",
        operationId: "createSlot",
        // body: createSlotSchema,
        // response: {
        //   [StatusCodes.CREATED]: slotSchema,
        //   [StatusCodes.NOT_FOUND]: errorSchema,
        //   [StatusCodes.CONFLICT]: errorSchema,
        // },
      },
    },
    async (request, reply) => {
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
    },
  );
};
