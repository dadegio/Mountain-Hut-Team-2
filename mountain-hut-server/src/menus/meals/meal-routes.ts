import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { MealRepository } from "#src/menus/meals/meal-repository";
import { mealQuerySchema, mealSlotSchema } from "#src/menus/meals/meal-schema";

// MH-11 "As a user": open to everyone, guests included, like availability
export const mealRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      schema: {
        summary: "Meal times of a day, with their menus, dishes and allergens.",
        querystring: mealQuerySchema,
        response: {
          [StatusCodes.OK]: z.array(mealSlotSchema),
        },
      },
    },
    async (request, reply) => {
      const meals = await MealRepository.getMealsForDate(request.query.date);
      return reply.status(StatusCodes.OK).send(meals);
    },
  );
};