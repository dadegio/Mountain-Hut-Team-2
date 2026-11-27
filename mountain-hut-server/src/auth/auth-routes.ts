import type { FastifyPluginAsync } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import argon2 from "argon2";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { UserRepository } from "../users/user-repository.ts";
import { userResponseSchema } from "../users/user-schema.ts";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth-schema.ts";
import { PasswordResetRepository } from "./auth-repository.ts";
import { env } from "../config.ts";
import {
  renderPasswordResetEmail,
  renderPasswordChangedConfirmationEmail,
} from "../notifications/utils.ts";
import { emailSender } from "../notifications/sender.ts";

export const authRoutes: FastifyPluginAsync = async (server) => {
  const typed = server.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/register",
    {
      schema: {
        tags: ["Auth"],
        summary: "Create a hiker account",
        description:
          "The new account is always a `HIKER`. It does not sign the user in.",
        body: registerSchema,
        response: {
          [StatusCodes.CREATED]: userResponseSchema,
          [StatusCodes.CONFLICT]: z.object({ error: z.string() }),
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
          .send({ error: "An account with this email already exists" });
      }

      const passwordHash = await argon2.hash(request.body.password);
      const user = await UserRepository.saveUser({
        email: request.body.email,
        passwordHash,
        name: request.body.name,
        surname: request.body.surname,
        phoneNumber: request.body.phoneNumber,
        type: "HIKER",
      });

      return reply
        .code(StatusCodes.CREATED)
        .send(userResponseSchema.parse(user));
    },
  );

  typed.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        tags: ["Auth"],
        summary: "Sign in",
        description: "On success, the response sets the session cookie.",
        response: {
          [StatusCodes.OK]: userResponseSchema,
          [StatusCodes.UNAUTHORIZED]: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const user = await UserRepository.getUserByEmail(request.body.email);
      if (!user || !user.passwordHash) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ error: "Invalid email or password" });
      }

      const isPasswordValid = await argon2.verify(
        user.passwordHash,
        request.body.password,
      );
      if (!isPasswordValid) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ error: "Invalid email or password" });
      }

      // save user ID directly into the encrypted cookie
      request.session.set("userId", user.id);

      if (user.type === "TEMPORARY" && user.email) {
        const plainToken = await PasswordResetRepository.createToken(user.id);
        const resetUrl = `${env.APP_URL}/reset-password?token=${plainToken}`;
        const { text, html } = renderPasswordResetEmail(resetUrl, user.name);

        try {
          await emailSender.send({
            to: user.email,
            subject: "Mountain Hut — Set your password",
            text,
            html,
          });
        } catch (err) {
          server.log.error(
            { err },
            "Failed to send password reset email for temporary user login",
          );
        }
      }

      return reply.code(StatusCodes.OK).send(userResponseSchema.parse(user));
    },
  );

  typed.post(
    "/logout",
    {
      schema: {
        tags: ["Auth"],
        summary: "Sign out",
        description:
          "Clears the session cookie. It also answers `200` when nobody is signed in.",
      },
    },
    async (request, reply) => {
      // Clears the encrypted cookie
      request.session.delete();
      return reply
        .code(StatusCodes.OK)
        .send({ message: "Logged out successfully" });
    },
  );

  typed.get(
    "/me",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get the signed-in user",
        operationId: "getCurrentUser",
        response: {
          [StatusCodes.OK]: userResponseSchema.describe("The signed-in user"),
          [StatusCodes.UNAUTHORIZED]: z
            .object({ error: z.string() })
            .describe("Nobody is signed in"),
        },
      },
    },
    async (request, reply) => {
      if (!request.user) {
        return reply
          .code(StatusCodes.UNAUTHORIZED)
          .send({ error: "Not authenticated" });
      }

      return reply
        .code(StatusCodes.OK)
        .send(userResponseSchema.parse(request.user));
    },
  );

  typed.post(
    "/forgot-password",
    {
      schema: {
        summary: "Request password reset",
        description:
          "Initiates the password recovery process by sending a time-limited reset link " +
          "to the specified email address, if an associated account exists.",
        tags: ["Auth"],
        body: forgotPasswordSchema,
        response: {
          // Always returns 200 to prevent user enumeration.
          [StatusCodes.OK]: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body;
      const user = await UserRepository.getUserByEmail(email);

      if (user && user.email && user.type !== "THROWAWAY") {
        const plainToken = await PasswordResetRepository.createToken(user.id);
        const resetUrl = `${env.APP_URL}/reset-password?token=${plainToken}`;
        const { text, html } = renderPasswordResetEmail(resetUrl, user.name);

        // fire-and-forget: don't leak timing info or fail the response on SMTP error
        emailSender
          .send({
            to: user.email,
            subject: "Mountain Hut — Reset your password",
            text,
            html,
          })
          .catch((err) =>
            server.log.error({ err }, "Failed to send password reset email"),
          );
      }

      return reply.code(StatusCodes.OK).send({
        message:
          "If an account with that email exists, a reset link has been sent.",
      });
    },
  );

  typed.post(
    "/reset-password",
    {
      schema: {
        summary: "Updates user's password (requires a valid token).",
        tags: ["Auth"],
        body: resetPasswordSchema,
        response: {
          [StatusCodes.OK]: z.object({ message: z.string() }),
          [StatusCodes.BAD_REQUEST]: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { token, newPassword } = request.body;

      const tokenRow = await PasswordResetRepository.findValidToken(token);
      if (!tokenRow) {
        return reply.code(StatusCodes.BAD_REQUEST).send({
          error: "Invalid or expired reset token.",
        });
      }

      const user = await UserRepository.getUserById(tokenRow.userId);
      if (!user || !user.passwordHash || !user.email) {
        // maybe we should be more explicit if the user doesn't have a password hash
        return reply.code(StatusCodes.BAD_REQUEST).send({
          error: "User not found.",
        });
      }

      const isSamePassword = await argon2.verify(
        user.passwordHash,
        newPassword,
      );
      if (isSamePassword) {
        return reply.code(StatusCodes.BAD_REQUEST).send({
          error:
            "For safety reasons, you cannot change the password to your old one.",
        });
      }

      // update password
      const newPasswordHash = await argon2.hash(newPassword);
      user.passwordHash = newPasswordHash;
      await PasswordResetRepository.deleteByUserId(tokenRow.userId);

      // promote temporary user to hiker if password change was successful
      if (user.type === "TEMPORARY") {
        user.type = "HIKER";
      }
      await UserRepository.updateUser(tokenRow.userId, user);

      // Send confirmation email
      const { text, html } = renderPasswordChangedConfirmationEmail(user.name);
      emailSender
        .send({
          to: user.email,
          subject: "Mountain Hut — Password changed successfully",
          text,
          html,
        })
        .catch((err) =>
          server.log.error(
            { err },
            "Failed to send password changed confirmation email",
          ),
        );

      // Clear existing session so the user must log in with their new credentials
      request.session?.delete?.();

      return reply
        .code(StatusCodes.OK)
        .send({ message: "Password reset successfully." });
    },
  );
};
