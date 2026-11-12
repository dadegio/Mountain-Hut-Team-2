import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerHike, listMyHikes, listRegisteredHikes } from "./hikes.ts";
import { registerHikeSchema, validateHikeChronology } from "./hike-validation.ts";

function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  allowed: readonly string[],
) {
  if (!request.user) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }
  if (!allowed.includes(request.user.type)) {
    reply.status(403).send({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

export async function hikeRoutes(app: FastifyInstance) {
  app.post("/hikes", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER"])) return;
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
      return reply.status(201).send(await registerHike(request.user!.id, parsed.data));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get("/hikes/mine", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER"])) return;
    try {
      return reply.status(200).send(await listMyHikes(request.user!.id));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get("/hikes", async (request, reply) => {
    if (!requireRole(request, reply, ["EMPLOYEE", "MANAGER"])) return;
    try {
      return reply.status(200).send(await listRegisteredHikes());
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
