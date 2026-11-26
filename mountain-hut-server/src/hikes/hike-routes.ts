import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { registerHike, listMyHikes, listRegisteredHikes } from "./hikes.ts";
import { registerHikeSchema, validateHikeChronology } from "./hike-validation.ts";
import { hikeIdParamsSchema, hikePartySchema } from "./party-validation.ts";
import { listHikeParty, replaceHikeParty } from "./party-members.ts";

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

  app.get("/hikes/:id/party-members", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER", "EMPLOYEE", "MANAGER"])) return;
    const params = hikeIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid hike id" });
    try {
      const ownerId = request.user!.type === "HIKER" ? request.user!.id : undefined;
      const party = await listHikeParty(params.data.id, ownerId);
      if (!party) return reply.status(404).send({ error: "Hike not found" });
      return reply.status(200).send(party);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.put("/hikes/:id/party-members", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER"])) return;
    const params = hikeIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "Invalid hike id" });
    const parsed = hikePartySchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({
      error: "Invalid request body", details: parsed.error.issues,
    });
    try {
      const party = await replaceHikeParty(params.data.id, request.user!.id, parsed.data);
      if (!party) return reply.status(404).send({ error: "Hike not found" });
      return reply.status(200).send(party);
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
