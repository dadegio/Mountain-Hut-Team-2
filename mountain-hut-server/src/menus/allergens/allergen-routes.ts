import type { FastifyInstance } from "fastify";

import { AllergenRepository } from "./allergen-repository.ts";

export async function allergenRoutes(app: FastifyInstance) {
  app.get(
    "/allergens",
    {
      schema: {
        tags: ["Allergens"],
        summary: "List all allergens",
      },
    },
    async (_request, reply) => {
      try {
        const allergens = await AllergenRepository.listAllergens();
        return reply.status(200).send(allergens);
      } catch (error) {
        app.log.error(error);
        return reply.status(500).send({ error: "Internal server error" });
      }
    },
  );
}
