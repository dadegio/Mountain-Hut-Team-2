import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { UserRepository, type User } from "./user-repository.ts";
import { getUserQuerySchema, userResponseSchema } from "./user-schema.ts";

export async function requireEmployeeOrManager(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.user) {
    return reply
      .code(StatusCodes.UNAUTHORIZED)
      .send({ message: "Authentication required" });
  }

  if (request.user.type !== "EMPLOYEE" && request.user.type !== "MANAGER") {
    return reply
      .code(StatusCodes.FORBIDDEN)
      .send({ message: "Forbidden: insufficient permissions" });
  }
}

export const userRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      preHandler: requireEmployeeOrManager,
      schema: {
        querystring: getUserQuerySchema,
        response: {
          [StatusCodes.OK]: z.array(userResponseSchema),
          [StatusCodes.UNAUTHORIZED]: z.object({ message: z.string() }),
          [StatusCodes.FORBIDDEN]: z.object({ message: z.string() }),
          [StatusCodes.NOT_FOUND]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { email, name, surname, phoneNumber } = request.query;

      let users: User[] | null = null;
      if (name || surname) {
        users = await UserRepository.getUsersByName(name, surname);
      } else if (email) {
        const user = await UserRepository.getUserByEmail(email);
        users = user ? [user] : null;
      } else if (phoneNumber) {
        const user = await UserRepository.getUserByPhoneNumber(phoneNumber);
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
