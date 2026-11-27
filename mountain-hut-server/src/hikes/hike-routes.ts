import { z } from "zod";
import { completeHike, withOutcome } from "./hike-completion.ts";
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

const hikeIdSchema = z.object({ id: z.coerce.number().int().positive() });

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
      const hike = await registerHike(request.user!.id, parsed.data);
      return reply.status(201).send(withOutcome(hike));
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });

  app.get("/hikes/mine", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER"])) return;
    try {
      const hikes = await listMyHikes(request.user!.id);
      return reply.status(200).send(hikes.map(withOutcome));
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

  // MH-22: before the departure this cancels the hike
  app.patch("/hikes/:id/complete", async (request, reply) => {
    if (!requireRole(request, reply, ["HIKER"])) return;
    const params = hikeIdSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid hike id" });
    }
    try {
      const result = await completeHike(params.data.id, request.user!.id);
      switch (result.status) {
        case "not-found":
          return reply.status(404).send({ error: "Hike not found" });
        case "already-completed":
          return reply.status(409).send({ error: "Hike already completed or cancelled" });
        case "completed":
          return reply.status(200).send(result.hike);
      }
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
