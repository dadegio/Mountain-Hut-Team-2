import "@fastify/secure-session";

import type { UserResponse } from "../auth/auth-schema.ts";

// data that we're storing in the session
declare module "@fastify/secure-session" {
  interface SessionData {
    userId: number;
  }
}

// tell Fastify that request can have a `user` property
declare module "fastify" {
  interface FastifyRequest {
    user?: UserResponse | null;
  }
}
