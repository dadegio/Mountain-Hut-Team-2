import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import argon2 from "argon2";
import { z } from "zod";

import UserRepository from "../users/user.repository.ts";
import { userResponseSchema } from "../users/user.schema.ts";
import { registerSchema, loginSchema } from "./auth.schema.ts";

export const authRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/register",
    {
      schema: {
        body: registerSchema,
        response: {
          [StatusCodes.CREATED]: userResponseSchema,
          [StatusCodes.CONFLICT]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const existingUser = await UserRepository.getUserByEmail(
        request.body.email,
      );
      if (existingUser) {
        return reply
          .code(StatusCodes.CONFLICT)
          .send({ message: "An account with this email already exists" });
      }

      const passwordHash = await argon2.hash(request.body.password);
      const user = await UserRepository.createUser({
        email: request.body.email,
        passwordHash,
        name: request.body.name,
        surname: request.body.surname,
        phoneNumber: request.body.phone_number,
        type: request.body.type,
      });

      return reply.code(StatusCodes.CREATED).send(user);
    },
  );

  typed.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        response: {
          [StatusCodes.OK]: userResponseSchema,
          [StatusCodes.UNAUTHORIZED]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const user = await UserRepository.getUserByEmail(request.body.email);
      if (!user) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ message: "Invalid email or password" });
      }

      const isPasswordValid = await argon2.verify(
        user.passwordHash,
        request.body.password,
      );
      if (!isPasswordValid) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ message: "Invalid email or password" });
      }

      // save user ID directly into the encrypted cookie
      request.session.set("userId", user.id);

      return reply.code(StatusCodes.OK).send({
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        phone_number: user.phoneNumber,
        type: user.type,
      });
    },
  );

  typed.post("/logout", async (request, reply) => {
    // Clears the encrypted cookie
    request.session.delete();
    return reply
      .code(StatusCodes.OK)
      .send({ message: "Logged out successfully" });
  });

  typed.get("/me", async (request, reply) => {
    if (!request.user) {
      return reply
        .code(StatusCodes.UNAUTHORIZED)
        .send({ message: "Not authenticated" });
    }

    return reply.code(StatusCodes.OK).send(request.user);
  });
};
