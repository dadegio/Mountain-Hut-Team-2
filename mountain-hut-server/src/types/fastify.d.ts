import "@fastify/secure-session";
import "@fastify/jwt";

import type { UserResponse } from "../users/user-schema.ts";

declare module "@fastify/secure-session" {
  interface SessionData {
    userId: number;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: UserResponse | null;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: UserResponse | null;
  }
}
