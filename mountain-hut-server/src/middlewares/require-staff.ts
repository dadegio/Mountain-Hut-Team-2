import type { FastifyReply, FastifyRequest } from "fastify";
import { StatusCodes } from "http-status-codes";

export async function requireStaff(
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
