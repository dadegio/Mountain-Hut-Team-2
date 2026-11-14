import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { UserRepository, type User } from "./user-repository.ts";
import { getUserQuerySchema, userResponseSchema } from "./user-schema.ts";

export const userRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      schema: {
        querystring: getUserQuerySchema,
        response: {
          [StatusCodes.OK]: z.array(userResponseSchema),
          [StatusCodes.NOT_FOUND]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { email, name, surname, phone_number } = request.query;

      let users: User[] | null = null;
      if (name || surname) {
        users = await UserRepository.getUsersByName(name, surname);
      } else if (email) {
        const user = await UserRepository.getUserByEmail(email);
        users = user ? [user] : null;
      } else if (phone_number) {
        const user = await UserRepository.getUserByPhoneNumber(phone_number);
        users = user ? [user] : null;
      }

      if (!users || users.length === 0) {
        return reply
          .code(StatusCodes.NOT_FOUND)
          .send({ message: "User Not Found" });
      }

      return reply.code(StatusCodes.OK).send(users);
    },
  );
};
