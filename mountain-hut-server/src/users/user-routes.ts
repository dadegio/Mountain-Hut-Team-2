import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import argon2 from "argon2";
import { randomInt } from "node:crypto";

import { UserRepository, type User } from "./user-repository.ts";
import {
  getUserQuerySchema,
  userResponseSchema,
  userCreationSchema,
} from "./user-schema.ts";
import { PasswordResetRepository } from "../auth/auth-repository.ts";
import { renderTemporaryAccountEmail } from "../notifications/utils.ts";
import { emailSender } from "../notifications/sender.ts";
import { env } from "../config.ts";
import { requireStaff } from "#src/shared/hooks/require-role";

export const userRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Users"],
        summary: "Search users",
        description:
          "Roles: `EMPLOYEE`, `MANAGER`. Searches users by name/surname, email, or phone number.",
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

      return reply
        .code(StatusCodes.OK)
        .send(users.map((rawUser) => userResponseSchema.parse(rawUser)));
    },
  );

  typed.post(
    "/",
    {
      preHandler: requireStaff,
      schema: {
        tags: ["Users"],
        summary: "Create a new user account",
        description:
          "Roles: `EMPLOYEE`, `MANAGER`. Creates a new user account.",
        body: userCreationSchema,
        response: {
          [StatusCodes.CREATED]: userResponseSchema,
          [StatusCodes.CONFLICT]: z.object({ message: z.string() }),
          [StatusCodes.FORBIDDEN]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { body } = request;

      if (
        request.user &&
        request.user.type === "EMPLOYEE" &&
        body.type === "MANAGER"
      ) {
        return reply
          .code(StatusCodes.FORBIDDEN)
          .send({ message: "Employees cannot create new MANAGER accounts." });
      }

      if (body.type === "THROWAWAY") {
        const newUser = await UserRepository.saveUser({
          email: null,
          passwordHash: null,
          name: body.name,
          surname: null,
          phoneNumber: body.phoneNumber ?? null,
          type: body.type,
        });

        return reply
          .code(StatusCodes.CREATED)
          .send(userResponseSchema.parse(newUser));
      }

      const existingUser = await UserRepository.getUserByEmail(body.email);
      if (existingUser) {
        return reply
          .code(StatusCodes.CONFLICT)
          .send({ message: "An account with this email already exists" });
      }

      const rawPassword =
        body.type === "TEMPORARY"
          ? `${body.name}${body.surname ?? ""}${randomInt(100, 1000)}`
          : body.password;
      const passwordHash = await argon2.hash(rawPassword);

      const newUser = await UserRepository.saveUser({
        email: body.email,
        passwordHash,
        name: body.name,
        surname: body.surname,
        phoneNumber: body.phoneNumber,
        type: body.type,
      });

      // send mail with randomly generated password to temporary users
      if (body.type === "TEMPORARY" && newUser.email && rawPassword) {
        const plainToken = await PasswordResetRepository.createToken(
          newUser.id,
        );
        const resetUrl = `${env.APP_URL}/reset-password?token=${plainToken}`;
        const { text, html } = renderTemporaryAccountEmail(
          newUser.name,
          rawPassword,
          resetUrl,
        );

        try {
          await emailSender.send({
            to: newUser.email,
            subject: "Mountain Hut — Your temporary password and setup link",
            text,
            html,
          });
        } catch (err) {
          server.log.error({ err }, "Failed to send temporary account email");
        }
      }

      return reply.code(StatusCodes.CREATED).send(
        userResponseSchema.parse({
          ...newUser,
          ...(rawPassword ? { temporaryPassword: rawPassword } : {}),
        }),
      );
    },
  );
};
