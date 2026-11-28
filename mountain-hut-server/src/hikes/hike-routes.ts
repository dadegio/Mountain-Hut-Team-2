import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";

import { requireHiker, requireStaff } from "#src/shared/hooks/require-role";
import { validateHikeChronology } from "#src/hikes/hike-validation";
import { registerHikeSchema } from "#src/hikes/hike-schema";
import { HikesRepository } from "#src/hikes/hikes";

export const hikeRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Hikes"],
        summary: "List hikes for hut staff",
        description:
          "Roles: `EMPLOYEE`, `MANAGER`. Ordered by expected return; includes hiker contact details.",
      },
    },
    async (_request, reply) => {
      return reply
        .status(StatusCodes.OK)
        .send(await HikesRepository.listRegisteredHikes());
    },
  );

  typed.get(
    "/active",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Hikes"],
        summary: "List currently active hikes for hut staff",
        description: `Roles: \`EMPLOYEE\`, \`MANAGER\`.
Includes started hikes not confirmed complete, even if overdue.
Ordered by expected return time, then hike ID.`,
      },
    },
    async (request, reply) => {
      try {
        return reply.status(200).send(await HikesRepository.listActiveHikes());
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  typed.get(
    "/mine",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Hikes"],
        summary: "List my registered hikes",
        description:
          "Roles: `HIKER`. The account is determined from the session, not request parameters.",
      },
    },
    async (request, reply) => {
      return reply
        .status(200)
        .send(await HikesRepository.listMyHikes(request.user!.id));
    },
  );

  typed.post(
    "/",
    {
      preHandler: requireHiker,
      schema: {
        tags: ["Hikes"],
        summary: "Register my planned hike",
        description:
          "Roles: `HIKER`. Departure must be in the future, return after departure. Date-times must contain Z or an explicit UTC offset.",
        body: registerHikeSchema,
      },
    },
    async (request, reply) => {
      const chronologyError = validateHikeChronology(request.body);
      if (chronologyError) {
        return reply.status(400).send({ error: chronologyError });
      }

      return reply
        .status(201)
        .send(
          await HikesRepository.registerHike(request.user!.id, request.body),
        );
    },
  );
};
