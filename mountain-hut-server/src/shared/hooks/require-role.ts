import type {
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";
import { StatusCodes } from "http-status-codes";

import type { UserType } from "#src/db/schema";

export function requireRole(
  allowed: readonly UserType[],
): preHandlerHookHandler {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (!request.user) {
      return reply
        .code(StatusCodes.UNAUTHORIZED)
        .send({ error: "Authentication required" });
    }

    if (!allowed.includes(request.user.type as UserType)) {
      return reply
        .code(StatusCodes.FORBIDDEN)
        .send({ error: "Insufficient permissions" });
    }
  };
}

export const requireStaff = requireRole(["EMPLOYEE", "MANAGER"]);
export const requireHiker = requireRole(["HIKER"]);
