import type { FastifyInstance } from "fastify";
import { registerHike, listMyHikes, listRegisteredHikes } from "./hikes.ts";
import {
  registerHikeSchema,
  validateHikeChronology,
} from "./hike-validation.ts";
import { requireHiker, requireStaff } from "#src/shared/hooks/require-role";

export async function hikeRoutes(app: FastifyInstance) {
  app.post("/hikes", { preHandler: requireHiker }, async (request, reply) => {
    const parsed = registerHikeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid request body",
        details: parsed.error.issues,
      });
    }
    const chronologyError = validateHikeChronology(parsed.data);
    if (chronologyError) {
      return reply.status(400).send({ error: chronologyError });
    }
    try {
      return reply
        .status(201)
        .send(await registerHike(request.user!.id, parsed.data));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get(
    "/hikes/mine",
    { preHandler: requireHiker },
    async (request, reply) => {
      try {
        return reply.status(200).send(await listMyHikes(request.user!.id));
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );

  app.get("/hikes", { preHandler: requireStaff }, async (request, reply) => {
    try {
      return reply.status(200).send(await listRegisteredHikes());
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
