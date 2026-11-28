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
        tags: ["Meals"],
        summary: "Meal times of a day, with their menus, dishes and allergens",
        description: `Open to every user, guests included (MH-11). Returns the time slots of
the date ordered by start time, each with the menus specified for it;
canceled menus are left out. Dishes are in serving order, each with its
allergens, and each menu also lists all the allergens of its dishes.`,
        operationId: "getMeals",
        querystring: mealQuerySchema,
        response: {
          [StatusCodes.OK]: z
            .array(mealSlotSchema)
            .describe("The meal times of the day; empty if there are none"),
        },
      },
    },
    async (request, reply) => {
      const meals = await MealRepository.getMealsForDate(request.query.date);
      return reply.status(StatusCodes.OK).send(meals);
    },
  );
};
