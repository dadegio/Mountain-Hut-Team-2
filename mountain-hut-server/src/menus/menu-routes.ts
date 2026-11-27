import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { requireStaff } from "#src/shared/hooks/require-role";
import { MenuRepository } from "#src/menus/menu-repository";
import {
  createMenuSchema,
  getMenuQuerySchema,
  menuParamsSchema,
  menuSchema,
} from "#src/menus/menu-schema";

export const menuRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      schema: {
        summary: "Get all menus, with the respective dishes.",
        querystring: getMenuQuerySchema,
        response: {
          [StatusCodes.OK]: z.array(menuSchema),
        },
      },
    },
    async (request, reply) => {
      const { type } = request.query;
      const menus = await MenuRepository.getMenus(type);
      return reply.status(StatusCodes.OK).send(menus);
    },
  );

  typed.post(
    "/",
    {
      preHandler: requireStaff,
      schema: {
        summary: "Creates a new menu.",
        body: createMenuSchema,
        response: {
          [StatusCodes.CREATED]: z.object({
            id: z.number().int(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, type, dishes } = request.body;
      const id = await MenuRepository.createMenu(name, type, dishes);
      return reply.status(StatusCodes.CREATED).send({ id });
    },
  );

  typed.delete(
    "/:id",
    {
      preHandler: requireStaff,
      schema: {
        summary: "Deletes a menu.",
        description:
          "This is a soft delete: the menu isn't completely deleted from the database, just its type is set as CANCELED.",
        params: menuParamsSchema,
        response: {
          [StatusCodes.NO_CONTENT]: z.null(),
          [StatusCodes.NOT_FOUND]: z.object({
            error: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const updated = await MenuRepository.cancelMenu(id);
      if (!updated) {
        return reply.status(StatusCodes.NOT_FOUND).send({
          error: "Menu not found",
        });
      }
      return reply.status(StatusCodes.NO_CONTENT).send(null);
    },
  );
};
