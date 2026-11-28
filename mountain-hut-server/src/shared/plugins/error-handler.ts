import type { FastifyError, FastifyInstance } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { StatusCodes } from "http-status-codes";
import fp from "fastify-plugin";

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(StatusCodes.BAD_REQUEST).send({
        error: error.validation[0]?.message ?? "Bad Request",
      });
    }

    const statusCode = error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;

    if (statusCode >= StatusCodes.INTERNAL_SERVER_ERROR) {
      request.log.error(error);
      return reply.status(StatusCodes.INTERNAL_SERVER_ERROR).send({
        error: "Internal Server Error",
      });
    }

    return reply.status(statusCode).send({
      error: error.message,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(StatusCodes.NOT_FOUND).send({
      error: "Route Not Found",
    });
  });
});
