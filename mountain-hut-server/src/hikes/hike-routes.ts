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
        .status(StatusCodes.OK)
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
          "Roles: `HIKER`. Departure must be in the future, return after departure, and a hike lasts at most 24 hours. " +
          "It cannot overlap another hike of the same hiker. Date-times must contain Z or an explicit UTC offset.",
        body: registerHikeSchema,
      },
    },
    async (request, reply) => {
      const chronologyError = validateHikeChronology(request.body);
      if (chronologyError) {
        return reply
          .status(StatusCodes.BAD_REQUEST)
          .send({ error: chronologyError });
      }

      // MH-183: a hiker cannot be on two hikes at the same time
      const overlapping = await HikesRepository.findOverlappingHike(
        request.user!.id,
        request.body.departureAt,
        request.body.expectedReturnAt,
      );
      if (overlapping) {
        return reply
          .status(StatusCodes.CONFLICT)
          .send({ error: "You already have a hike registered at this time" });
      }

      return reply
        .status(StatusCodes.CREATED)
        .send(
          await HikesRepository.registerHike(request.user!.id, request.body),
        );
    },
  );
};