import type { FastifyInstance } from "fastify";
import { listAllergens } from "./allergens.ts";

export async function allergenRoutes(app: FastifyInstance) {
  app.get("/allergens", async (_request, reply) => {
    try {
      const allergens = await listAllergens();
      return reply.status(200).send(allergens);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  });
}
