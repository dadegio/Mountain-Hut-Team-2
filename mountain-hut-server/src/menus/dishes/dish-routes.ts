import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { DISH_TYPE } from "#src/db/schema";
import { DishRepository } from "#src/menus/dishes/dish-repository";

export const dishSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  course: z.enum(DISH_TYPE),
});

export const dishRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      schema: {
        tags: ["Dishes"],
        summary: "Get all dishes",
        operationId: "getDishes",
        response: {
          [StatusCodes.OK]: z
            .array(dishSchema)
            .describe("A list of all dishes"),
        },
      },
    },
    async (_request, reply) => {
      const dishes = await DishRepository.getDishes();
      return reply.status(StatusCodes.OK).send(dishes);
    },
  );
};
